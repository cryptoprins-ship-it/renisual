-- Gemini 2.5 Flash Image renders RAL colors ~15-20% lighter than target
-- (measured ΔE ~17 against ground-truth swatches). To compensate, the
-- render prompt feeds Gemini a darker hex than the official RAL hex.
--
-- color_hex stays the official RAL match (used in UI swatches, PDFs,
-- everywhere except the render prompt). color_hex_render is the
-- compensated value — the render route falls back to color_hex when
-- color_hex_render is null. Tune per-product based on measured ΔE.

ALTER TABLE products
  ADD COLUMN color_hex_render text;

COMMENT ON COLUMN products.color_hex_render IS
  'Hex used in the render prompt to compensate for Gemini lightening bias. Falls back to color_hex when null. Tune per-product based on measured ΔE.';

-- PB7038A (RAL 7038, matt grey): ~15% darker than the official #B5B8B1
-- so Gemini output lands closer to the true target. White panels do
-- not exhibit the same bias and are intentionally left untuned.
UPDATE products
SET color_hex_render = '#9CA09D'
WHERE sku = 'PB7038A';
