-- User-scoped persistence so a paying user's videos + notifications follow
-- their ACCOUNT (not the browser/localStorage they happened to export on).
-- Apply once in the Supabase SQL editor (same as the previous migrations).

-- ── Exported videos ────────────────────────────────────────────────────────
create table if not exists public.user_videos (
  id             text primary key,                -- render jobId
  user_id        uuid not null references auth.users (id) on delete cascade,
  title          text not null default 'סרטון',
  thumbnail_emoji text not null default '🎬',
  duration_sec   integer not null default 0,
  mode           text not null default 'subtitles_only',
  credits_used   integer not null default 0,
  status         text not null default 'processing',  -- processing | done | failed
  video_url      text,                             -- optional permanent Storage URL
  created_at     timestamptz not null default now()
);
create index if not exists user_videos_user_idx on public.user_videos (user_id, created_at desc);

alter table public.user_videos enable row level security;
drop policy if exists "own videos" on public.user_videos;
create policy "own videos" on public.user_videos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Bell notifications ──────────────────────────────────────────────────────
create table if not exists public.user_notifications (
  user_id    uuid not null references auth.users (id) on delete cascade,
  id         text not null,                        -- "welcome", or generated
  kind       text not null default 'feature',
  title      text not null,
  body       text not null default '',
  read       boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists user_notifs_user_idx on public.user_notifications (user_id, created_at desc);

alter table public.user_notifications enable row level security;
drop policy if exists "own notifications" on public.user_notifications;
create policy "own notifications" on public.user_notifications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
