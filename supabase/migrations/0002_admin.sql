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
