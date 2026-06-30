-- Self-owned site traffic counter for the admin analytics panel.
-- One row per (session, path, day) — so repeated 20s heartbeats on the same
-- page collapse to a single row. Unique visitors = COUNT(DISTINCT session_id);
-- page views ≈ COUNT(*). Written by the server (service role) from /api/presence.
-- Liat (2026-06-30): "חייב אנליטקס מתאים... כמה נכנסו היום אתמול".

create table if not exists public.site_visits (
  session_id text not null,
  path       text not null default '/',
  day        date not null,                       -- Asia/Jerusalem calendar day (server-computed)
  country    text,
  created_at timestamptz not null default now(),
  primary key (session_id, path, day)
);

create index if not exists site_visits_day_idx on public.site_visits (day);

-- Server uses the service-role key (bypasses RLS). Enable RLS with NO policies so
-- the public anon key can never read/write this table.
alter table public.site_visits enable row level security;
