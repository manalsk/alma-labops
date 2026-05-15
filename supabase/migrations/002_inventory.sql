-- ============================================================
-- ALMA LabOps — Phase 3: Inventory Schema
-- Run after 001_schema.sql in Supabase SQL Editor
-- ============================================================

-- ─── Inventory Locations ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS inventory_locations (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_id      UUID        NOT NULL REFERENCES labs(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(lab_id, name)
);

-- ─── Inventory Categories ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS inventory_categories (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_id     UUID        NOT NULL REFERENCES labs(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  color      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(lab_id, name)
);

-- ─── Inventory Items ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS inventory_items (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_id           UUID        NOT NULL REFERENCES labs(id) ON DELETE CASCADE,
  name             TEXT        NOT NULL,
  category_id      UUID        REFERENCES inventory_categories(id) ON DELETE SET NULL,
  location_id      UUID        REFERENCES inventory_locations(id) ON DELETE SET NULL,
  quantity         NUMERIC     NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  unit             TEXT        NOT NULL DEFAULT 'units',
  threshold        NUMERIC     NOT NULL DEFAULT 0 CHECK (threshold >= 0),
  reorder_quantity NUMERIC     NOT NULL DEFAULT 0 CHECK (reorder_quantity >= 0),
  notes            TEXT,
  catalog_number   TEXT,
  vendor           TEXT,
  created_by       UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER inventory_items_updated_at
  BEFORE UPDATE ON inventory_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Inventory Activity Logs ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS inventory_activity_logs (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id    UUID        NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  actor_id   UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  actor_name TEXT,
  action     TEXT        NOT NULL
             CHECK (action IN ('created', 'updated', 'quantity_updated', 'location_changed', 'deleted')),
  old_value  JSONB,
  new_value  JSONB,
  notes      TEXT,
  lab_id     UUID        NOT NULL REFERENCES labs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE inventory_locations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_categories    ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inventory_locations_select"
  ON inventory_locations FOR SELECT TO authenticated USING (true);

CREATE POLICY "inventory_categories_select"
  ON inventory_categories FOR SELECT TO authenticated USING (true);

CREATE POLICY "inventory_items_select"
  ON inventory_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "inventory_activity_logs_select"
  ON inventory_activity_logs FOR SELECT TO authenticated USING (true);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_inv_locations_lab    ON inventory_locations(lab_id);
CREATE INDEX IF NOT EXISTS idx_inv_categories_lab   ON inventory_categories(lab_id);
CREATE INDEX IF NOT EXISTS idx_inv_items_lab        ON inventory_items(lab_id);
CREATE INDEX IF NOT EXISTS idx_inv_items_category   ON inventory_items(category_id);
CREATE INDEX IF NOT EXISTS idx_inv_items_location   ON inventory_items(location_id);
CREATE INDEX IF NOT EXISTS idx_inv_items_updated    ON inventory_items(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_inv_activity_item    ON inventory_activity_logs(item_id);
CREATE INDEX IF NOT EXISTS idx_inv_activity_created ON inventory_activity_logs(created_at DESC);
