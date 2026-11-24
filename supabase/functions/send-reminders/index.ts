import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsonResponse } from "../_shared/cors.js";

const RESEND_URL = "https://api.resend.com/emails";

function timingSafeEqualStr(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function sendEmail(apiKey: string, from: string, to: string, subject: string, html: string) {
  const res = await fetch(RESEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ from, to: [to], subject, html })
  });
  return res.ok;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const cronSecret = Deno.env.get("CRON_SECRET") || "";
  const provided =
    req.headers.get("x-cron-secret") ||
    (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");

  if (!cronSecret || !timingSafeEqualStr(provided, cronSecret)) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const resendKey = Deno.env.get("RESEND_API_KEY") || "";
  const fromEmail = Deno.env.get("REMINDER_FROM_EMAIL") || "Tìm Giá Trị <nhacnho@timgiatri.vn>";
  const siteUrl = (Deno.env.get("SITE_URL") || "https://duyphuc1413.github.io/tim-gia-tri").replace(/\/+$/, "");

  if (!resendKey) {
    return jsonResponse({ ok: true, skipped: true, reason: "RESEND_API_KEY not configured" }, 200);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const admin = createClient(supabaseUrl, serviceKey);

  const now = new Date();
  const in1Day = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();
  const days28Ago = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000).toISOString();

  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id, display_name, email, reminder_email, reminder_opt_in, trial_ends_at, paid_until, last_reminded_at")
    .eq("reminder_opt_in", true);

  if (error || !profiles) {
    console.error("Fetch profiles error:", error);
    return jsonResponse({ error: "Database error" }, 500);
  }

  let sentCount = 0;

  for (const p of profiles) {
    const to = p.reminder_email || p.email;
    if (!to) continue;

    // Không gửi quá 1 email trong 24 giờ cho cùng một người
    if (p.last_reminded_at && now.getTime() - new Date(p.last_reminded_at).getTime() < 24 * 60 * 60 * 1000) {
      continue;
    }

    const name = p.display_name || "bạn";
    const paidUntil = p.paid_until ? new Date(p.paid_until) : null;
    const trialEnds = new Date(p.trial_ends_at);
    const hasActivePaid = paidUntil !== null && paidUntil.getTime() > now.getTime();

    let subject = "";
    let html = "";

    // 1. Dùng thử còn <= 24 giờ và chưa mua gói
    if (!hasActivePaid && trialEnds.getTime() > now.getTime() && trialEnds.toISOString() <= in1Day) {
      subject = "Bản dùng thử Tìm Giá Trị Pro của bạn sắp hết hạn";
      html =
        `<p>Chào ${name},</p>` +
        `<p>3 ngày dùng thử <strong>Tìm Giá Trị Pro</strong> của bạn sẽ kết thúc trong vòng 24 giờ tới. ` +
        `Dữ liệu bạn đã lưu vẫn luôn xem và tải về được; để tiếp tục đồng bộ nhiều thiết bị, dùng Bước 8 BE–DO–HAVE và xuất PDF đẹp, bạn có thể chọn gói Tháng (99.000đ) hoặc Năm (790.000đ — tiết kiệm 33%).</p>` +
        `<p><a href="${siteUrl}/account.html">Mở trang tài khoản &amp; nâng cấp →</a></p>`;
    }
    // 2. Gói Pro trả phí còn <= 3 ngày
    else if (hasActivePaid && paidUntil!.toISOString() <= in3Days) {
      const dateStr = paidUntil!.toLocaleDateString("vi-VN");
      subject = `Gói Tìm Giá Trị Pro của bạn hết hạn ngày ${dateStr}`;
      html =
        `<p>Chào ${name},</p>` +
        `<p>Gói <strong>Tìm Giá Trị Pro</strong> của bạn sẽ hết hạn vào ngày <strong>${dateStr}</strong>. ` +
        `Hệ thống không tự trừ tiền ngân hàng; bạn có thể gia hạn chủ động qua VietQR bất cứ lúc nào.</p>` +
        `<p><a href="${siteUrl}/account.html">Gia hạn gói Pro →</a></p>`;
    }
    // 3. Nhắc soi lại bản đồ giá trị hằng tháng (cho tài khoản đang Pro)
    else if (
      (hasActivePaid || trialEnds.getTime() > now.getTime()) &&
      (!p.last_reminded_at || p.last_reminded_at <= days28Ago)
    ) {
      subject = "1 giờ soi lại bản đồ giá trị tháng này";
      html =
        `<p>Chào ${name},</p>` +
        `<p>Đã đến lịch soi lại hằng tháng. Hãy dành 20–60 phút tự hỏi 3 câu ngắn:</p>` +
        `<ol><li>Tháng qua mình đã sống giá trị nào, bằng việc gì cụ thể?</li>` +
        `<li>Mình vi phạm giá trị nào, vì hoàn cảnh thật hay vì thứ tự ưu tiên đã thay đổi?</li>` +
        `<li>Có xung đột mới nào xuất hiện giữa hai giá trị hàng đầu không?</li></ol>` +
        `<p><a href="${siteUrl}/#hanh-trinh">Mở lại hành trình của bạn →</a></p>` +
        `<p style="color:#666;font-size:12px">Bạn có thể tắt email nhắc nhở bất cứ lúc nào tại <a href="${siteUrl}/account.html">Trang tài khoản</a>.</p>`;
    }

    if (!subject) continue;

    const ok = await sendEmail(resendKey, fromEmail, to, subject, html);
    if (ok) {
      sentCount++;
      await admin
        .from("profiles")
        .update({ last_reminded_at: now.toISOString() })
        .eq("id", p.id);
    }
  }

  return jsonResponse({ ok: true, sent: sentCount }, 200);
});
