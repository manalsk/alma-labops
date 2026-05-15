'use client';

import { useState, useMemo } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { hasPermission } from '@/lib/rbac';
import { usePackages } from '@/hooks/usePackages';
import { useTasks } from '@/hooks/useTasks';
import { PackageTable } from '@/components/packages/PackageTable';
import { PackageFilters } from '@/components/packages/PackageFilters';
import { PackageDrawer } from '@/components/packages/PackageDrawer';
import { PackageUploadDialog } from '@/components/packages/PackageUploadDialog';
import type { IncomingPackage } from '@/types';
import type { VerifyExtractionPayload, CreateInventoryPayload, CreateTaskPayload } from '@/hooks/usePackages';

export default function IncomingPackagesPage() {
  const profile = useUserProfile();
  const {
    packages, loading, uploadPackage,
    runExtraction, verifyExtraction, rejectExtraction,
    createInventory, createTask, markProcessed, fetchActivity,
  } = usePackages();
  const { members } = useTasks();

  const [selectedPkg, setSelectedPkg] = useState<IncomingPackage | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [reviewFilter, setReviewFilter] = useState('all');
  const [extractionFilter, setExtractionFilter] = useState('all');

  const canUpload = profile.role === 'pi' || profile.role === 'researcher' || profile.role === 'student';
  const canVerify = profile.role === 'pi' || profile.role === 'researcher';
  const canCreateInventory = hasPermission(profile.role, 'manage_inventory', profile.permissions) || profile.role === 'pi';
  const canCreateTask = hasPermission(profile.role, 'assign_tasks', profile.permissions) || profile.role === 'pi' || profile.role === 'researcher';
  const canMarkProcessed = profile.role === 'pi' || profile.role === 'researcher';

  const filteredPackages = useMemo(() => {
    let list = packages;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) =>
        p.extracted_item_name?.toLowerCase().includes(q) ||
        p.extracted_vendor?.toLowerCase().includes(q) ||
        p.extracted_catalog_number?.toLowerCase().includes(q) ||
        p.uploaded_by_name?.toLowerCase().includes(q),
      );
    }
    if (reviewFilter !== 'all') {
      list = list.filter((p) => p.review_status === reviewFilter);
    }
    if (extractionFilter !== 'all') {
      list = list.filter((p) => p.extraction_status === extractionFilter);
    }
    return list;
  }, [packages, search, reviewFilter, extractionFilter]);

  const pendingCount = useMemo(
    () => packages.filter((p) => p.review_status === 'pending' && p.extraction_status === 'completed').length,
    [packages],
  );

  function openDrawer(pkg: IncomingPackage) {
    setSelectedPkg(pkg);
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setSelectedPkg(null);
  }

  async function handleRunExtraction(id: string, mode: 'mocked' | 'live') {
    const updated = await runExtraction(id, mode);
    setSelectedPkg(updated);
  }

  async function handleVerify(id: string, payload: VerifyExtractionPayload) {
    const updated = await verifyExtraction(id, payload);
    setSelectedPkg(updated);
  }

  async function handleReject(id: string) {
    const updated = await rejectExtraction(id);
    setSelectedPkg(updated);
  }

  async function handleCreateInventory(id: string, payload: CreateInventoryPayload) {
    const updated = await createInventory(id, payload);
    setSelectedPkg(updated);
  }

  async function handleCreateTask(id: string, payload: CreateTaskPayload) {
    const updated = await createTask(id, payload);
    setSelectedPkg(updated);
  }

  async function handleMarkProcessed(id: string) {
    const updated = await markProcessed(id);
    setSelectedPkg(updated);
  }

  async function handleUpload(file: File) {
    const pkg = await uploadPackage(file);
    openDrawer(pkg);
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Incoming Packages</h1>
          <p className="text-slate-500 text-sm mt-1">
            AI-assisted package intake — upload images, extract metadata, create inventory
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {pendingCount > 0 && (
            <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full">
              {pendingCount} awaiting review
            </span>
          )}
          {canUpload && (
            <Button size="sm" className="gap-1.5" onClick={() => setUploadOpen(true)}>
              <Upload className="w-3.5 h-3.5" />
              Upload Package
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <PackageFilters
        search={search}
        onSearchChange={setSearch}
        reviewFilter={reviewFilter}
        onReviewChange={setReviewFilter}
        extractionFilter={extractionFilter}
        onExtractionChange={setExtractionFilter}
      />

      {/* Table */}
      <PackageTable
        packages={filteredPackages}
        loading={loading}
        onRowClick={openDrawer}
      />

      {/* Drawer */}
      <PackageDrawer
        pkg={selectedPkg}
        open={drawerOpen}
        onClose={closeDrawer}
        onRunExtraction={handleRunExtraction}
        onVerify={handleVerify}
        onReject={handleReject}
        onCreateInventory={handleCreateInventory}
        onCreateTask={handleCreateTask}
        onMarkProcessed={handleMarkProcessed}
        fetchActivity={fetchActivity}
        members={members}
        canVerify={canVerify}
        canCreateInventory={canCreateInventory}
        canCreateTask={canCreateTask}
        canMarkProcessed={canMarkProcessed}
      />

      {/* Upload dialog */}
      <PackageUploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUpload={handleUpload}
      />
    </div>
  );
}
