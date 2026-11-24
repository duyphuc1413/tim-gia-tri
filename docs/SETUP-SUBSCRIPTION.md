# Hướng dẫn kích hoạt Tài khoản, Dùng thử 3 ngày & Thanh toán Pro

Frontend tĩnh của **Tìm Giá Trị** chạy trên GitHub Pages (`index.html`, `account.html`, `privacy.html`) và vẫn hoạt động 100% miễn phí khi chưa cấu hình backend.
Để bật đăng ký tài khoản (**Email**, **Google**, **SĐT + OTP qua Zalo ZNS**), **3 ngày dùng thử**, **gói Pro 99.000đ/tháng · 790.000đ/năm** (PayOS VietQR), lưu đám mây và email nhắc nhở, làm theo 7 bước dưới đây.

---

## Bước 1 · Tạo dự án Supabase & chạy Migration CSDL

1. Tạo dự án mới tại [supabase.com](https://supabase.com) (chọn region **Singapore** để tốc độ tốt tại Việt Nam).
2. Mở **SQL Editor** → dán toàn bộ nội dung file [`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql) và bấm **Run** (hoặc dùng CLI: `supabase db push`).
3. Kiểm tra 4 bảng đã được tạo: `public.profiles`, `public.orders`, `public.journeys`, `public.zalo_tokens` (tất cả đều bật RLS).

---

## Bước 2 · Cấu hình đăng nhập (Auth Providers)

Trong Supabase Dashboard → **Authentication**:

1. **URL Configuration**:
   - **Site URL**: `https://duyphuc1413.github.io/tim-gia-tri`
   - **Redirect URLs**: thêm `https://duyphuc1413.github.io/tim-gia-tri/account.html` (và `http://localhost:8080/account.html` nếu test local).
2. **Email**: bật sẵn mặc định.
3. **Google OAuth**:
   - Tạo OAuth Client ID tại Google Cloud Console (Authorized redirect URI lấy trong mục Google provider của Supabase).
   - Điền Client ID & Client Secret vào Supabase → **Authentication → Providers → Google**.
4. **Số điện thoại + OTP qua Zalo ZNS**:
   - Vào **Authentication → Providers → Phone** → bật **Enable Phone provider**.
   - Vào **Authentication → Hooks → Send SMS Hook** → chọn **HTTPS**, trỏ tới:
     `https://<PROJECT_REF>.supabase.co/functions/v1/sms-hook`
   - Sao chép chuỗi **Hook Secret** (`v1,whsec_...`) để lưu vào `SEND_SMS_HOOK_SECRET` ở Bước 5.

---

## Bước 3 · Cấu hình Zalo OA & Zalo ZNS (gửi OTP)

> **Lưu ý quan trọng:** Zalo yêu cầu OA đã xác thực (tích vàng) và mẫu ZNS OTP đã được duyệt trước khi gửi cho người dùng thật; mỗi tin OTP ZNS có phí (~200–300đ/tin).

1. Đăng ký ứng dụng trên [developers.zalo.me](https://developers.zalo.me), liên kết với Zalo OA của bạn → lấy `ZALO_APP_ID` và `ZALO_SECRET_KEY`.
2. Tạo mẫu ZNS loại OTP có 1 tham số `otp` → chờ duyệt và lấy `ZALO_ZNS_TEMPLATE_ID`.
3. Lấy cặp `access_token` + `refresh_token` ban đầu bằng công cụ OA API Explorer của Zalo, rồi nạp vào bảng `public.zalo_tokens` (chạy 1 lần trong SQL Editor):

```sql
insert into public.zalo_tokens (id, access_token, refresh_token, expires_at)
values (1, '<ACCESS_TOKEN_BAN_DAU>', '<REFRESH_TOKEN_BAN_DAU>', now() + interval '24 hours')
on conflict (id) do update
set access_token = excluded.access_token,
    refresh_token = excluded.refresh_token,
    expires_at = excluded.expires_at;
```

Hàm `sms-hook` sẽ tự động làm mới token khi gần hết hạn và **ghi đè ngay `refresh_token` mới** (vì refresh token của Zalo chỉ dùng 1 lần).

---

## Bước 4 · Cấu hình PayOS (VietQR tự động kích hoạt Pro)

1. Đăng ký tài khoản tại [my.payos.vn](https://my.payos.vn), liên kết tài khoản ngân hàng nhận tiền, tạo 1 **Kênh thanh toán (Payment Channel)**.
2. Lấy 3 khóa: `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY`.
3. Sau khi deploy Edge Functions ở Bước 5, quay lại PayOS → mục **Webhook URL**, nhập:
   `https://<PROJECT_REF>.supabase.co/functions/v1/payos-webhook`
   Bấm xác nhận — `payos-webhook` đã xử lý sẵn giao dịch thử `orderCode = 123` và trả `200 OK`.

---

## Bước 5 · Đặt Secrets & Deploy Edge Functions

Cài [Supabase CLI](https://supabase.com/docs/guides/cli), đăng nhập và liên kết dự án:

```bash
supabase login
supabase link --project-ref <PROJECT_REF>

supabase secrets set \
  SITE_URL="https://duyphuc1413.github.io/tim-gia-tri" \
  PAYOS_CLIENT_ID="..." \
  PAYOS_API_KEY="..." \
  PAYOS_CHECKSUM_KEY="..." \
  SEND_SMS_HOOK_SECRET="v1,whsec_..." \
  ZALO_APP_ID="..." \
  ZALO_SECRET_KEY="..." \
  ZALO_ZNS_TEMPLATE_ID="..." \
  RESEND_API_KEY="re_..." \
  REMINDER_FROM_EMAIL="Tìm Giá Trị <nhacnho@domain-cua-ban.vn>" \
  CRON_SECRET="$(openssl rand -hex 24)"

supabase functions deploy create-payment
supabase functions deploy delete-account
supabase functions deploy payos-webhook --no-verify-jwt
supabase functions deploy sms-hook --no-verify-jwt
supabase functions deploy send-reminders --no-verify-jwt
```

---

## Bước 6 · Bật lịch gửi email nhắc nhở hằng ngày (tùy chọn)

Dùng **Supabase Cron** (`pg_cron` + `pg_net`) hoặc GitHub Actions schedule gọi `POST https://<PROJECT_REF>.supabase.co/functions/v1/send-reminders` mỗi ngày lúc 08:00 giờ Việt Nam (01:00 UTC) kèm header `x-cron-secret: <CRON_SECRET>`:

```sql
select cron.schedule(
  'tgt-daily-reminders',
  '0 1 * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object('x-cron-secret', '<CRON_SECRET>'),
    body := '{}'::jsonb
  );
  $$
);
```

Nếu chưa muốn gửi email ngay, chỉ cần bỏ trống `RESEND_API_KEY` — hàm sẽ tự bỏ qua an toàn.

---

## Bước 7 · Điền khóa công khai vào Frontend

Mở [`assets/js/config.js`](../assets/js/config.js), điền **Project URL** và **Anon / Publishable Key** lấy từ Supabase Dashboard → **Project Settings → API**:

```js
window.TGT_CONFIG = {
  supabaseUrl: "https://<PROJECT_REF>.supabase.co",
  supabaseAnonKey: "eyJ...",
  siteUrl: "https://duyphuc1413.github.io/tim-gia-tri",
  enableGoogleLogin: true,
  enablePhoneZaloLogin: true
};
```

Commit và push lên nhánh `main` — GitHub Pages sẽ tự động cập nhật sau ~1 phút.
