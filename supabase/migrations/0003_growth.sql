-- Tìm Giá Trị — Nâng cấp tăng trưởng & chuyển đổi:
-- 1) Hỗ trợ gói Trọn đời ('lifetime') trong bảng orders & RPC apply_paid_order
-- 2) Bảng funnel_events + RPC ghi nhận sự kiện phễu ẩn danh + RPC thống kê cho Admin
-- 3) Bảng workshop_leads + RPC đăng ký tư vấn gói Team / Workshop + RPC xem danh sách cho Admin

-- =====================================================================
-- 1. HỖ TRỢ GÓI TRỌN ĐỜI ('lifetime') TRONG ORDERS & APPLY_PAID_ORDER
-- =====================================================================
do $$
declare
  v_conname text;
begin
  select c.conname into v_conname
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'
    and t.relname = 'orders'
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) like '%plan%'
  limit 1;

  if v_conname is not null then
    execute format('alter table public.orders drop constraint %I', v_conname);
  end if;
end $$;

alter table public.orders
  add constraint orders_plan_check
  check (plan in ('monthly', 'yearly', 'lifetime'));

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
    when v_order.plan = 'lifetime' then interval '100 years'
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
-- 2. PHỄU CHUYỂN ĐỔI ẨN DANH (FUNNEL ANALYTICS)
-- =====================================================================
create table if not exists public.funnel_events (
  id bigint generated always as identity primary key,
  session_id text not null,
  event_name text not null,
  step smallint,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_funnel_events_created
  on public.funnel_events (created_at desc);

create index if not exists idx_funnel_events_name_created
  on public.funnel_events (event_name, created_at desc);

alter table public.funnel_events enable row level security;

-- Không mở SELECT/INSERT trực tiếp; ghi qua RPC có kiểm soát & chỉ Admin xem qua RPC
create or replace function public.log_funnel_event(
  p_session_id text,
  p_event_name text,
  p_step smallint default null,
  p_meta jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sid text;
  v_evt text;
begin
  v_sid := left(coalesce(trim(p_session_id), ''), 64);
  v_evt := left(coalesce(trim(p_event_name), ''), 64);
  if v_sid = '' or v_evt = '' then
    return;
  end if;
  if v_evt not in (
    'page_view',
    'step_1_start',
    'step_3_filter',
    'step_5_rank',
    'step_8_result',
    'share_card_download',
    'compare_invite_copy',
    'compare_view',
    'ai_report_generate',
    'pro_cta_click',
    'checkout_start',
    'workshop_lead_submit'
  ) then
    return;
  end if;

  insert into public.funnel_events (session_id, event_name, step, meta)
  values (v_sid, v_evt, p_step, coalesce(p_meta, '{}'::jsonb));
end;
$$;

revoke all on function public.log_funnel_event(text, text, smallint, jsonb) from public;
grant execute on function public.log_funnel_event(text, text, smallint, jsonb) to anon, authenticated;

create or replace function public.admin_funnel_stats(
  p_days integer default 30
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_days integer := greatest(1, least(coalesce(p_days, 30), 365));
  v_since timestamptz := now() - make_interval(days => v_days);
  v_rows jsonb;
begin
  if not public.is_admin() then
    raise exception 'Forbidden: admin role required';
  end if;

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  into v_rows
  from (
    select
      event_name,
      count(*)::int as total_events,
      count(distinct session_id)::int as unique_sessions
    from public.funnel_events
    where created_at >= v_since
    group by event_name
    order by unique_sessions desc
  ) t;

  return jsonb_build_object(
    'days', v_days,
    'since', v_since,
    'events', v_rows
  );
end;
$$;

revoke all on function public.admin_funnel_stats(integer) from public, anon;
grant execute on function public.admin_funnel_stats(integer) to authenticated;

-- =====================================================================
-- 3. ĐĂNG KÝ GÓI WORKSHOP / TEAM (B2B2C LEADS)
-- =====================================================================
create table if not exists public.workshop_leads (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  organization text not null default '',
  team_size text not null default '',
  note text not null default '',
  status text not null default 'new' check (status in ('new', 'contacted', 'closed')),
  created_at timestamptz not null default now()
);

create index if not exists idx_workshop_leads_created
  on public.workshop_leads (created_at desc);

alter table public.workshop_leads enable row level security;

create or replace function public.submit_workshop_lead(
  p_name text,
  p_email text,
  p_org text default '',
  p_team_size text default '',
  p_note text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := left(coalesce(trim(p_name), ''), 120);
  v_email text := left(coalesce(trim(p_email), ''), 160);
  v_id uuid;
begin
  if v_name = '' or position('@' in v_email) < 2 then
    raise exception 'Vui lòng nhập đầy đủ họ tên và email hợp lệ.';
  end if;

  insert into public.workshop_leads (full_name, email, organization, team_size, note)
  values (
    v_name,
    v_email,
    left(coalesce(trim(p_org), ''), 160),
    left(coalesce(trim(p_team_size), ''), 60),
    left(coalesce(trim(p_note), ''), 1000)
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.submit_workshop_lead(text, text, text, text, text) from public;
grant execute on function public.submit_workshop_lead(text, text, text, text, text) to anon, authenticated;

create or replace function public.admin_list_workshop_leads(
  p_limit integer default 50
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lim integer := greatest(1, least(coalesce(p_limit, 50), 200));
  v_rows jsonb;
begin
  if not public.is_admin() then
    raise exception 'Forbidden: admin role required';
  end if;

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  into v_rows
  from (
    select id, full_name, email, organization, team_size, note, status, created_at
    from public.workshop_leads
    order by created_at desc
    limit v_lim
  ) t;

  return v_rows;
end;
$$;

revoke all on function public.admin_list_workshop_leads(integer) from public, anon;
grant execute on function public.admin_list_workshop_leads(integer) to authenticated;
