/**
 * Pure Web-Crypto PayOS helpers (chạy được trên cả Deno Edge Functions và Node 20+).
 * - Bảng giá cố định phía server (không tin số tiền client gửi lên).
 * - Tạo chữ ký yêu cầu thanh toán (createPaymentSignature).
 * - Xác thực chữ ký webhook từ PayOS (verifyWebhookSignature).
 */

export const PLANS = Object.freeze({
  monthly: Object.freeze({
    id: "monthly",
    name: "Tìm Giá Trị Pro (1 tháng)",
    amount: 99000,
    description: "TGT PRO 1T",
    months: 1
  }),
  yearly: Object.freeze({
    id: "yearly",
    name: "Tìm Giá Trị Pro (1 năm)",
    amount: 299000,
    description: "TGT PRO 1N",
    months: 12
  }),
  lifetime: Object.freeze({
    id: "lifetime",
    name: "Tìm Giá Trị Pro (Trọn đời)",
    amount: 499000,
    description: "TGT PRO TRON DOI",
    months: 1200
  })
});

export function getPlan(planId) {
  if (planId === "monthly") return PLANS.monthly;
  if (planId === "yearly") return PLANS.yearly;
  if (planId === "lifetime") return PLANS.lifetime;
  return null;
}

/**
 * Tạo orderCode là số nguyên dương an toàn (< Number.MAX_SAFE_INTEGER).
 * PayOS yêu cầu orderCode là số nguyên dương duy nhất cho mỗi giao dịch.
 */
export function generateOrderCode(nowMs = Date.now(), rand = Math.random()) {
  const suffix = Math.floor(Math.max(0, Math.min(0.999999, rand)) * 1000);
  return Math.floor(nowMs) * 1000 + suffix;
}

/**
 * Tính HMAC-SHA256 hex (chữ thường) bằng Web Crypto API.
 */
export async function hmacSha256Hex(secretKey, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(String(secretKey)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(String(message)));
  return Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * So sánh chuỗi hex constant-time để tránh timing attack.
 */
export function timingSafeEqualHex(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  if (x.length !== y.length || x.length === 0) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) {
    diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Chữ ký tạo link thanh toán PayOS:
 * amount=$amount&cancelUrl=$cancelUrl&description=$description&orderCode=$orderCode&returnUrl=$returnUrl
 */
export async function createPaymentSignature(params, checksumKey) {
  const canonical =
    `amount=${params.amount}` +
    `&cancelUrl=${params.cancelUrl}` +
    `&description=${params.description}` +
    `&orderCode=${params.orderCode}` +
    `&returnUrl=${params.returnUrl}`;
  return hmacSha256Hex(checksumKey, canonical);
}

function sortObjDataByKey(object) {
  return Object.keys(object)
    .sort()
    .reduce((acc, key) => {
      acc[key] = object[key];
      return acc;
    }, {});
}

/**
 * Chuẩn hóa object `data` trong webhook PayOS thành chuỗi query sắp xếp theo alphabet.
 * Theo tài liệu PayOS: null/undefined/"null"/"undefined" -> "";
 * mảng -> JSON.stringify sau khi sắp xếp key từng phần tử object.
 */
export function buildWebhookDataString(data) {
  if (!data || typeof data !== "object") return "";
  const sorted = sortObjDataByKey(data);
  return Object.keys(sorted)
    .map((key) => {
      let value = sorted[key];
      if (Array.isArray(value)) {
        value = JSON.stringify(
          value.map((item) => (item && typeof item === "object" ? sortObjDataByKey(item) : item))
        );
      } else if (
        value === null ||
        value === undefined ||
        value === "null" ||
        value === "undefined"
      ) {
        value = "";
      } else if (typeof value === "object") {
        value = JSON.stringify(sortObjDataByKey(value));
      }
      return `${key}=${value}`;
    })
    .join("&");
}

export async function verifyWebhookSignature(data, signature, checksumKey) {
  if (!data || typeof data !== "object" || !signature || !checksumKey) return false;
  const dataStr = buildWebhookDataString(data);
  const expected = await hmacSha256Hex(checksumKey, dataStr);
  return timingSafeEqualHex(expected, signature);
}
