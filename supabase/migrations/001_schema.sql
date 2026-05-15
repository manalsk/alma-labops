-- ============================================================
-- ALMA LabOps — Phase 2 Schema
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "vector";

-- ─── Organizations ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS organizations (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  slug        TEXT        UNIQUE NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Labs ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS labs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Profiles (extends Supabase auth.users) ───────────────────────────────────

CREATE TABLE IF NOT EXISTS profiles (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id      UUID        NOT NULL REFERENCES organizations(id),
  lab_id      UUID        NOT NULL REFERENCES labs(id),
  full_name   TEXT        NOT NULL,
  role        TEXT        NOT NULL CHECK (role IN ('pi', 'researcher', 'student')),
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Permissions (lookup table) ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS permissions (
  name        TEXT PRIMARY KEY,
  description TEXT NOT NULL
);

-- ─── User Permissions (delegated, per-user extras beyond role defaults) ────────

CREATE TABLE IF NOT EXISTS user_permissions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  permission_name TEXT        NOT NULL REFERENCES permissions(name) ON DELETE CASCADE,
  granted_by      UUID        REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, permission_name)
);

-- ─── Audit Logs ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_logs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id      UUID        REFERENCES profiles(id),
  actor_role    TEXT,
  event_type    TEXT        NOT NULL,
  resource_type TEXT        NOT NULL,
  resource_id   UUID,
  description   TEXT        NOT NULL,
  metadata      JSONB,
  lab_id        UUID        REFERENCES labs(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── AI Audit Logs ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_audit_logs (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        REFERENCES profiles(id),
  user_role        TEXT,
  prompt           TEXT        NOT NULL,
  tool_called      TEXT,
  model_used       TEXT        NOT NULL,
  response_summary TEXT,
  status           TEXT        NOT NULL DEFAULT 'success'
                   CHECK (status IN ('success', 'error', 'blocked')),
  lab_id           UUID        REFERENCES labs(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE organizations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE labs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_audit_logs    ENABLE ROW LEVEL SECURITY;

-- Organizations: any authenticated user can read
CREATE POLICY "orgs_select"
  ON organizations FOR SELECT TO authenticated USING (true);

-- Labs: any authenticated user can read
CREATE POLICY "labs_select"
  ON labs FOR SELECT TO authenticated USING (true);

-- Profiles: any authenticated user can read (small lab team)
CREATE POLICY "profiles_select"
  ON profiles FOR SELECT TO authenticated USING (true);

-- Profiles: users may update only their own row
CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Permissions: any authenticated user can read the lookup table
CREATE POLICY "permissions_select"
  ON permissions FOR SELECT TO authenticated USING (true);

-- User permissions: any authenticated user can read
CREATE POLICY "user_permissions_select"
  ON user_permissions FOR SELECT TO authenticated USING (true);

-- Audit logs: any authenticated user can read (PI sees all; per-page filtering handled in app)
CREATE POLICY "audit_logs_select"
  ON audit_logs FOR SELECT TO authenticated USING (true);

-- AI audit logs: readable by authenticated users
CREATE POLICY "ai_audit_logs_select"
  ON ai_audit_logs FOR SELECT TO authenticated USING (true);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_profiles_lab_id      ON profiles(lab_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role         ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_lab        ON audit_logs(lab_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor      ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created    ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_audit_logs_user    ON ai_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_audit_logs_created ON ai_audit_logs(created_at DESC);
