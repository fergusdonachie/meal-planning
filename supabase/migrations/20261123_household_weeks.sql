-- A single private household. The app server checks the signed household session.
-- No browser key or Supabase authenticated user has direct table access.
create table if not exists public.household_weeks (
  week date primary key check (extract(isodow from week) = 1),
  plan jsonb not null,
  revision integer not null default 1 check (revision > 0),
  operations jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(plan->'selected') = 'array'),
  check (jsonb_typeof(plan->'completed') = 'array'),
  check (jsonb_typeof(operations) = 'array')
);
alter table public.household_weeks enable row level security;
revoke all on public.household_weeks from anon, authenticated;
grant select, insert, update on public.household_weeks to service_role;
