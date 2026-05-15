'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Clock, AlertTriangle, ShoppingCart, Package, ChevronRight, CheckCircle2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { hasPermission } from '@/lib/rbac';
import { useProcurement } from '@/hooks/useProcurement';
import { useInventory } from '@/hooks/useInventory';
import { ProcurementStatusBadge } from '@/components/procurement/StatusBadge';
import { UrgencyBadge } from '@/components/procurement/UrgencyBadge';
import type { PurchaseRequest } from '@/types';
import type { InventoryItem } from '@/types';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d < 30 ? `${d}d ago` : new Date(dateStr).toLocaleDateString();
}

function KpiCard({
  label, value, icon, bg, textColor, loading, href, urgent,
}: {
  label: string; value: number; icon: React.ReactNode; bg: string; textColor: string;
  loading: boolean; href: string; urgent?: boolean;
}) {
  return (
    <Link href={href}>
      <div className={`rounded-xl border p-4 hover:shadow-sm transition-all cursor-pointer ${urgent ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'}`}>
        <div className="flex items-center justify-between mb-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${bg}`}>
            {icon}
          </div>
          {urgent && (
            <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
              Action needed
            </span>
          )}
        </div>
        {loading
          ? <Skeleton className="h-7 w-12 mb-1" />
          : <p className={`text-2xl font-bold tabular-nums ${textColor}`}>{value}</p>
        }
        <p className="text-xs text-slate-500 mt-0.5">{label}</p>
      </div>
    </Link>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
      {children}
    </p>
  );
}

function ApprovalRow({ req }: { req: PurchaseRequest }) {
  return (
    <Link href="/purchase-requests">
      <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-slate-50 transition-colors group">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-800 truncate">{req.title}</p>
          <p className="text-xs text-slate-400 mt-0.5">{req.requester_name}</p>
        </div>
        <UrgencyBadge urgency={req.urgency} />
        <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-400 shrink-0" />
      </div>
    </Link>
  );
}

function ReorderRow({ item }: { item: InventoryItem }) {
  const href = `/purchase-requests?action=new&item_name=${encodeURIComponent(item.name)}&unit=${encodeURIComponent(item.unit)}`;
  return (
    <Link href={href}>
      <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-slate-50 transition-colors group">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-800 truncate">{item.name}</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {item.quantity} {item.unit} remaining
            {item.status === 'out_of_stock' && (
              <span className="ml-1.5 text-red-500 font-medium">· Out of stock</span>
            )}
          </p>
        </div>
        <span className="text-xs text-teal-600 font-medium shrink-0 group-hover:underline">
          Reorder
        </span>
      </div>
    </Link>
  );
}

function DraftRow({ req }: { req: PurchaseRequest }) {
  return (
    <Link href="/purchase-requests">
      <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-slate-50 transition-colors group">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-800 truncate">{req.title}</p>
          <p className="text-xs text-slate-400 mt-0.5">Draft · {timeAgo(req.created_at)}</p>
        </div>
        <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-400 shrink-0" />
      </div>
    </Link>
  );
}

export default function DashboardPage() {
  const profile = useUserProfile();
  const { requests, loading: procLoading } = useProcurement();
  const { items, loading: invLoading } = useInventory();
  const loading = procLoading || invLoading;

  const canApprove = hasPermission(profile.role, 'approve_purchase_request', profile.permissions);
  const isStudent = profile.role === 'student';

  const pendingApprovals = useMemo(
    () => requests.filter((r) => r.status === 'pending_approval'),
    [requests],
  );
  const orderedRequests = useMemo(
    () => requests.filter((r) => r.status === 'ordered'),
    [requests],
  );
  const lowStockItems = useMemo(
    () => items.filter((i) => i.status === 'low_stock' || i.status === 'out_of_stock'),
    [items],
  );
  const myDrafts = useMemo(
    () => requests.filter((r) => r.status === 'draft' && r.requester_id === profile.id),
    [requests, profile.id],
  );
  const recentRequests = useMemo(
    () => [...requests]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 6),
    [requests],
  );

  const hasActionItems =
    (canApprove && pendingApprovals.length > 0) ||
    lowStockItems.length > 0 ||
    myDrafts.length > 0;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">
          Operational command center — what needs attention today
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Pending Approvals"
          value={pendingApprovals.length}
          icon={<Clock className="w-4.5 h-4.5 text-amber-600" />}
          bg="bg-amber-100"
          textColor="text-amber-700"
          loading={loading}
          href="/purchase-requests"
          urgent={canApprove && pendingApprovals.length > 0}
        />
        <KpiCard
          label="Low Stock Items"
          value={lowStockItems.length}
          icon={<AlertTriangle className="w-4.5 h-4.5 text-red-500" />}
          bg="bg-red-100"
          textColor={lowStockItems.length > 0 ? 'text-red-600' : 'text-slate-700'}
          loading={loading}
          href="/inventory"
        />
        <KpiCard
          label="Orders In Transit"
          value={orderedRequests.length}
          icon={<ShoppingCart className="w-4.5 h-4.5 text-blue-600" />}
          bg="bg-blue-100"
          textColor="text-blue-700"
          loading={loading}
          href="/purchase-requests"
        />
        <KpiCard
          label="Inventory Items"
          value={items.length}
          icon={<Package className="w-4.5 h-4.5 text-teal-600" />}
          bg="bg-teal-100"
          textColor="text-teal-700"
          loading={loading}
          href="/inventory"
        />
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Action queue */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-700">Action Queue</h2>
            {!isStudent && (
              <Link href="/purchase-requests?action=new">
                <span className="text-xs text-teal-600 hover:text-teal-700 font-medium">
                  + New Request
                </span>
              </Link>
            )}
          </div>

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
            </div>
          ) : !hasActionItems ? (
            <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              <p className="text-sm text-slate-500 font-medium">All clear!</p>
              <p className="text-xs text-slate-400">No pending actions right now.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {canApprove && pendingApprovals.length > 0 && (
                <div>
                  <SectionHeading>Awaiting Approval ({pendingApprovals.length})</SectionHeading>
                  <div className="-mx-1">
                    {pendingApprovals.slice(0, 4).map((req) => (
                      <ApprovalRow key={req.id} req={req} />
                    ))}
                    {pendingApprovals.length > 4 && (
                      <Link href="/purchase-requests">
                        <p className="text-xs text-teal-600 hover:underline px-3 py-1.5">
                          +{pendingApprovals.length - 4} more
                        </p>
                      </Link>
                    )}
                  </div>
                </div>
              )}

              {lowStockItems.length > 0 && (
                <div>
                  <SectionHeading>Low Stock — Reorder ({lowStockItems.length})</SectionHeading>
                  <div className="-mx-1">
                    {lowStockItems.slice(0, 4).map((item) => (
                      <ReorderRow key={item.id} item={item} />
                    ))}
                    {lowStockItems.length > 4 && (
                      <Link href="/inventory">
                        <p className="text-xs text-teal-600 hover:underline px-3 py-1.5">
                          +{lowStockItems.length - 4} more in inventory
                        </p>
                      </Link>
                    )}
                  </div>
                </div>
              )}

              {myDrafts.length > 0 && (
                <div>
                  <SectionHeading>My Drafts ({myDrafts.length})</SectionHeading>
                  <div className="-mx-1">
                    {myDrafts.slice(0, 3).map((req) => (
                      <DraftRow key={req.id} req={req} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Recent requests */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-700">Recent Requests</h2>
            <Link href="/purchase-requests">
              <span className="text-xs text-teal-600 hover:text-teal-700 font-medium">View all</span>
            </Link>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
            </div>
          ) : recentRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
              <p className="text-sm text-slate-400">No requests yet.</p>
              {!isStudent && (
                <Link href="/purchase-requests?action=new">
                  <span className="text-xs text-teal-600 hover:underline font-medium">Create your first request</span>
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {recentRequests.map((req) => (
                <Link key={req.id} href="/purchase-requests">
                  <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-slate-50 transition-colors group">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{req.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {req.requester_name} · {timeAgo(req.created_at)}
                      </p>
                    </div>
                    <ProcurementStatusBadge status={req.status} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
