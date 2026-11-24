import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";
import { jsonResponse } from "../_shared/cors.js";
import { normalizeVnPhoneTo84 } from "../_shared/phone.js";

const ZALO_ZNS_URL = "https://business.openapi.zalo.me/message/template";
const ZALO_OAUTH_URL = "https://oauth.zaloapp.com/v4/oa/access_token";

function hookError(httpCode: number, message: string) {
  return jsonResponse({ error: { http_code: httpCode, message } }, httpCode);
}

async function refreshZaloToken(
  admin: ReturnType<typeof createClient>,
  currentRefreshToken: string,
  appId: string,
  secretKey: string
): Promise<string> {
  const form = new URLSearchParams({
    app_id: appId,
    grant_type: "refresh_token",
    refresh_token: currentRefreshToken
  });

  const res = await fetch(ZALO_OAUTH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      secret_key: secretKey
    },
    body: form.toString()
  });

  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.access_token || !data?.refresh_token) {
    console.error("Zalo OA token refresh failed:", res.status, data);
    throw new Error("Không làm mới được Zalo OA access token.");
  }

  const expiresInSec = Number(data.expires_in) || 90000; // ~25 giờ
  const expiresAt = new Date(Date.now() + expiresInSec * 1000).toISOString();

  // Refresh token Zalo chỉ dùng 1 lần — phải lưu ngay bản mới nhất vào DB
  const { error } = await admin.from("zalo_tokens").upsert({
    id: 1,
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: expiresAt
  });

  if (error) {
    console.error("Persist refreshed Zalo token failed:", error);
    throw new Error("Không lưu được Zalo token mới vào CSDL.");
  }

  return data.access_token;
}

async function getValidZaloToken(
  admin: ReturnType<typeof createClient>,
  appId: string,
  secretKey: string,
  forceRefresh = false
): Promise<string> {
  const { data: row, error } = await admin
    .from("zalo_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("id", 1)
    .maybeSingle();

  if (error || !row) {
    throw new Error("Chưa khởi tạo dòng token Zalo trong bảng public.zalo_tokens.");
  }

  const expiresMs = new Date(row.expires_at).getTime();
  const almostExpired = !Number.isFinite(expiresMs) || expiresMs - Date.now() < 5 * 60 * 1000;

  if (forceRefresh || almostExpired) {
    return refreshZaloToken(admin, row.refresh_token, appId, secretKey);
  }
  return row.access_token;
}

async function sendZaloOtp(
  accessToken: string,
  phone84: string,
  templateId: string,
  otp: string,
  trackingId: string
) {
  const res = await fetch(ZALO_ZNS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      access_token: accessToken
    },
    body: JSON.stringify({
      phone: phone84,
      template_id: templateId,
      template_data: { otp },
      tracking_id: trackingId
    })
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return hookError(405, "Method not allowed");
  }

  const hookSecretRaw = Deno.env.get("SEND_SMS_HOOK_SECRET") || "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const zaloAppId = Deno.env.get("ZALO_APP_ID") || "";
  const zaloSecretKey = Deno.env.get("ZALO_SECRET_KEY") || "";
  const zaloTemplateId = Deno.env.get("ZALO_ZNS_TEMPLATE_ID") || "";

  if (!hookSecretRaw || !supabaseUrl || !serviceKey || !zaloAppId || !zaloSecretKey || !zaloTemplateId) {
    console.error("Missing sms-hook / Zalo ZNS environment variables");
    return hookError(500, "Zalo ZNS chưa được cấu hình trên máy chủ.");
  }

  const rawBody = await req.text();
  const base64Secret = hookSecretRaw.replace(/^v1,whsec_/, "");
  let payload: { user?: { id?: string; phone?: string }; sms?: { otp?: string } };
  try {
    const wh = new Webhook(base64Secret);
    payload = wh.verify(rawBody, Object.fromEntries(req.headers)) as typeof payload;
  } catch (err) {
    console.warn("Invalid Send SMS Hook signature:", err);
    return hookError(401, "Chữ ký webhook không hợp lệ.");
  }

  const phone84 = normalizeVnPhoneTo84(payload?.user?.phone || "");
  const otp = payload?.sms?.otp || "";
  if (!phone84 || !otp) {
    return hookError(400, "Số điện thoại Việt Nam hoặc mã OTP không hợp lệ.");
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const trackingId = `tgt-${payload?.user?.id || "anon"}-${Date.now()}`;

  try {
    let token = await getValidZaloToken(admin, zaloAppId, zaloSecretKey, false);
    let result = await sendZaloOtp(token, phone84, zaloTemplateId, otp, trackingId);

    // Mã lỗi -216 của Zalo: Access token không hợp lệ / hết hạn -> refresh 1 lần rồi thử lại
    if (result.json && result.json.error === -216) {
      token = await getValidZaloToken(admin, zaloAppId, zaloSecretKey, true);
      result = await sendZaloOtp(token, phone84, zaloTemplateId, otp, trackingId);
    }

    if (!result.json || result.json.error !== 0) {
      console.error("Zalo ZNS send error:", result.status, result.json);
      return hookError(502, `Không gửi được OTP qua Zalo (mã ${result.json?.error ?? result.status}).`);
    }

    return jsonResponse({}, 200);
  } catch (err) {
    console.error("sms-hook exception:", err);
    return hookError(500, err instanceof Error ? err.message : "Lỗi gửi OTP Zalo.");
  }
});
