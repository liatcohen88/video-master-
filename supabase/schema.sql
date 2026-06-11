-- ============================================================
-- Master Video — Supabase schema
-- Run this once in your Supabase project: SQL Editor → paste → Run.
-- Free tier is plenty for launch.
-- ============================================================

-- 1) PROFILES — one row per user, holds the credit (מאסטרים) balance.
--    Linked to Supabase Auth (auth.users) by id.
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text unique not null,
  display_name text,
  credits      integer not null default 25,   -- new-user gift
  created_at   timestamptz not null default now()
);

-- 2) REVENUE — one row per successful payment, for reconciliation/reporting.
create table if not exists public.revenue_txns (
  id              bigint generated always as identity primary key,
  user_id         uuid references public.profiles(id) on delete set null,
  email           text,
  provider        text not null,              -- 'grow' | 'payplus'
  provider_txn_id text,
  amount_ils      numeric not null default 0,
  credits_bought  integer not null default 0,
  package_id      text,
  created_at      timestamptz not null default now()
);
-- Prevent double-crediting if the webhook is delivered twice (Grow retries).
create unique index if not exists revenue_provider_txn_uniq
  on public.revenue_txns (provider, provider_txn_id);

-- 3) add_credits — atomic "add N credits to this user" used by the webhook.
--    SECURITY DEFINER so the service role can call it; safe because it only
--    increments a balance.
create or replace function public.add_credits(p_user_id uuid, p_credits integer)
returns void
language sql
security definer
as $$
  update public.profiles set credits = credits + p_credits where id = p_user_id;
$$;

-- 4) On new auth user → auto-create their profile with the welcome gift.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 5) Row Level Security — each user sees/updates ONLY their own profile.
alter table public.profiles enable row level security;

drop policy if exists "own profile read"  on public.profiles;
create policy "own profile read"  on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "own profile update" on public.profiles;
create policy "own profile update" on public.profiles
  for update using (auth.uid() = id);

-- Revenue table is service-role only (no public policies) — never exposed
-- to the browser.
alter table public.revenue_txns enable row level security;
