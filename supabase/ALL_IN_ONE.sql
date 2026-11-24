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


-- =====================================================================
-- PHẦN 2: ADMIN PANEL & AUDIT LOGS (0002_admin.sql)
-- =====================================================================

-- Tìm Giá Trị — Mở rộng phân quyền Admin, thống kê doanh thu/người dùng,
-- quản lý đơn hàng và nhật ký quản trị (Audit Logs).
-- Chạy sau 0001_init.sql trong Supabase SQL Editor hoặc qua `supabase db push`.
--
-- Sau khi chạy xong, cấp quyền admin cho tài khoản của bạn bằng lệnh:
--   update public.profiles set role = 'admin' where email = 'email-cua-ban@example.com';

-- =====================================================================
-- 1. CỘT ROLE & HÀM KIỂM TRA ADMIN
-- =====================================================================
alter table public.profiles
  add column if not exists role text not null default 'user'
  check (role in ('user', 'admin'));

-- Đảm bảo người dùng thường không thể tự sửa role / trial_ends_at / paid_until
revoke update on public.profiles from authenticated;
grant update (display_name, reminder_opt_in, reminder_email) on public.profiles to authenticated;

create or replace function public.is_admin(p_uid uuid default auth.uid())
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
      and p.role = 'admin'
  );
$$;

grant execute on function public.is_admin(uuid) to authenticated;

-- =====================================================================
-- 2. NHẬT KÝ QUẢN TRỊ (AUDIT LOGS)
-- =====================================================================
create table if not exists public.admin_audit_logs (
  id bigint generated always as identity primary key,
  admin_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_audit_created
  on public.admin_audit_logs (created_at desc);

alter table public.admin_audit_logs enable row level security;

drop policy if exists "admin_audit_select_admin" on public.admin_audit_logs;
create policy "admin_audit_select_admin"
  on public.admin_audit_logs for select
  to authenticated
  using (public.is_admin(auth.uid()));

-- =====================================================================
-- 3. RPC: THỐNG KÊ TỔNG QUAN + BIỂU ĐỒ 30 NGÀY
-- =====================================================================
create or replace function public.admin_dashboard_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Forbidden: chỉ quản trị viên mới được phép truy cập.' using errcode = '42501';
  end if;

  with days as (
    select generate_series(
      date_trunc('day', now() at time zone 'Asia/Ho_Chi_Minh') - interval '29 days',
      date_trunc('day', now() at time zone 'Asia/Ho_Chi_Minh'),
      interval '1 day'
    )::date as d
  ),
  rev_daily as (
    select
      (o.paid_at at time zone 'Asia/Ho_Chi_Minh')::date as d,
      coalesce(sum(o.amount), 0)::bigint as amount,
      count(*)::int as orders_count
    from public.orders o
    where o.status = 'paid'
      and o.paid_at >= now() - interval '31 days'
    group by 1
  ),
  signup_daily as (
    select
      (p.created_at at time zone 'Asia/Ho_Chi_Minh')::date as d,
      count(*)::int as users_count
    from public.profiles p
    where p.created_at >= now() - interval '31 days'
    group by 1
  )
  select jsonb_build_object(
    'total_users', (select count(*) from public.profiles),
    'new_users_7d', (select count(*) from public.profiles where created_at >= now() - interval '7 days'),
    'new_users_30d', (select count(*) from public.profiles where created_at >= now() - interval '30 days'),
    'active_paid_users', (select count(*) from public.profiles where paid_until is not null and paid_until > now()),
    'active_trial_users', (
      select count(*) from public.profiles
      where (paid_until is null or paid_until <= now())
        and trial_ends_at > now()
    ),
    'expired_users', (
      select count(*) from public.profiles
      where (paid_until is null or paid_until <= now())
        and trial_ends_at <= now()
    ),
    'ever_paid_users', (select count(distinct user_id) from public.orders where status = 'paid'),
    'total_revenue_vnd', (select coalesce(sum(amount), 0) from public.orders where status = 'paid'),
    'revenue_30d_vnd', (select coalesce(sum(amount), 0) from public.orders where status = 'paid' and paid_at >= now() - interval '30 days'),
    'paid_orders_count', (select count(*) from public.orders where status = 'paid'),
    'pending_orders_count', (select count(*) from public.orders where status = 'pending'),
    'total_journeys', (select count(*) from public.journeys),
    'completed_journeys', (select count(*) from public.journeys where completed_at is not null),
    'series_30d', (
      select jsonb_agg(
        jsonb_build_object(
          'date', to_char(days.d, 'YYYY-MM-DD'),
          'revenue', coalesce(rev_daily.amount, 0),
          'orders', coalesce(rev_daily.orders_count, 0),
          'signups', coalesce(signup_daily.users_count, 0)
        )
        order by days.d
      )
      from days
      left join rev_daily on rev_daily.d = days.d
      left join signup_daily on signup_daily.d = days.d
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.admin_dashboard_stats() from public, anon;
grant execute on function public.admin_dashboard_stats() to authenticated;

-- =====================================================================
-- 4. RPC: DANH SÁCH NGƯỜI DÙNG (TÌM KIẾM + LỌC + PHÂN TRANG)
-- =====================================================================
create or replace function public.admin_list_users(
  p_search text default '',
  p_status text default 'all',
  p_limit int default 50,
  p_offset int default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_q text := lower(trim(coalesce(p_search, '')));
  v_lim int := greatest(1, least(coalesce(p_limit, 50), 200));
  v_off int := greatest(0, coalesce(p_offset, 0));
  v_items jsonb;
  v_total bigint;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  with base as (
    select
      p.id,
      p.email,
      p.phone,
      p.display_name,
      p.role,
      p.trial_ends_at,
      p.paid_until,
      p.reminder_opt_in,
      p.created_at,
      case
        when p.paid_until is not null and p.paid_until > now() then 'paid'
        when p.trial_ends_at > now() then 'trial'
        else 'expired'
      end as sub_status,
      (select count(*) from public.journeys j where j.user_id = p.id) as journeys_count,
      (select coalesce(sum(o.amount), 0) from public.orders o where o.user_id = p.id and o.status = 'paid') as total_spent
    from public.profiles p
  ),
  filtered as (
    select * from base
    where (
      v_q = ''
      or lower(coalesce(email, '')) like '%' || v_q || '%'
      or lower(coalesce(phone, '')) like '%' || v_q || '%'
      or lower(coalesce(display_name, '')) like '%' || v_q || '%'
    )
    and (
      p_status = 'all'
      or (p_status = 'admin' and role = 'admin')
      or (p_status in ('paid', 'trial', 'expired') and sub_status = p_status)
    )
  )
  select
    (select count(*) from filtered),
    coalesce(
      (select jsonb_agg(row_to_json(t)) from (
        select * from filtered
        order by created_at desc
        limit v_lim offset v_off
      ) t),
      '[]'::jsonb
    )
  into v_total, v_items;

  return jsonb_build_object('total', v_total, 'items', v_items);
end;
$$;

revoke all on function public.admin_list_users(text, text, int, int) from public, anon;
grant execute on function public.admin_list_users(text, text, int, int) to authenticated;

-- =====================================================================
-- 5. RPC: CỘNG NGÀY PRO / THU HỒI PRO (CÓ GHI AUDIT LOG)
-- =====================================================================
create or replace function public.admin_grant_pro(
  p_target_user_id uuid,
  p_days int,
  p_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_paid_until timestamptz;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  if p_days is null or p_days < 1 or p_days > 3650 then
    raise exception 'Số ngày phải nằm trong khoảng 1 đến 3650.';
  end if;

  update public.profiles
  set paid_until = greatest(now(), coalesce(paid_until, now())) + make_interval(days => p_days)
  where id = p_target_user_id
  returning paid_until into v_new_paid_until;

  if not found then
    raise exception 'Không tìm thấy tài khoản người dùng.';
  end if;

  insert into public.admin_audit_logs (admin_id, action, target_type, target_id, details)
  values (
    auth.uid(),
    'grant_pro',
    'profile',
    p_target_user_id::text,
    jsonb_build_object('days', p_days, 'paid_until', v_new_paid_until, 'note', left(coalesce(p_note, ''), 300))
  );

  return jsonb_build_object('ok', true, 'user_id', p_target_user_id, 'paid_until', v_new_paid_until);
end;
$$;

revoke all on function public.admin_grant_pro(uuid, int, text) from public, anon;
grant execute on function public.admin_grant_pro(uuid, int, text) to authenticated;

create or replace function public.admin_revoke_pro(
  p_target_user_id uuid,
  p_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  update public.profiles
  set paid_until = now()
  where id = p_target_user_id;

  if not found then
    raise exception 'Không tìm thấy tài khoản người dùng.';
  end if;

  insert into public.admin_audit_logs (admin_id, action, target_type, target_id, details)
  values (
    auth.uid(),
    'revoke_pro',
    'profile',
    p_target_user_id::text,
    jsonb_build_object('note', left(coalesce(p_note, ''), 300))
  );

  return jsonb_build_object('ok', true, 'user_id', p_target_user_id);
end;
$$;

revoke all on function public.admin_revoke_pro(uuid, text) from public, anon;
grant execute on function public.admin_revoke_pro(uuid, text) to authenticated;

-- =====================================================================
-- 6. RPC: QUẢN LÝ ĐƠN HÀNG PAYOS & DUYỆT THỦ CÔNG
-- =====================================================================
create or replace function public.admin_list_orders(
  p_status text default 'all',
  p_search text default '',
  p_limit int default 50,
  p_offset int default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_q text := lower(trim(coalesce(p_search, '')));
  v_lim int := greatest(1, least(coalesce(p_limit, 50), 200));
  v_off int := greatest(0, coalesce(p_offset, 0));
  v_items jsonb;
  v_total bigint;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  with joined as (
    select
      o.order_code,
      o.user_id,
      o.plan,
      o.amount,
      o.status,
      o.created_at,
      o.paid_at,
      p.email,
      p.phone,
      p.display_name
    from public.orders o
    left join public.profiles p on p.id = o.user_id
  ),
  filtered as (
    select * from joined
    where (p_status = 'all' or status = p_status)
      and (
        v_q = ''
        or order_code::text like '%' || v_q || '%'
        or lower(coalesce(email, '')) like '%' || v_q || '%'
        or lower(coalesce(phone, '')) like '%' || v_q || '%'
        or lower(coalesce(display_name, '')) like '%' || v_q || '%'
      )
  )
  select
    (select count(*) from filtered),
    coalesce(
      (select jsonb_agg(row_to_json(t)) from (
        select * from filtered
        order by created_at desc
        limit v_lim offset v_off
      ) t),
      '[]'::jsonb
    )
  into v_total, v_items;

  return jsonb_build_object('total', v_total, 'items', v_items);
end;
$$;

revoke all on function public.admin_list_orders(text, text, int, int) from public, anon;
grant execute on function public.admin_list_orders(text, text, int, int) to authenticated;

create or replace function public.admin_mark_order_paid(
  p_order_code bigint,
  p_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res jsonb;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  v_res := public.apply_paid_order(
    p_order_code,
    jsonb_build_object('manual_approval', true, 'approved_by', auth.uid(), 'note', left(coalesce(p_note, ''), 300))
  );

  if coalesce((v_res->>'found')::boolean, false) then
    insert into public.admin_audit_logs (admin_id, action, target_type, target_id, details)
    values (
      auth.uid(),
      'mark_order_paid',
      'order',
      p_order_code::text,
      jsonb_build_object('result', v_res, 'note', left(coalesce(p_note, ''), 300))
    );
  end if;

  return v_res;
end;
$$;

revoke all on function public.admin_mark_order_paid(bigint, text) from public, anon;
grant execute on function public.admin_mark_order_paid(bigint, text) to authenticated;

-- =====================================================================
-- 7. RPC: NHẬT KÝ QUẢN TRỊ & TÌNH TRẠNG HỆ THỐNG
-- =====================================================================
create or replace function public.admin_list_audit_logs(p_limit int default 50)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lim int := greatest(1, least(coalesce(p_limit, 50), 200));
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  return coalesce(
    (select jsonb_agg(row_to_json(t)) from (
      select
        l.id,
        l.action,
        l.target_type,
        l.target_id,
        l.details,
        l.created_at,
        p.email as admin_email,
        p.display_name as admin_name
      from public.admin_audit_logs l
      left join public.profiles p on p.id = l.admin_id
      order by l.created_at desc
      limit v_lim
    ) t),
    '[]'::jsonb
  );
end;
$$;

revoke all on function public.admin_list_audit_logs(int) from public, anon;
grant execute on function public.admin_list_audit_logs(int) to authenticated;

create or replace function public.admin_system_health()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_zalo record;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  select expires_at, updated_at into v_zalo from public.zalo_tokens where id = 1;

  return jsonb_build_object(
    'checked_at', now(),
    'zalo_configured', (v_zalo.expires_at is not null),
    'zalo_token_valid', (v_zalo.expires_at is not null and v_zalo.expires_at > now()),
    'zalo_expires_at', v_zalo.expires_at,
    'zalo_updated_at', v_zalo.updated_at,
    'admins_count', (select count(*) from public.profiles where role = 'admin')
  );
end;
$$;

revoke all on function public.admin_system_health() from public, anon;
grant execute on function public.admin_system_health() to authenticated;
