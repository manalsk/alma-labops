-- ============================================================
-- Phase 4 — Procurement Schema
-- vendors, purchase_requests, purchase_request_items,
-- procurement_activity_logs
-- ============================================================

-- ── Vendors ──────────────────────────────────────────────────────────────────

CREATE TABLE vendors (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_id      UUID NOT NULL REFERENCES labs(id) ON DELETE CASCADE,
  org_id      UUID NOT NULL REFERENCES organizations(id),
  name        TEXT NOT NULL,
  contact_name  TEXT,
  contact_email TEXT,
  website     TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX vendors_lab_name_idx ON vendors(lab_id, name);

-- ── Purchase Requests ─────────────────────────────────────────────────────────

CREATE TABLE purchase_requests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_id      UUID NOT NULL REFERENCES labs(id) ON DELETE CASCADE,
  org_id      UUID NOT NULL REFERENCES organizations(id),

  title       TEXT NOT NULL,
  description TEXT,

  requester_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  requester_name TEXT NOT NULL,

  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','pending_approval','approved','rejected','ordered','received')),

  urgency TEXT NOT NULL DEFAULT 'normal'
    CHECK (urgency IN ('low','normal','high','critical')),

  vendor_id   UUID REFERENCES vendors(id) ON DELETE SET NULL,
  vendor_name TEXT,

  estimated_total NUMERIC(10,2),

  notes TEXT,

  is_suggestion BOOLEAN NOT NULL DEFAULT FALSE,

  approved_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approver_name TEXT,
  approved_at   TIMESTAMPTZ,

  rejected_at      TIMESTAMPTZ,
  rejection_reason TEXT,

  clarification_note          TEXT,
  clarification_requested_at  TIMESTAMPTZ,

  ordered_at  TIMESTAMPTZ,
  received_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Purchase Request Items ────────────────────────────────────────────────────

CREATE TABLE purchase_request_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id  UUID NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
  inventory_item_id UUID REFERENCES inventory_items(id) ON DELETE SET NULL,
  item_name   TEXT NOT NULL,
  quantity    NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit        TEXT NOT NULL DEFAULT 'units',
  catalog_number      TEXT,
  vendor              TEXT,
  estimated_unit_price NUMERIC(10,2),
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Procurement Activity Logs ─────────────────────────────────────────────────

CREATE TABLE procurement_activity_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id  UUID NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
  lab_id      UUID NOT NULL REFERENCES labs(id) ON DELETE CASCADE,
  actor_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  actor_name  TEXT,
  action      TEXT NOT NULL
    CHECK (action IN (
      'created','submitted','approved','rejected',
      'clarification_requested','ordered','received','edited'
    )),
  old_status  TEXT,
  new_status  TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── updated_at triggers ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER vendors_updated_at
  BEFORE UPDATE ON vendors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER purchase_requests_updated_at
  BEFORE UPDATE ON purchase_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE vendors                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_requests         ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_request_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE procurement_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lab members can view vendors"
  ON vendors FOR SELECT TO authenticated
  USING (lab_id IN (SELECT lab_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Lab members can view purchase requests"
  ON purchase_requests FOR SELECT TO authenticated
  USING (lab_id IN (SELECT lab_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Lab members can view request items"
  ON purchase_request_items FOR SELECT TO authenticated
  USING (request_id IN (
    SELECT id FROM purchase_requests
    WHERE lab_id IN (SELECT lab_id FROM profiles WHERE id = auth.uid())
  ));

CREATE POLICY "Lab members can view procurement activity"
  ON procurement_activity_logs FOR SELECT TO authenticated
  USING (lab_id IN (SELECT lab_id FROM profiles WHERE id = auth.uid()));
