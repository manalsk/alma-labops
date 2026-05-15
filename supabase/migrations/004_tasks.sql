-- ─── Phase 5A: Task Management ───────────────────────────────────────────────

CREATE TYPE task_status   AS ENUM ('todo', 'in_progress', 'blocked', 'completed');
CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE task_type     AS ENUM ('operational', 'lab_maintenance', 'procurement', 'onboarding', 'package_intake', 'other');

-- ─── Tasks ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tasks (
  id                          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_id                      uuid          NOT NULL REFERENCES labs(id) ON DELETE CASCADE,
  org_id                      uuid          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  title                       text          NOT NULL,
  description                 text,
  status                      task_status   NOT NULL DEFAULT 'todo',
  priority                    task_priority NOT NULL DEFAULT 'medium',
  task_type                   task_type     NOT NULL DEFAULT 'operational',

  assigned_to                 uuid          REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_to_name            text,
  created_by                  uuid          NOT NULL REFERENCES auth.users(id),
  created_by_name             text          NOT NULL,

  due_date                    date,
  completed_at                timestamptz,

  -- Optional context links (all nullable)
  related_inventory_item_id   uuid          REFERENCES inventory_items(id) ON DELETE SET NULL,
  related_purchase_request_id uuid          REFERENCES purchase_requests(id) ON DELETE SET NULL,
  related_package_id          uuid,         -- placeholder for Phase 5B

  ai_generated                boolean       NOT NULL DEFAULT false,

  created_at                  timestamptz   NOT NULL DEFAULT now(),
  updated_at                  timestamptz   NOT NULL DEFAULT now()
);

-- ─── Task Activity Logs ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS task_activity_logs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     uuid        NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  lab_id      uuid        NOT NULL REFERENCES labs(id) ON DELETE CASCADE,
  actor_id    uuid        NOT NULL REFERENCES auth.users(id),
  actor_name  text        NOT NULL,
  action      text        NOT NULL,  -- created | assigned | status_changed | completed | edited
  old_value   text,
  new_value   text,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS tasks_lab_id_idx        ON tasks(lab_id);
CREATE INDEX IF NOT EXISTS tasks_assigned_to_idx   ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS tasks_status_idx        ON tasks(status);
CREATE INDEX IF NOT EXISTS tasks_due_date_idx      ON tasks(due_date);
CREATE INDEX IF NOT EXISTS task_logs_task_id_idx   ON task_activity_logs(task_id);

-- ─── updated_at trigger (function already exists from prior migrations) ───────

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE tasks             ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lab members can view tasks"
  ON tasks FOR SELECT TO authenticated
  USING (lab_id = (SELECT lab_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Lab members can view task activity"
  ON task_activity_logs FOR SELECT TO authenticated
  USING (lab_id = (SELECT lab_id FROM profiles WHERE id = auth.uid()));
