'use client';

import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Plus, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { hasPermission } from '@/lib/rbac';
import { useProcurement } from '@/hooks/useProcurement';
import { ProcurementFilters } from '@/components/procurement/ProcurementFilters';
import { ProcurementTable } from '@/components/procurement/ProcurementTable';
import { ProcurementDrawer } from '@/components/procurement/ProcurementDrawer';
import { RequestFormDialog } from '@/components/procurement/RequestFormDialog';
import { ApprovalActionDialog } from '@/components/procurement/ApprovalActionDialog';
import type { PurchaseRequest } from '@/types';
import type { CreateRequestPayload, UpdateRequestPayload } from '@/hooks/useProcurement';

export default function PurchaseRequestsPage() {
  const profile = useUserProfile();
  const searchParams = useSearchParams();
  const {
    requests, vendors, loading, error,
    createRequest, updateRequest, submitRequest,
    approveRequest, rejectRequest, requestClarification,
    markOrdered, markReceived, deleteRequest, fetchActivity,
  } = useProcurement();

  const canApprove = hasPermission(profile.role, 'approve_purchase_request', profile.permissions);
  const canViewFinancials = hasPermission(profile.role, 'view_financial_summary', profile.permissions) || profile.role === 'pi';
  const isStudent = profile.role === 'student';

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [urgencyFilter, setUrgencyFilter] = useState('all');
  const [vendorFilter, setVendorFilter] = useState('all');

  // UI state
  const [selectedRequest, setSelectedRequest] = useState<PurchaseRequest | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState<PurchaseRequest | null>(null);
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject' | 'clarification' | null>(null);
  const [actionTarget, setActionTarget] = useState<PurchaseRequest | null>(null);

  // Pre-fill from URL params (e.g. coming from inventory reorder)
  const prefillItemName = searchParams?.get('item_name') ?? undefined;
  const prefillUnit = searchParams?.get('unit') ?? undefined;
  useEffect(() => {
    if (searchParams?.get('action') === 'new') {
      setEditingRequest(null);
      setFormOpen(true);
    }
  }, []);

  const pendingCount = useMemo(
    () => requests.filter((r) => r.status === 'pending_approval').length,
    [requests]
  );

  const filtered = useMemo(() => {
    return requests.filter((req) => {
      if (search) {
        const q = search.toLowerCase();
        if (
          !req.title.toLowerCase().includes(q) &&
          !req.requester_name.toLowerCase().includes(q) &&
          !(req.vendor_name ?? '').toLowerCase().includes(q)
        ) return false;
      }
      if (statusFilter !== 'all' && req.status !== statusFilter) return false;
      if (urgencyFilter !== 'all' && req.urgency !== urgencyFilter) return false;
      if (vendorFilter !== 'all' && req.vendor_id !== vendorFilter) return false;
      return true;
    });
  }, [requests, search, statusFilter, urgencyFilter, vendorFilter]);

  const handleRowClick = (req: PurchaseRequest) => {
    setSelectedRequest(req);
    setDrawerOpen(true);
  };

  const handleFormSubmit = async (data: CreateRequestPayload | UpdateRequestPayload, submitNow: boolean) => {
    try {
      if (editingRequest) {
        const updated = await updateRequest(editingRequest.id, data as UpdateRequestPayload);
        if (submitNow && updated.status === 'draft') {
          await submitRequest(editingRequest.id);
        }
        toast.success('Request updated');
        if (selectedRequest?.id === editingRequest.id) setSelectedRequest(updated);
      } else {
        const payload = { ...(data as CreateRequestPayload), submit: submitNow };
        await createRequest(payload);
        toast.success(submitNow ? 'Request submitted for approval' : 'Request saved as draft');
      }
    } catch {
      toast.error(editingRequest ? 'Failed to update request' : 'Failed to create request');
      throw new Error('Form submit failed');
    }
  };

  const handleApprovalConfirm = async (notes: string) => {
    if (!actionTarget || !approvalAction) return;
    try {
      let updated: PurchaseRequest;
      if (approvalAction === 'approve') {
        updated = await approveRequest(actionTarget.id, notes || undefined);
        toast.success('Request approved');
      } else if (approvalAction === 'reject') {
        updated = await rejectRequest(actionTarget.id, notes || undefined);
        toast.success('Request rejected');
      } else {
        updated = await requestClarification(actionTarget.id, notes);
        toast.success('Clarification requested');
      }
      if (selectedRequest?.id === actionTarget.id) setSelectedRequest(updated);
    } catch {
      toast.error('Action failed');
      throw new Error('Approval action failed');
    }
  };

  const handleSubmitDraft = async (req: PurchaseRequest) => {
    try {
      const updated = await submitRequest(req.id);
      toast.success('Request submitted for approval');
      if (selectedRequest?.id === req.id) setSelectedRequest(updated);
    } catch { toast.error('Failed to submit request'); }
  };

  const handleMarkOrdered = async (req: PurchaseRequest) => {
    try {
      const updated = await markOrdered(req.id);
      toast.success('Marked as ordered');
      if (selectedRequest?.id === req.id) setSelectedRequest(updated);
    } catch { toast.error('Failed to update status'); }
  };

  const handleMarkReceived = async (req: PurchaseRequest) => {
    try {
      const updated = await markReceived(req.id);
      toast.success('Marked as received', {
        description: 'Remember to update inventory quantities for the items received.',
      });
      if (selectedRequest?.id === req.id) setSelectedRequest(updated);
    } catch { toast.error('Failed to update status'); }
  };

  const handleDelete = async (req: PurchaseRequest) => {
    if (!confirm(`Delete "${req.title}"? This cannot be undone.`)) return;
    try {
      await deleteRequest(req.id);
      toast.success('Request deleted');
      setDrawerOpen(false);
      setSelectedRequest(null);
    } catch { toast.error('Failed to delete request'); }
  };

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Purchase Requests</h1>
          <p className="text-slate-500 text-sm mt-1">
            Manage procurement requests and approval workflows
          </p>
        </div>
        <Button
          onClick={() => { setEditingRequest(null); setFormOpen(true); }}
          className="h-9 bg-teal-600 hover:bg-teal-700 text-white gap-2 shrink-0"
        >
          <Plus className="w-4 h-4" />
          {isStudent ? 'New Suggestion' : 'New Request'}
        </Button>
      </div>

      {/* Pending approvals banner — PI */}
      {canApprove && !loading && pendingCount > 0 && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <Clock className="w-4 h-4 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800">
            <span className="font-semibold">{pendingCount} request{pendingCount !== 1 ? 's' : ''}</span>
            {' '}awaiting your approval.
          </p>
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'pending_approval' ? 'all' : 'pending_approval')}
            className="ml-auto text-xs font-medium text-amber-700 hover:text-amber-900 underline underline-offset-2"
          >
            {statusFilter === 'pending_approval' ? 'Show all' : 'Show only'}
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Filters */}
      <ProcurementFilters
        search={search} onSearchChange={setSearch}
        statusFilter={statusFilter} onStatusChange={setStatusFilter}
        urgencyFilter={urgencyFilter} onUrgencyChange={setUrgencyFilter}
        vendorFilter={vendorFilter} onVendorChange={setVendorFilter}
        vendors={vendors}
      />

      {/* Count */}
      {!loading && (
        <p className="text-xs text-slate-400">
          Showing {filtered.length} of {requests.length} request{requests.length !== 1 ? 's' : ''}
        </p>
      )}

      {/* Table */}
      <ProcurementTable
        requests={filtered}
        loading={loading}
        onRowClick={handleRowClick}
        canViewFinancials={canViewFinancials}
      />

      {/* Detail drawer */}
      <ProcurementDrawer
        request={selectedRequest}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onEdit={(req) => { setEditingRequest(req); setFormOpen(true); }}
        onDelete={handleDelete}
        onApprove={(req) => { setActionTarget(req); setApprovalAction('approve'); }}
        onReject={(req) => { setActionTarget(req); setApprovalAction('reject'); }}
        onClarification={(req) => { setActionTarget(req); setApprovalAction('clarification'); }}
        onSubmit={handleSubmitDraft}
        onMarkOrdered={handleMarkOrdered}
        onMarkReceived={handleMarkReceived}
        canApprove={canApprove}
        canViewFinancials={canViewFinancials}
        currentUserId={profile.id}
        currentUserRole={profile.role}
        fetchActivity={fetchActivity}
      />

      {/* Create / Edit form */}
      <RequestFormDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingRequest(null); }}
        onSubmit={handleFormSubmit}
        vendors={vendors}
        request={editingRequest}
        isStudent={isStudent}
        prefillItemName={prefillItemName}
        prefillUnit={prefillUnit}
      />

      {/* Approval action dialog */}
      <ApprovalActionDialog
        open={!!approvalAction}
        action={approvalAction}
        onClose={() => { setApprovalAction(null); setActionTarget(null); }}
        onConfirm={handleApprovalConfirm}
      />
    </div>
  );
}
