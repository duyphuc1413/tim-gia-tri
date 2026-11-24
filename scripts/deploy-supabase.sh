#!/usr/bin/env bash
# Script triển khai nhanh toàn bộ DB migration + 5 Edge Functions lên dự án Supabase
# mqjxqincygmmoylathcx. Chạy trên máy của bạn sau khi cài Supabase CLI.
set -euo pipefail

PROJECT_REF="mqjxqincygmmoylathcx"
SITE_URL="https://duyphuc1413.github.io/tim-gia-tri"

if ! command -v supabase >/dev/null 2>&1; then
  echo "Chưa cài Supabase CLI. Cài bằng: brew install supabase/tap/supabase (hoặc npm i -g supabase)"
  exit 1
fi

echo "==> 1. Đăng nhập & liên kết dự án $PROJECT_REF"
supabase login
supabase link --project-ref "$PROJECT_REF"

echo "==> 2. Đẩy migration CSDL (supabase/migrations/0001_init.sql)"
supabase db push

echo "==> 3. Thiết lập SITE_URL"
supabase secrets set SITE_URL="$SITE_URL"

echo "==> 4. Deploy 5 Edge Functions"
supabase functions deploy create-payment
supabase functions deploy delete-account
supabase functions deploy payos-webhook --no-verify-jwt
supabase functions deploy sms-hook --no-verify-jwt
supabase functions deploy send-reminders --no-verify-jwt

echo ""
echo "Hoàn tất! Nếu bạn đã có khóa PayOS / Zalo ZNS / Resend, chạy thêm:"
echo "  supabase secrets set PAYOS_CLIENT_ID=... PAYOS_API_KEY=... PAYOS_CHECKSUM_KEY=..."
echo "  supabase secrets set SEND_SMS_HOOK_SECRET=... ZALO_APP_ID=... ZALO_SECRET_KEY=... ZALO_ZNS_TEMPLATE_ID=..."
echo "  supabase secrets set RESEND_API_KEY=... REMINDER_FROM_EMAIL=... CRON_SECRET=..."
