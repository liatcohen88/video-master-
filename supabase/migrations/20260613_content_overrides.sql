-- Cloud-backed CMS: replaces the per-browser localStorage store with a
-- single shared table so every visitor sees the same Liat-edited copy and
-- her edits persist across devices and domain changes.
--
-- Run once via the Supabase SQL Editor.

create table if not exists public.content_overrides (
  key         text primary key,
  value       jsonb       not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid        references auth.users(id) on delete set null
);

alter table public.content_overrides enable row level security;

-- Everyone (including anon) can READ overrides — needed for visitors to
-- see Liat's edits on the marketing pages.
drop policy if exists "public read overrides" on public.content_overrides;
create policy "public read overrides"
  on public.content_overrides
  for select
  using (true);

-- Writes go through the service role only (verified admin email check
-- happens in /api/cms/overrides). No insert/update/delete policy for anon
-- means anon writes are silently blocked even if someone hits the table
-- with the anon key.

create index if not exists content_overrides_updated_at_idx
  on public.content_overrides (updated_at desc);
