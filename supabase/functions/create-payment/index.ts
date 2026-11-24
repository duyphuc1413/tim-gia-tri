import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, jsonResponse } from "../_shared/cors.js";
import {
  createPaymentSignature,
  generateOrderCode,
  getPlan
} from "../_shared/payos.js";

const PAYOS_ENDPOINT = "https://api-merchant.payos.vn/v2/payment-requests";

Deno.serve(async (req) => {
  const siteUrl = (Deno.env.get("SITE_URL") || "").replace(/\/+$/, "");
  const cors = getCorsHeaders(req, siteUrl);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, cors);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const payosClientId = Deno.env.get("PAYOS_CLIENT_ID");
  const payosApiKey = Deno.env.get("PAYOS_API_KEY");
  const payosChecksumKey = Deno.env.get("PAYOS_CHECKSUM_KEY");

  if (!supabaseUrl || !anonKey || !serviceKey || !payosClientId || !payosApiKey || !payosChecksumKey || !siteUrl) {
    return jsonResponse({ error: "Máy chủ thanh toán chưa được cấu hình đầy đủ." }, 500, cors);
  }

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonResponse({ error: "Bạn cần đăng nhập trước khi thanh toán." }, 401, cors);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } }
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return jsonResponse({ error: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn." }, 401, cors);
  }
  const user = userData.user;

  let body: { plan?: string } = {};
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Dữ liệu yêu cầu không hợp lệ." }, 400, cors);
  }

  const plan = getPlan(body.plan);
  if (!plan) {
    return jsonResponse({ error: "Gói dịch vụ không hợp lệ (chọn monthly, yearly hoặc lifetime)." }, 400, cors);
  }

  const orderCode = generateOrderCode();
  const returnUrl = `${siteUrl}/account.html?payment=success&order=${orderCode}`;
  const cancelUrl = `${siteUrl}/account.html?payment=cancel&order=${orderCode}`;
  const description = plan.description;
  const expiredAt = Math.floor(Date.now() / 1000) + 15 * 60;

  const signature = await createPaymentSignature(
    {
      amount: plan.amount,
      cancelUrl,
      description,
      orderCode,
      returnUrl
    },
    payosChecksumKey
  );

  const payosPayload = {
    orderCode,
    amount: plan.amount,
    description,
    items: [
      {
        name: plan.name,
        quantity: 1,
        price: plan.amount
      }
    ],
    buyerEmail: user.email || undefined,
    buyerPhone: user.phone || undefined,
    cancelUrl,
    returnUrl,
    expiredAt,
    signature
  };

  const payosRes = await fetch(PAYOS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-client-id": payosClientId,
      "x-api-key": payosApiKey
    },
    body: JSON.stringify(payosPayload)
  });

  const payosJson = await payosRes.json().catch(() => null);
  if (!payosRes.ok || !payosJson || payosJson.code !== "00" || !payosJson.data?.checkoutUrl) {
    console.error("PayOS create link error:", payosRes.status, payosJson);
    return jsonResponse(
      { error: payosJson?.desc || "Không tạo được liên kết thanh toán PayOS." },
      502,
      cors
    );
  }

  const adminClient = createClient(supabaseUrl, serviceKey);
  const { error: insertErr } = await adminClient.from("orders").insert({
    order_code: orderCode,
    user_id: user.id,
    plan: plan.id,
    amount: plan.amount,
    status: "pending",
    payment_link_id: payosJson.data.paymentLinkId || null,
    checkout_url: payosJson.data.checkoutUrl
  });

  if (insertErr) {
    console.error("Insert order error:", insertErr);
    return jsonResponse({ error: "Không lưu được đơn hàng vào hệ thống." }, 500, cors);
  }

  return jsonResponse(
    {
      orderCode,
      plan: plan.id,
      amount: plan.amount,
      checkoutUrl: payosJson.data.checkoutUrl
    },
    200,
    cors
  );
});
