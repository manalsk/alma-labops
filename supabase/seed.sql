-- ============================================================
-- ALMA LabOps — Seed Data (static lookups)
-- Run AFTER 001_schema.sql
-- Run BEFORE seed_users.py
-- ============================================================

-- Demo organization
INSERT INTO organizations (id, name, slug) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Demo Research Institute', 'demo-research')
ON CONFLICT (slug) DO NOTHING;

-- Demo lab
INSERT INTO labs (id, org_id, name, description) VALUES
  (
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'Molecular Biology Lab',
    'Main research laboratory'
  )
ON CONFLICT (id) DO NOTHING;

-- Permission definitions
INSERT INTO permissions (name, description) VALUES
  ('manage_users',           'Invite, deactivate, and manage lab members'),
  ('manage_vendors',         'Add and manage approved vendors'),
  ('upload_kb_docs',         'Upload documents to the knowledge base'),
  ('assign_tasks',           'Create and assign tasks to other users'),
  ('approve_purchase_request','Approve or reject purchase requests'),
  ('view_financial_summary', 'View cost estimates and budget summaries'),
  ('manage_locations',       'Add and manage storage locations'),
  ('manage_inventory',       'Create, edit, and delete inventory items'),
  ('manage_categories',      'Manage inventory categories'),
  ('assign_permissions',     'Grant delegated permissions to other users')
ON CONFLICT (name) DO NOTHING;
