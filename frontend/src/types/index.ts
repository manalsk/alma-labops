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
  name: string;
  category: string;
  quantity: number;
  unit: string;
  location_id: string;
  location_name?: string;
  threshold: number;
  status: InventoryStatus;
  vendor?: string;
  catalog_number?: string;
  notes?: string;
  lab_id: string;
  created_at: string;
  updated_at: string;
}

export interface InventoryLocation {
  id: string;
  name: string;
  description?: string;
  lab_id: string;
}

// ─── Purchase Requests ────────────────────────────────────────────────────────

export type PurchaseRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'clarification_needed';

export type Priority = 'low' | 'medium' | 'high';

export type AIFlagType = 'duplicate' | 'in_stock' | 'vendor_warning' | 'low_priority';

export interface AIFlag {
  type: AIFlagType;
  message: string;
}

export interface PurchaseRequest {
  id: string;
  item_name: string;
  quantity: number;
  unit: string;
  vendor?: string;
  estimated_cost?: number;
  justification: string;
  status: PurchaseRequestStatus;
  priority: Priority;
  requester_id: string;
  requester_name?: string;
  ai_flags?: AIFlag[];
  lab_id: string;
  created_at: string;
  updated_at: string;
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'completed';

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: Priority;
  assigned_to?: string;
  assigned_to_name?: string;
  due_date?: string;
  is_ai_generated: boolean;
  related_package_id?: string;
  lab_id: string;
  created_at: string;
  updated_at: string;
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
