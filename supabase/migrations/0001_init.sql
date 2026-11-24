-- Tìm Giá Trị — Khởi tạo CSDL cho tài khoản, gói dùng thử / Pro, thanh toán PayOS,
-- đồng bộ hành trình đám mây và token Zalo ZNS.
-- Chạy trong Supabase SQL Editor hoặc qua `supabase db push`.

create extension if not exists pgcrypto;

-- =====================================================================
-- 1. PROFILES
-- =====================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  phone text,
  display_name text not null default '',
  trial_ends_at timestamptz not null default (now() + interval '3 days'),
  paid_until timestamptz,
  reminder_opt_in boolean not null default true,
  reminder_email text,
  last_reminded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Tự tạo hồ sơ + cấp 3 ngày dùng thử ngay khi có user mới đăng ký (Email, Google, hoặc SĐT/Zalo)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, phone, display_name, reminder_email, trial_ends_at)
  values (
    new.id,
    new.email,
    new.phone,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    new.email,
    now() + interval '3 days'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Chặn người dùng tự sửa trial_ends_at / paid_until: chỉ cấp quyền UPDATE trên 3 cột thông tin cá nhân
revoke update on public.profiles from authenticated;
grant update (display_name, reminder_opt_in, reminder_email) on public.profiles to authenticated;

-- =====================================================================
-- 2. HÀM KIỂM TRA QUYỀN PRO (dùng thử còn hạn HOẶC đã thanh toán còn hạn)
-- =====================================================================
create or replace function public.is_pro(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = p_uid
      and now() < greatest(p.trial_ends_at, coalesce(p.paid_until, '-infinity'::timestamptz))
  );
$$;

grant execute on function public.is_pro(uuid) to authenticated;

-- =====================================================================
-- 3. ORDERS (đơn thanh toán PayOS)
-- =====================================================================
create table if not exists public.orders (
  order_code bigint primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null check (plan in ('monthly', 'yearly')),
  amount integer not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled', 'expired')),
  payment_link_id text,
  checkout_url text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  raw_webhook jsonb
);

create index if not exists idx_orders_user_created
  on public.orders (user_id, created_at desc);

alter table public.orders enable row level security;

-- Người dùng chỉ được xem lịch sử đơn của chính mình; tạo / cập nhật đơn chỉ qua Edge Function (service_role)
drop policy if exists "orders_select_own" on public.orders;
create policy "orders_select_own"
  on public.orders for select
  to authenticated
  using (auth.uid() = user_id);

-- Xử lý webhook thanh toán thành công (idempotent, chống cộng đúp nếu PayOS gửi lại webhook)
create or replace function public.apply_paid_order(
  p_order_code bigint,
  p_webhook jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_period interval;
  v_new_paid_until timestamptz;
begin
  select * into v_order
  from public.orders
  where order_code = p_order_code
  for update;

  if not found then
    return jsonb_build_object('found', false);
  end if;

  if v_order.status = 'paid' then
    return jsonb_build_object('found', true, 'already_paid', true, 'order_code', p_order_code);
  end if;

  v_period := case
    when v_order.plan = 'yearly' then interval '1 year'
    else interval '1 month'
  end;

  update public.orders
  set status = 'paid',
      paid_at = now(),
      raw_webhook = coalesce(p_webhook, raw_webhook)
  where order_code = p_order_code;

  update public.profiles
  set paid_until = greatest(now(), coalesce(paid_until, now())) + v_period
  where id = v_order.user_id
  returning paid_until into v_new_paid_until;

  return jsonb_build_object(
    'found', true,
    'already_paid', false,
    'order_code', p_order_code,
    'user_id', v_order.user_id,
    'plan', v_order.plan,
    'paid_until', v_new_paid_until
  );
end;
$$;

revoke all on function public.apply_paid_order(bigint, jsonb) from public, anon, authenticated;
grant execute on function public.apply_paid_order(bigint, jsonb) to service_role;

-- =====================================================================
-- 4. JOURNEYS (lưu hành trình đám mây + lịch sử nhiều năm)
-- =====================================================================
create table if not exists public.journeys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Hành trình tìm giá trị',
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_journeys_user_updated
  on public.journeys (user_id, updated_at desc);

drop trigger if exists trg_journeys_updated_at on public.journeys;
create trigger trg_journeys_updated_at
  before update on public.journeys
  for each row execute function public.touch_updated_at();

alter table public.journeys enable row level security;

-- Người dùng luôn xem và xóa được dữ liệu của chính mình ngay cả khi hết Pro
drop policy if exists "journeys_select_own" on public.journeys;
create policy "journeys_select_own"
  on public.journeys for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "journeys_delete_own" on public.journeys;
create policy "journeys_delete_own"
  on public.journeys for delete
  to authenticated
  using (auth.uid() = user_id);

-- Lưu mới / cập nhật lên đám mây yêu cầu đang trong hạn dùng thử hoặc gói Pro
drop policy if exists "journeys_insert_pro" on public.journeys;
create policy "journeys_insert_pro"
  on public.journeys for insert
  to authenticated
  with check (auth.uid() = user_id and public.is_pro(auth.uid()));

drop policy if exists "journeys_update_pro" on public.journeys;
create policy "journeys_update_pro"
  on public.journeys for update
  to authenticated
  using (auth.uid() = user_id and public.is_pro(auth.uid()))
  with check (auth.uid() = user_id and public.is_pro(auth.uid()));

-- =====================================================================
-- 5. ZALO_TOKENS (lưu access_token + refresh_token xoay vòng cho Zalo ZNS)
-- =====================================================================
create table if not exists public.zalo_tokens (
  id smallint primary key default 1 check (id = 1),
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_zalo_tokens_updated_at on public.zalo_tokens;
create trigger trg_zalo_tokens_updated_at
  before update on public.zalo_tokens
  for each row execute function public.touch_updated_at();

alter table public.zalo_tokens enable row level security;
-- Không tạo policy cho anon/authenticated: chỉ service_role đọc/ghi được bảng này.
