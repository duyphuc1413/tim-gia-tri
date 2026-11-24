/**
 * Chuẩn hóa số điện thoại Việt Nam cho Supabase Auth (+84...) và Zalo ZNS (84...).
 */

const VN_LOCAL_REGEX = /^(3|5|7|8|9)\d{8}$/;

export function normalizeVnPhoneTo84(input) {
  if (typeof input !== "string" && typeof input !== "number") return null;
  let digits = String(input).replace(/[^\d+]/g, "");
  if (!digits) return null;

  if (digits.startsWith("+84")) {
    digits = digits.slice(3);
  } else if (digits.startsWith("84") && digits.length === 11) {
    digits = digits.slice(2);
  } else if (digits.startsWith("0") && digits.length === 10) {
    digits = digits.slice(1);
  } else if (digits.startsWith("+")) {
    return null;
  }

  if (!VN_LOCAL_REGEX.test(digits)) return null;
  return "84" + digits;
}

export function normalizeVnPhoneToE164(input) {
  const zns = normalizeVnPhoneTo84(input);
  return zns ? "+" + zns : null;
}
