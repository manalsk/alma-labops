-- ============================================================
-- ALMA LabOps — Phase 7: Operational Copilot Query Log
-- Run after 006_knowledge_base.sql in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS copilot_queries (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_id           UUID        NOT NULL REFERENCES labs(id) ON DELETE CASCADE,
  user_id          UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  user_role        TEXT        NOT NULL,
  question         TEXT        NOT NULL,
  answer           TEXT,
  was_refused      BOOLEAN     NOT NULL DEFAULT false,
  model_used       TEXT,
  tokens_used      INTEGER,
  context_summary  JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_copilot_queries_lab  ON copilot_queries(lab_id);
CREATE INDEX IF NOT EXISTS idx_copilot_queries_user ON copilot_queries(user_id);

ALTER TABLE copilot_queries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "copilot_queries_select" ON copilot_queries
  FOR SELECT TO authenticated
  USING (lab_id IN (SELECT lab_id FROM profiles WHERE id = auth.uid()));
