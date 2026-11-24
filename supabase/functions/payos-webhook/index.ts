import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsonResponse } from "../_shared/cors.js";
import { verifyWebhookSignature } from "../_shared/payos.js";

Deno.serve(async (req) => {
  if (req.method === "GET") {
    return jsonResponse({ ok: true, service: "payos-webhook" }, 200);
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const checksumKey = Deno.env.get("PAYOS_CHECKSUM_KEY");

  if (!supabaseUrl || !serviceKey || !checksumKey) {
    console.error("Missing webhook env configuration");
    return jsonResponse({ error: "Server misconfigured" }, 500);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const data = body?.data as Record<string, unknown> | undefined;
  const signature = typeof body?.signature === "string" ? body.signature : "";

  if (!data || !signature) {
    return jsonResponse({ error: "Missing data or signature" }, 400);
  }

  const valid = await verifyWebhookSignature(data, signature, checksumKey);
  if (!valid) {
    console.warn("Invalid PayOS webhook signature");
    return jsonResponse({ error: "Invalid signature" }, 400);
  }

  const orderCode = Number(data.orderCode);
  // PayOS gửi giao dịch mẫu orderCode = 123 khi bấm "Xác nhận webhook URL"
  if (!Number.isSafeInteger(orderCode) || orderCode === 123) {
    return jsonResponse({ ok: true, test: true }, 200);
  }

  // Chỉ kích hoạt Pro khi giao dịch báo thành công ("00")
  if (body.code !== "00" || data.code !== "00") {
    return jsonResponse({ ok: true, ignored: true }, 200);
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: order, error: fetchErr } = await admin
    .from("orders")
    .select("order_code, amount, status")
    .eq("order_code", orderCode)
    .maybeSingle();

  if (fetchErr) {
    console.error("Fetch order error:", fetchErr);
    return jsonResponse({ error: "Database error" }, 500);
  }

  if (!order) {
    // Trả 200 để PayOS không retry vô hạn với đơn ngoài hệ thống
    console.warn("PayOS webhook for unknown orderCode:", orderCode);
    return jsonResponse({ ok: true, found: false }, 200);
  }

  const paidAmount = Number(data.amount);
  if (paidAmount < Number(order.amount)) {
    console.error("Amount mismatch for orderCode:", orderCode, paidAmount, "expected:", order.amount);
    return jsonResponse({ ok: true, amount_mismatch: true }, 200);
  }

  const { data: result, error: rpcErr } = await admin.rpc("apply_paid_order", {
    p_order_code: orderCode,
    p_webhook: body
  });

  if (rpcErr) {
    console.error("apply_paid_order error:", rpcErr);
    return jsonResponse({ error: "Failed to activate order" }, 500);
  }

  return jsonResponse({ ok: true, result }, 200);
});
