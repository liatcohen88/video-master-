-- Server-side credit spending. Closes audit finding C1 (credits were
-- stored in browser localStorage — anyone could set vm_credits_v1=999999
-- in devtools and get unlimited free renders).
--
-- This RPC is atomic: SELECT…UPDATE in one statement with the balance
-- check inside the WHERE clause, so two concurrent spends can't both
-- succeed past the balance. SECURITY DEFINER so the anon role can call
-- it without needing UPDATE rights on profiles directly — RLS still
-- gates the SELECT path.
--
-- Run once via the Supabase SQL Editor.

create or replace function public.spend_credits(p_user_id uuid, p_amount int)
returns table (ok boolean, balance int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance int;
begin
  if p_amount is null or p_amount <= 0 then
    return query select false, 0;
    return;
  end if;

  -- Atomic decrement: only update when current balance is enough. The
  -- WHERE clause acts as the optimistic check; if it didn't match, no
  -- rows are updated and we return false.
  update public.profiles
     set credits = credits - p_amount
   where id = p_user_id
     and credits >= p_amount
   returning credits into v_balance;

  if not found then
    -- Fetch current balance for the caller's error message.
    select credits into v_balance from public.profiles where id = p_user_id;
    return query select false, coalesce(v_balance, 0);
    return;
  end if;

  return query select true, v_balance;
end;
$$;

-- Service-role ONLY. The app always calls this from the server (serverCredits.ts)
-- with the service-role key. Granting `authenticated` here was a griefing hole:
-- the body has no `auth.uid()` check, so any authenticated (or anon) caller could
-- pass someone else's id and drain their credits. Locked down in
-- 20260702_lock_credit_functions.sql — keep this in sync.
revoke all on function public.spend_credits(uuid, int) from public, anon, authenticated;
grant execute on function public.spend_credits(uuid, int) to service_role;
