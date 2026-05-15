-- ─── Seed delegatable permissions into the permissions catalog ─────────────────
-- Required so user_permissions FK on permission_name can reference these rows.

INSERT INTO permissions (name, description)
VALUES
  ('view_audit_logs', 'Can view operational and AI audit logs — delegatable to researchers by PI')
ON CONFLICT (name) DO NOTHING;
