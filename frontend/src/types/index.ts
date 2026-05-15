// ─── Roles & Permissions ──────────────────────────────────────────────────────

export type Role = 'pi' | 'researcher' | 'student';

export type Permission =
  | 'manage_users'
  | 'manage_vendors'
  | 'upload_kb_docs'
  | 'assign_tasks'
  | 'approve_purchase_request'
  | 'view_financial_summary'
  | 'manage_locations'
  | 'manage_inventory'
  | 'manage_categories'
  | 'assign_permissions';

// ─── User ─────────────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  permissions: Permission[];
  lab_id: string;
  org_id: string;
  is_active: boolean;
  created_at: string;
}

// ─── Inventory ────────────────────────────────────────────────────────────────

export type InventoryStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

export interface InventoryItem {
  id: string;
  lab_id: string;
  name: string;
  category_id: string | null;
  category_name: string | null;
  location_id: string | null;
  location_name: string | null;
  quantity: number;
  unit: string;
  threshold: number;
  reorder_quantity: number;
  status: InventoryStatus;
  notes: string | null;
  vendor: string | null;
  catalog_number: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface InventoryLocation {
  id: string;
  name: string;
  description: string | null;
  lab_id: string;
}

export interface InventoryCategory {
  id: string;
  name: string;
  color: string | null;
  lab_id: string;
}

export interface InventoryActivityLog {
  id: string;
  item_id: string;
  actor_id: string | null;
  actor_name: string | null;
  action: 'created' | 'updated' | 'quantity_updated' | 'location_changed' | 'deleted';
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  notes: string | null;
  created_at: string;
}

// ─── Purchase Requests ────────────────────────────────────────────────────────

export type PurchaseRequestStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'ordered'
  | 'received';

export type PurchaseRequestUrgency = 'low' | 'normal' | 'high' | 'critical';

export interface Vendor {
  id: string;
  lab_id: string;
  name: string;
  contact_name: string | null;
  contact_email: string | null;
  website: string | null;
  notes: string | null;
}

export interface PurchaseRequestItem {
  id: string;
  request_id: string;
  inventory_item_id: string | null;
  item_name: string;
  quantity: number;
  unit: string;
  catalog_number: string | null;
  vendor: string | null;
  estimated_unit_price: number | null;
  notes: string | null;
  created_at: string;
}

export interface ProcurementActivityLog {
  id: string;
  request_id: string;
  actor_id: string | null;
  actor_name: string | null;
  action: 'created' | 'submitted' | 'approved' | 'rejected' | 'clarification_requested' | 'ordered' | 'received' | 'edited';
  old_status: string | null;
  new_status: string | null;
  notes: string | null;
  created_at: string;
}

export interface PurchaseRequest {
  id: string;
  lab_id: string;
  title: string;
  description: string | null;
  requester_id: string;
  requester_name: string;
  status: PurchaseRequestStatus;
  urgency: PurchaseRequestUrgency;
  vendor_id: string | null;
  vendor_name: string | null;
  estimated_total: number | null;
  notes: string | null;
  is_suggestion: boolean;
  approved_by: string | null;
  approver_name: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  clarification_note: string | null;
  clarification_requested_at: string | null;
  ordered_at: string | null;
  received_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  item_count?: number;
  items?: PurchaseRequestItem[];
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'completed';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskType = 'operational' | 'lab_maintenance' | 'procurement' | 'onboarding' | 'package_intake' | 'other';

export interface Task {
  id: string;
  lab_id: string;
  org_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  task_type: TaskType;
  assigned_to: string | null;
  assigned_to_name: string | null;
  created_by: string;
  created_by_name: string;
  due_date: string | null;
  completed_at: string | null;
  related_inventory_item_id: string | null;
  related_purchase_request_id: string | null;
  related_package_id: string | null;
  ai_generated: boolean;
  created_at: string;
  updated_at: string;
}

export interface TaskActivityLog {
  id: string;
  task_id: string;
  lab_id: string;
  actor_id: string;
  actor_name: string;
  action: string;
  old_value: string | null;
  new_value: string | null;
  notes: string | null;
  created_at: string;
}

export interface LabMember {
  id: string;
  full_name: string;
  role: Role;
}

// ─── Incoming Packages ────────────────────────────────────────────────────────

export type ExtractionStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface IncomingPackage {
  id: string;
  image_url?: string;
  tracking_number?: string;
  extracted_item_name?: string;
  extracted_vendor?: string;
  extracted_quantity?: number;
  extracted_catalog_number?: string;
  extracted_category?: string;
  extraction_status: ExtractionStatus;
  is_verified: boolean;
  inventory_item_id?: string;
  lab_id: string;
  created_at: string;
}

// ─── Knowledge Base ───────────────────────────────────────────────────────────

export type KBCategory = 'sop' | 'onboarding' | 'safety' | 'equipment' | 'policy';

export interface KBDocument {
  id: string;
  title: string;
  category: KBCategory;
  file_url: string;
  file_type: string;
  uploaded_by: string;
  is_indexed: boolean;
  lab_id: string;
  created_at: string;
}

// ─── Audit Logs ───────────────────────────────────────────────────────────────

export interface AuditLog {
  id: string;
  actor_id: string;
  actor_name?: string;
  actor_role?: string;
  event_type: string;
  resource_type: string;
  resource_id?: string;
  description: string;
  metadata?: Record<string, unknown>;
  lab_id: string;
  created_at: string;
}

// ─── API Response Wrapper ─────────────────────────────────────────────────────

export interface APIResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
}
