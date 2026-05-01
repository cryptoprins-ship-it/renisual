-- =========================================================
-- RENISUAL DATABASE SCHEMA
-- Initial migration — captures schema as it exists in cloud
-- =========================================================

-- TABLES

CREATE TABLE suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  email text,
  website text,
  logo_url text,
  active boolean DEFAULT true,
  partnership_status text DEFAULT 'unconfirmed',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid REFERENCES suppliers(id) ON DELETE CASCADE,
  sku text NOT NULL,
  name text NOT NULL,
  category text NOT NULL,
  type text,
  panel_length_mm integer,
  panel_work_size_mm integer,
  panel_visible_height_mm integer,
  orientations text[],
  waste_factor numeric DEFAULT 10,
  price_per_m2_ex_vat numeric,
  description text,
  image_url text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (supplier_id, sku)
);

CREATE TABLE calculations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  project_name text,
  data jsonb NOT NULL,
  rendering_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE quote_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  customer_phone text NOT NULL,
  customer_address text,
  build_year integer,
  preferred_start_date date,
  message text,
  calculation jsonb NOT NULL,
  rendering_url text,
  product_id uuid REFERENCES products(id),
  supplier_id uuid REFERENCES suppliers(id),
  consent_at timestamptz NOT NULL,
  consent_ip inet,
  consent_policy_version text NOT NULL,
  newsletter_opt_in boolean DEFAULT false,
  status text DEFAULT 'new',
  forwarded_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- INDEXES

CREATE INDEX idx_products_supplier ON products(supplier_id);
CREATE INDEX idx_products_category ON products(category) WHERE active;
CREATE INDEX idx_quotes_user ON quote_requests(user_id);
CREATE INDEX idx_quotes_status ON quote_requests(status);
CREATE INDEX idx_quotes_created ON quote_requests(created_at DESC);
CREATE INDEX idx_quotes_supplier ON quote_requests(supplier_id);

-- ROW LEVEL SECURITY

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE calculations ENABLE ROW LEVEL SECURITY;

-- POLICIES

CREATE POLICY "suppliers_public_read"
  ON suppliers FOR SELECT
  USING (active = true);

CREATE POLICY "products_public_read"
  ON products FOR SELECT
  USING (active = true);

CREATE POLICY "quotes_insert_anyone"
  ON quote_requests FOR INSERT
  WITH CHECK (true);

CREATE POLICY "quotes_select_own"
  ON quote_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "calculations_owner_all"
  ON calculations FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- AUTO-UPDATE TIMESTAMPS

CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_timestamp_suppliers BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_timestamp_products BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_timestamp_quotes BEFORE UPDATE ON quote_requests
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_timestamp_calcs BEFORE UPDATE ON calculations
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- SEED DATA

INSERT INTO suppliers (slug, name, email, website, partnership_status) VALUES
  ('spanl',     'Spanl',     NULL, 'https://spanl.nl',     'unconfirmed'),
  ('keralit',   'Keralit',   NULL, 'https://keralit.nl',   'unconfirmed'),
  ('novicell',  'Novicell',  NULL, 'https://novicell.nl',  'unconfirmed'),
  ('vinyplus',  'VinyPlus',  NULL, 'https://vinyplus.com', 'unconfirmed');