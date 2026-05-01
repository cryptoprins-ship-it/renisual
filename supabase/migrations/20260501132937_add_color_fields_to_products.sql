ALTER TABLE products
  ADD COLUMN ral_code text,
  ADD COLUMN color_name text,
  ADD COLUMN color_hex text;

COMMENT ON COLUMN products.ral_code IS 'RAL code without prefix';
COMMENT ON COLUMN products.color_name IS 'Human-readable color';
COMMENT ON COLUMN products.color_hex IS 'Hex equivalent for prompt';

CREATE INDEX idx_products_ral_code ON products(ral_code);
