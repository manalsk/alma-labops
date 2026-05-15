-- ─── Phase 5B: Incoming Package Intake + Vision AI ───────────────────────────

CREATE TYPE package_review_status AS ENUM ('pending', 'verified', 'rejected', 'manual_review');
CREATE TYPE extraction_mode       AS ENUM ('mocked', 'live_ai');

-- ─── Incoming Packages ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS incoming_packages (
  id                          uuid                  PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_id                      uuid                  NOT NULL REFERENCES labs(id) ON DELETE CASCADE,
  org_id                      uuid                  NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Image storage
  image_url                   text                  NOT NULL,
  image_path                  text,                 -- Supabase Storage path for management

  -- Uploader
  uploaded_by                 uuid                  NOT NULL REFERENCES auth.users(id),
  uploaded_by_name            text                  NOT NULL,

  -- AI-extracted fields
  extracted_item_name         text,
  extracted_vendor            text,
  extracted_quantity          numeric,
  extracted_unit              text,
  extracted_catalog_number    text,
  extracted_category          text,
  extracted_storage_condition text,
  extraction_confidence       text,                 -- 'high' | 'medium' | 'low' | 'failed'
  extraction_notes            text,
  extraction_raw_json         jsonb,
  extraction_mode             extraction_mode,
  extraction_status           text                  NOT NULL DEFAULT 'pending'
                              CHECK (extraction_status IN ('pending', 'processing', 'completed', 'failed')),

  -- Human review
  review_status               package_review_status NOT NULL DEFAULT 'pending',
  reviewed_by                 uuid                  REFERENCES auth.users(id),
  reviewed_at                 timestamptz,

  -- Cross-links
  linked_inventory_item_id    uuid                  REFERENCES inventory_items(id) ON DELETE SET NULL,
  linked_task_id              uuid                  REFERENCES tasks(id) ON DELETE SET NULL,

  processed_at                timestamptz,
  created_at                  timestamptz           NOT NULL DEFAULT now(),
  updated_at                  timestamptz           NOT NULL DEFAULT now()
);

-- ─── Package Activity Logs ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS package_activity_logs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id  uuid        NOT NULL REFERENCES incoming_packages(id) ON DELETE CASCADE,
  lab_id      uuid        NOT NULL REFERENCES labs(id) ON DELETE CASCADE,
  actor_id    uuid        NOT NULL REFERENCES auth.users(id),
  actor_name  text        NOT NULL,
  action      text        NOT NULL,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ─── Extend ai_audit_logs for package extraction traceability ─────────────────

ALTER TABLE ai_audit_logs ADD COLUMN IF NOT EXISTS metadata     jsonb;
ALTER TABLE ai_audit_logs ADD COLUMN IF NOT EXISTS package_id   uuid REFERENCES incoming_packages(id) ON DELETE SET NULL;
ALTER TABLE ai_audit_logs ADD COLUMN IF NOT EXISTS tokens_used  integer;

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS packages_lab_id_idx       ON incoming_packages(lab_id);
CREATE INDEX IF NOT EXISTS packages_uploaded_by_idx  ON incoming_packages(uploaded_by);
CREATE INDEX IF NOT EXISTS packages_review_idx       ON incoming_packages(review_status);
CREATE INDEX IF NOT EXISTS packages_extraction_idx   ON incoming_packages(extraction_status);
CREATE INDEX IF NOT EXISTS pkg_logs_package_id_idx   ON package_activity_logs(package_id);
CREATE INDEX IF NOT EXISTS ai_logs_package_id_idx    ON ai_audit_logs(package_id);

-- ─── updated_at trigger ───────────────────────────────────────────────────────

CREATE TRIGGER update_incoming_packages_updated_at
  BEFORE UPDATE ON incoming_packages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE incoming_packages     ENABLE ROW LEVEL SECURITY;
ALTER TABLE package_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lab members can view packages"
  ON incoming_packages FOR SELECT TO authenticated
  USING (lab_id = (SELECT lab_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Lab members can view package activity"
  ON package_activity_logs FOR SELECT TO authenticated
  USING (lab_id = (SELECT lab_id FROM profiles WHERE id = auth.uid()));
