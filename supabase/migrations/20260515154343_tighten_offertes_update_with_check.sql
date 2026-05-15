-- Tighten the offertes UPDATE policy with a matching WITH CHECK clause.
--
-- Background: the existing "users update own" policy on public.offertes
-- (created in 20260502064015_add_offertes_table.sql) uses
--   FOR UPDATE USING (user_id = auth.uid())
-- but omits WITH CHECK. In Postgres RLS this means the *old* row state
-- is gated on ownership, but the *new* row state is not — an authenticated
-- owner could rewrite the user_id to another auth.users id, transferring
-- ownership of their offerte to someone else.
--
-- Threat model on Renisual: low (offerte flow is dominated by anonymous
-- inserts with user_id NULL; very few rows even have an owner). But the
-- audit flagged it and the fix is one-line, so close the gap.

DROP POLICY IF EXISTS "users update own" ON public.offertes;
CREATE POLICY "users update own"
  ON public.offertes FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
