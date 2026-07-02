-- Lock down the credit system at the database level. These fixes were first
-- applied live via the Supabase SQL editor (verified 2026-07-02); this
-- migration captures them in version control so a rebuild from schema.sql +
-- migrations can't silently reopen the holes.
--
-- Two holes this closes:
--
-- 1) spend_credits was EXECUTE-granted to anon + authenticated, and its body
--    acts on the passed p_user_id with NO `auth.uid()` ownership check. So any
--    caller (even logged-out, via the public anon key) who knows a user's UUID
--    could call the RPC directly and drain that user's credits to zero
--    (griefing — can't steal or go negative, but can destroy). The app only
--    ever calls this server-side with the service-role key, so restricting
--    execute to service_role breaks nothing.
--
-- 2) profiles UPDATE was reachable per-column by the authenticated role with no
--    column restriction, letting a logged-in user PATCH their own `credits`
--    directly via PostgREST. We keep the row-level policy but strip the
--    credits column from what authenticated may write — only display_name.
--    All balance changes must go through the SECURITY DEFINER RPCs
--    (spend_credits / add_credits), which are service-role only.
--
-- Idempotent — safe to re-run.

-- 1) Credit RPCs: service_role only (never anon/authenticated/public).
revoke execute on function public.spend_credits(uuid, int) from public, anon, authenticated;
grant  execute on function public.spend_credits(uuid, int) to service_role;

revoke execute on function public.add_credits(uuid, int) from public, anon, authenticated;
grant  execute on function public.add_credits(uuid, int) to service_role;

-- 2) profiles.credits is not client-writable. Revoke the blanket UPDATE and
--    hand back only the columns a user may legitimately edit on their own row
--    (the RLS policy still restricts *which* row via auth.uid() = id).
revoke update on table public.profiles from anon, authenticated;
grant  update (display_name) on table public.profiles to authenticated;

-- Make the row-level UPDATE policy explicit about WITH CHECK so a user can
-- never repoint their row to another id even on the columns they can write.
drop policy if exists "own profile update" on public.profiles;
create policy "own profile update" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
