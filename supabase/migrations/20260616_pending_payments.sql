-- pending_payments — the bridge between our /buy page and Grow's webhook.
--
-- Grow's hosted payment page does NOT collect the buyer's email in its
-- minimal flow, and Grow's URLs don't round-trip our query parameters.
-- That left us unable to identify which user paid when the webhook fires.
--
-- Workaround: when a user clicks "Buy" on /buy/[pkg], we INSERT a row
-- here BEFORE redirecting them to Grow. When Grow's webhook arrives, we
-- match by exact amount + most recent unfulfilled row + within 30 minutes.
-- Then we credit that user.
--
-- Race condition note: if two users initiate ₪10 payments within 30 min
-- of each other, the most-recent one wins. At small scale this is fine;
-- when traffic grows we'll upgrade to a per-checkout token mechanism.
CREATE TABLE IF NOT EXISTS pending_payments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  package_id    TEXT NOT NULL,
  amount_ils    INTEGER NOT NULL,
  credits       INTEGER NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fulfilled_at  TIMESTAMPTZ,
  fulfilled_txn TEXT
);

-- The webhook matcher's lookup: amount + still-pending + recent.
CREATE INDEX IF NOT EXISTS pending_payments_match_idx
  ON pending_payments (amount_ils, fulfilled_at, created_at DESC);

-- Users see their own pending only — the webhook (service role) sees all.
ALTER TABLE pending_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY pending_payments_owner_select ON pending_payments
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY pending_payments_owner_insert ON pending_payments
  FOR INSERT WITH CHECK (auth.uid() = user_id);
