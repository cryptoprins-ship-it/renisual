-- Seed Spanl panels into products with RAL/color metadata.
-- Source of truth at runtime: lib/spanlPanelCatalog.ts (24 SKUs).
-- Re-runnable: ON CONFLICT uses the existing (supplier_id, sku) unique
-- constraint from the initial schema, so this migration upserts
-- ral_code/color_name/color_hex without creating duplicate rows.

-- All 24 panels share the same Spanl supplier; resolve once via CTE.
WITH spanl AS (SELECT id FROM suppliers WHERE slug = 'spanl')

INSERT INTO products (
  sku, supplier_id, name, category, type,
  panel_length_mm, panel_visible_height_mm, panel_work_size_mm,
  orientations, waste_factor, price_per_m2_ex_vat,
  description, image_url, active,
  ral_code, color_name, color_hex
)
SELECT v.sku, spanl.id, v.name, 'gevelbekleding', 'cladding',
       v.panel_length_mm, v.panel_visible_height_mm, v.panel_work_size_mm,
       v.orientations, 8, 29.5,
       v.description, v.image_url, true,
       v.ral_code, v.color_name, v.color_hex
FROM spanl,
(VALUES
  -- ---- Brick (no RAL) ----
  ('B10-01',    'B10-01 Brick',                  4200, 220, 210, ARRAY['horizontal']::text[],              'Brick look — individual bricks with visible mortar joints; 21 cm panel.',  NULL::text,   NULL::text,    'beige brick',         '#C9A77C'),
  ('B10-02',    'B10-02 Brick',                  4200, 220, 210, ARRAY['horizontal']::text[],              'Brick look — individual bricks with visible mortar joints; 21 cm panel.',  NULL,         NULL,          'grey brick',          '#8A8780'),
  -- ---- Spanish tile (no RAL) ----
  ('CZS70-01A', 'CZS70-01A Spanish Tile',        4200, 310, 300, ARRAY['horizontal']::text[],              'Spanish roof tile look — continuous tile pattern; 30 cm panel.',           NULL,         NULL,          'beige Spanish tile',  '#B89868'),
  ('CZS70-02A', 'CZS70-02A Spanish Tile',        4200, 310, 300, ARRAY['horizontal']::text[],              'Spanish roof tile look — continuous tile pattern; 30 cm panel.',           NULL,         NULL,          'grey Spanish tile',   '#7C7973'),
  -- ---- Mono Flat ----
  ('PB7038A',   'PB7038A Mono Flat',             4200, 380, 370, ARRAY['horizontal','vertical']::text[],   'Mono Flat — flat surface, narrow seam between panels; 37 cm panel.',       NULL,         '7038',        'matt grey',           '#B5B8B1'),
  ('PB9003A',   'PB9003A Mono Flat',             4200, 380, 370, ARRAY['horizontal','vertical']::text[],   'Mono Flat — flat surface, narrow seam between panels; 37 cm panel. RAL 9010 look.', NULL,'9010',        'pure white',          '#F1F0EA'),
  -- ---- Wood (no RAL) ----
  ('PBW32-06',  'PBW32-06 Warm Eiken (houtlook)',4200, 330, 320, ARRAY['horizontal']::text[],              'Wood plank look — visible warm-oak grain on each plank; 32 cm panel.',     NULL,         NULL,          'warm oak',            '#8B5A2B'),
  -- ---- Mono Groove ----
  ('SG7021A',   'SG7021A Mono Groove',           4200, 380, 370, ARRAY['horizontal','vertical']::text[],   'Mono Groove — deep shadow groove between panels; 37 cm panel.',            NULL,         '7021',        'black grey',          '#252525'),
  ('SG7038A',   'SG7038A Mono Groove',           4200, 380, 370, ARRAY['horizontal','vertical']::text[],   'Mono Groove — deep shadow groove between panels; 37 cm panel.',            NULL,         '7038',        'matt grey',           '#B5B8B1'),
  ('SG9003A',   'SG9003A Mono Groove',           4200, 380, 370, ARRAY['horizontal','vertical']::text[],   'Mono Groove — deep shadow groove between panels; 37 cm panel. RAL 9010 look.', NULL,     '9010',        'pure white',          '#F1F0EA'),
  ('SG9005A',   'SG9005A Mono Groove',           4200, 380, 370, ARRAY['horizontal','vertical']::text[],   'Mono Groove — deep shadow groove between panels; 37 cm panel.',            NULL,         '9005',        'jet black',           '#0A0A0A'),
  ('SG9006A',   'SG9006A Mono Groove',           4200, 380, 370, ARRAY['horizontal','vertical']::text[],   'Mono Groove — deep shadow groove; 37 cm panel. White aluminium = metallic silver-grey, NOT white.', NULL, '9006', 'white aluminium',   '#A5A8A6'),
  -- ---- Strip ----
  ('TS70-02A',  'TS70-02A Strip',                4200, 260, 250, ARRAY['horizontal']::text[],              'Strip — narrow planks with fine seams; 25 cm panel width.',                NULL,         NULL,          'grey',                '#8A8780'),
  ('TS7021A',   'TS7021A Strip',                 4200, 260, 250, ARRAY['horizontal']::text[],              'Strip — narrow planks with fine seams; 25 cm panel width.',                NULL,         '7021',        'black grey',          '#252525'),
  ('TS9003P',   'TS9003P Strip',                 4200, 260, 250, ARRAY['horizontal']::text[],              'Strip — narrow planks with fine seams; 25 cm panel width. RAL 9010 look.', NULL,         '9010',        'pure white',          '#F1F0EA'),
  ('TS9006P',   'TS9006P Strip',                 4200, 260, 250, ARRAY['horizontal']::text[],              'Strip — narrow planks with fine seams; 25 cm panel width. White aluminium = metallic silver-grey.', NULL, '9006', 'white aluminium', '#A5A8A6'),
  -- ---- YMPB Mono Flat ----
  ('YMPB7021A', 'YMPB7021A Mono Flat',           4200, 380, 370, ARRAY['horizontal','vertical']::text[],   'Mono Flat — flat surface, narrow seam; 37 cm panel.',                      NULL,         '7021',        'black grey',          '#252525'),
  ('YMPB9003A', 'YMPB9003A Mono Flat',           4200, 380, 370, ARRAY['horizontal','vertical']::text[],   'Mono Flat — flat surface, narrow seam; 37 cm panel. RAL 9010 look.',       NULL,         '9010',        'pure white',          '#F1F0EA'),
  ('YMPB9005A', 'YMPB9005A Mono Flat',           4200, 380, 370, ARRAY['horizontal','vertical']::text[],   'Mono Flat — flat surface, narrow seam; 37 cm panel.',                      NULL,         '9005',        'jet black',           '#0A0A0A'),
  -- ---- YMSG Mono Groove ----
  ('YMSG7021A', 'YMSG7021A Mono Groove',         4200, 380, 370, ARRAY['horizontal','vertical']::text[],   'Mono Groove — deep shadow groove between panels; 37 cm panel.',            NULL,         '7021',        'black grey',          '#252525'),
  ('YMSG7038A', 'YMSG7038A Mono Groove',         4200, 380, 370, ARRAY['horizontal','vertical']::text[],   'Mono Groove — deep shadow groove between panels; 37 cm panel.',            NULL,         '7038',        'matt grey',           '#B5B8B1'),
  ('YMSG9003A', 'YMSG9003A Mono Groove',         4200, 380, 370, ARRAY['horizontal','vertical']::text[],   'Mono Groove — deep shadow groove between panels; 37 cm panel. RAL 9010 look.', NULL,     '9010',        'pure white',          '#F1F0EA'),
  ('YMSG9005A', 'YMSG9005A Mono Groove',         4200, 380, 370, ARRAY['horizontal','vertical']::text[],   'Mono Groove — deep shadow groove between panels; 37 cm panel.',            NULL,         '9005',        'jet black',           '#0A0A0A'),
  -- ---- YPMB Mono Flat ----
  ('YPMB7038A', 'YPMB7038A Mono Flat',           4200, 380, 370, ARRAY['horizontal','vertical']::text[],   'Mono Flat — flat surface, narrow seam; 37 cm panel.',                      NULL,         '7038',        'matt grey',           '#B5B8B1')
) AS v(
  sku, name,
  panel_length_mm, panel_visible_height_mm, panel_work_size_mm,
  orientations, description, image_url,
  ral_code, color_name, color_hex
)
ON CONFLICT (supplier_id, sku) DO UPDATE SET
  name             = EXCLUDED.name,
  category         = EXCLUDED.category,
  type             = EXCLUDED.type,
  panel_length_mm        = EXCLUDED.panel_length_mm,
  panel_visible_height_mm= EXCLUDED.panel_visible_height_mm,
  panel_work_size_mm     = EXCLUDED.panel_work_size_mm,
  orientations     = EXCLUDED.orientations,
  waste_factor     = EXCLUDED.waste_factor,
  price_per_m2_ex_vat = EXCLUDED.price_per_m2_ex_vat,
  description      = EXCLUDED.description,
  image_url        = EXCLUDED.image_url,
  active           = EXCLUDED.active,
  ral_code         = EXCLUDED.ral_code,
  color_name       = EXCLUDED.color_name,
  color_hex        = EXCLUDED.color_hex;
