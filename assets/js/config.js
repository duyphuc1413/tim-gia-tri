/**
 * Cấu hình công khai cho hệ thống tài khoản & gói Pro (Supabase + PayOS + Zalo ZNS).
 *
 * AN TOÀN ĐỂ COMMIT: chỉ chứa Supabase URL và Publishable/Anon Key (đã có RLS bảo vệ).
 * KHÔNG BAO GIỜ đặt service_role key, PayOS API key/checksum key, hay Zalo secret vào file này.
 *
 * Khi để trống `supabaseUrl` và `supabaseAnonKey`, trang web vẫn hoạt động bình thường
 * ở chế độ miễn phí lưu cục bộ (localStorage), không báo lỗi.
 * Xem hướng dẫn điền cấu hình tại: docs/SETUP-SUBSCRIPTION.md
 */
window.TGT_CONFIG = {
  supabaseUrl: "https://mqjxqincygmmoylathcx.supabase.co",
  supabaseAnonKey: "sb_publishable_rfURnzmoyA2o0S9CydyynA__Q0kQOx5",
  siteUrl: "https://duyphuc1413.github.io/tim-gia-tri",
  enableGoogleLogin: false,
  enablePhoneZaloLogin: false
};
