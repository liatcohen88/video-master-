-- Self-owned site traffic counter for the admin analytics panel.
-- One row per (session, path, day) — repeated 20s heartbeats on the same page
-- collapse to a single row. Unique visitors = COUNT(DISTINCT session_id);
-- page views ≈ COUNT(*). Written by the server (service role) from /api/presence.
-- Carries device / referrer / country so the admin can break traffic down for
-- real (Liat: "כמה שיותר מידע על משתמשים שהכל יהיה אמיתי ללא פייק").

create table if not exists public.site_visits (
  session_id text not null,
  path       text not null default '/',
  day        date not null,                       -- Asia/Jerusalem calendar day
  device     text,                                -- mobile | tablet | desktop
  referrer   text,                                -- first referring host (or 'direct')
  country    text,
  created_at timestamptz not null default now(),
  primary key (session_id, path, day)
);

create index if not exists site_visits_day_idx on public.site_visits (day);

-- If the table already exists from an earlier run, add the new columns too.
alter table public.site_visits add column if not exists device   text;
alter table public.site_visits add column if not exists referrer text;
alter table public.site_visits add column if not exists country  text;

-- Server uses the service-role key (bypasses RLS). Enable RLS with NO policies
-- so the public anon key can never read/write this table.
alter table public.site_visits enable row level security;
