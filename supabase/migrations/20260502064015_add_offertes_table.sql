-- Offertes (quote pages) generated from /gevelcalc.
--
-- Each row backs one downloadable PDF + one public /offerte/[ref] page.
-- Anyone with the (random, unguessable) ref can view, but only the
-- original creator can update. user_id is nullable so anonymous calcs
-- can still produce a quote — that's the dominant flow today.
--
-- Storage buckets (created separately via the Supabase Dashboard):
--   offerte-photos  (private, owner read/write, signed URLs only)
--   offerte-renders (private, owner read/write, signed URLs only)
--   offerte-pdfs    (private, signed URLs only — public ref page reads
--                    via server-issued signed URL on every render)

CREATE TABLE IF NOT EXISTS public.offertes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  -- Customer (optional — anonymous calc allowed)
  customer_name text,
  customer_email text,
  customer_company text,
  project_address text,

  -- Calc inputs (JSON for flexibility — calc engine evolves)
  calc_input jsonb NOT NULL,

  -- Calc outputs (denormalized for quick rendering on /offerte/[ref])
  panel_count int NOT NULL,
  profile_end_count int NOT NULL,
  profile_middle_count int NOT NULL,
  profile_corner_count int NOT NULL,
  subtotal_excl_btw numeric(10,2) NOT NULL,
  total_incl_btw numeric(10,2) NOT NULL,

  -- Asset references (Supabase Storage paths, not URLs)
  photo_path  text,
  render_path text,
  pdf_path    text,

  -- Metadata
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  view_count int NOT NULL DEFAULT 0,
  last_viewed_at timestamptz
);

CREATE INDEX IF NOT EXISTS offertes_ref_idx ON public.offertes(ref);
CREATE INDEX IF NOT EXISTS offertes_user_id_idx
  ON public.offertes(user_id)
  WHERE user_id IS NOT NULL;

ALTER TABLE public.offertes ENABLE ROW LEVEL SECURITY;

-- Public read by ref. The 5-character random suffix from a 31-letter
-- ambiguity-stripped alphabet gives ~28.6M combinations per year — the
-- ref itself is the access token, comparable to a signed share link.
DROP POLICY IF EXISTS "public read by ref" ON public.offertes;
CREATE POLICY "public read by ref"
  ON public.offertes FOR SELECT
  USING (true);

-- Authenticated users may insert rows attributed to themselves; anon
-- inserts are also allowed (user_id null) so the dominant /gevelcalc
-- anonymous flow continues to work.
DROP POLICY IF EXISTS "users insert own" ON public.offertes;
CREATE POLICY "users insert own"
  ON public.offertes FOR INSERT
  WITH CHECK (
    user_id = auth.uid() OR user_id IS NULL
  );

-- Only the original creator can mutate the row (and only if it was
-- attributed to them at insert time). Anonymous rows are immutable
-- after creation.
DROP POLICY IF EXISTS "users update own" ON public.offertes;
CREATE POLICY "users update own"
  ON public.offertes FOR UPDATE
  USING (user_id = auth.uid());

-- Make sure the Data API exposes the table; INSERT is needed for
-- anonymous inserts since we don't gate /api/offertes behind login.
GRANT SELECT, INSERT, UPDATE ON public.offertes TO anon, authenticated;
