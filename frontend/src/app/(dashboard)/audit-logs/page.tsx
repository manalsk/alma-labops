'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Search, Filter, ChevronDown, X, Clock, Bot, Shield, Database,
  CheckCircle2, AlertCircle, XCircle, Info, RefreshCw,
} from 'lucide-react';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { hasPermission } from '@/lib/rbac';
import { useAuditLogs } from '@/hooks/useAuditLogs';
import type { AuditLog, AIAuditLog } from '@/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTs(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  inventory_created: 'Inventory Created',
  inventory_updated: 'Inventory Updated',
  inventory_deleted: 'Inventory Deleted',
  task_created: 'Task Created',
  task_updated: 'Task Updated',
  task_completed: 'Task Completed',
  purchase_request_created: 'PR Created',
  purchase_request_approved: 'PR Approved',
  purchase_request_rejected: 'PR Rejected',
  package_uploaded: 'Package Uploaded',
  package_verified: 'Package Verified',
  package_rejected: 'Package Rejected',
  kb_document_uploaded: 'KB Doc Uploaded',
  kb_document_deleted: 'KB Doc Deleted',
};

const ACTOR_ROLE_COLORS: Record<string, string> = {
  pi: 'bg-purple-100 text-purple-700',
  researcher: 'bg-blue-100 text-blue-700',
  student: 'bg-green-100 text-green-700',
  system: 'bg-slate-100 text-slate-600',
};

const AI_STATUS_CONFIG: Record<string, { icon: React.ReactNode; cls: string; label: string }> = {
  success: {
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    cls: 'text-green-600 bg-green-50',
    label: 'Success',
  },
  error: {
    icon: <XCircle className="w-3.5 h-3.5" />,
    cls: 'text-red-600 bg-red-50',
    label: 'Error',
  },
  blocked: {
    icon: <AlertCircle className="w-3.5 h-3.5" />,
    cls: 'text-amber-600 bg-amber-50',
    label: 'Blocked',
  },
};

// ─── Badges ───────────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role?: string }) {
  if (!role) return <span className="text-slate-400 text-xs">—</span>;
  const cls = ACTOR_ROLE_COLORS[role] ?? 'bg-slate-100 text-slate-600';
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${cls}`}>{role}</span>;
}

function StatusBadge({ status }: { status: 'success' | 'error' | 'blocked' }) {
  const cfg = AI_STATUS_CONFIG[status] ?? AI_STATUS_CONFIG.success;
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${cfg.cls}`}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

// ─── Detail Drawer ────────────────────────────────────────────────────────────

function OpLogDrawer({ log, onClose }: { log: AuditLog; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 w-110 bg-white border-l border-slate-200 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-semibold text-slate-800">Event Details</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-200 transition-colors">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Description</p>
            <p className="text-sm text-slate-800 leading-relaxed">{log.description}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Event Type</p>
              <p className="text-sm text-slate-700 font-medium">
                {EVENT_TYPE_LABELS[log.event_type] ?? log.event_type}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Resource</p>
              <p className="text-sm text-slate-700 font-medium capitalize">{log.resource_type}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Actor Role</p>
              <RoleBadge role={log.actor_role} />
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Timestamp</p>
              <p className="text-sm text-slate-700">{formatTs(log.created_at)}</p>
            </div>
          </div>

          {log.resource_id && (
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Resource ID</p>
              <p className="text-xs font-mono text-slate-600 break-all bg-slate-50 rounded px-2 py-1.5">
                {log.resource_id}
              </p>
            </div>
          )}

          {log.actor_id && (
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Actor ID</p>
              <p className="text-xs font-mono text-slate-600 break-all bg-slate-50 rounded px-2 py-1.5">
                {log.actor_id}
              </p>
            </div>
          )}

          {log.metadata && Object.keys(log.metadata).length > 0 && (
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Metadata</p>
              <pre className="text-xs text-slate-600 bg-slate-50 rounded p-3 overflow-x-auto">
                {JSON.stringify(log.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function AILogDrawer({ log, onClose }: { log: AIAuditLog; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 w-110 bg-white border-l border-slate-200 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-semibold text-slate-800">AI Interaction Details</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-200 transition-colors">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Prompt</p>
            <p className="text-sm text-slate-800 leading-relaxed bg-slate-50 rounded p-3">{log.prompt}</p>
          </div>

          {log.response_summary && (
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Response Summary</p>
              <p className="text-sm text-slate-700 leading-relaxed">{log.response_summary}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Status</p>
              <StatusBadge status={log.status} />
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">User Role</p>
              <RoleBadge role={log.user_role ?? undefined} />
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Model</p>
              <p className="text-sm text-slate-700 font-mono">{log.model_used}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Tokens Used</p>
              <p className="text-sm text-slate-700">{log.tokens_used ?? '—'}</p>
            </div>
            {log.tool_called && (
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Tool Called</p>
                <p className="text-sm text-slate-700 font-mono">{log.tool_called}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Timestamp</p>
              <p className="text-sm text-slate-700">{formatTs(log.created_at)}</p>
            </div>
          </div>

          {log.metadata && Object.keys(log.metadata).length > 0 && (
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Metadata</p>
              <pre className="text-xs text-slate-600 bg-slate-50 rounded p-3 overflow-x-auto">
                {JSON.stringify(log.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Operational Logs Table ───────────────────────────────────────────────────

function OpLogsTab() {
  const { fetchLogs } = useAuditLogs();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AuditLog | null>(null);

  const [search, setSearch] = useState('');
  const [eventType, setEventType] = useState('');
  const [actorRole, setActorRole] = useState('');
  const [resourceType, setResourceType] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchLogs({
        search: search || undefined,
        event_type: eventType || undefined,
        actor_role: actorRole || undefined,
        resource_type: resourceType || undefined,
        limit: 100,
      });
      setLogs(res.data);
    } catch { /* error handled silently */ }
    finally { setLoading(false); }
  }, [search, eventType, actorRole, resourceType]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const hasFilters = search || eventType || actorRole || resourceType;

  function clearFilters() {
    setSearch('');
    setEventType('');
    setActorRole('');
    setResourceType('');
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search descriptions…"
            className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-300 bg-white"
          />
        </div>

        <div className="relative">
          <select
            value={actorRole}
            onChange={(e) => setActorRole(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-300 text-slate-700"
          >
            <option value="">All roles</option>
            <option value="pi">PI</option>
            <option value="researcher">Researcher</option>
            <option value="student">Student</option>
            <option value="system">System</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        </div>

        <div className="relative">
          <select
            value={resourceType}
            onChange={(e) => setResourceType(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-300 text-slate-700"
          >
            <option value="">All resources</option>
            <option value="inventory_item">Inventory</option>
            <option value="task">Tasks</option>
            <option value="purchase_request">Procurement</option>
            <option value="incoming_package">Packages</option>
            <option value="kb_document">Knowledge Base</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        </div>

        <button
          onClick={load}
          className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
        </button>

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-3 h-3" /> Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {loading ? (
          <div className="p-8 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center">
            <Filter className="w-8 h-8 text-slate-200 mx-auto mb-3" />
            <p className="text-sm text-slate-400">
              {hasFilters ? 'No events match these filters.' : 'No audit log entries yet.'}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60">
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Timestamp</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Description</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Resource</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Actor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((log) => (
                <tr
                  key={log.id}
                  onClick={() => setSelected(log)}
                  className="hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    <p className="text-xs text-slate-700">{formatTs(log.created_at)}</p>
                    <p className="text-xs text-slate-400">{timeAgo(log.created_at)}</p>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <p className="text-slate-800 truncate">{log.description}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {EVENT_TYPE_LABELS[log.event_type] ?? log.event_type}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full capitalize">
                      {log.resource_type?.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <RoleBadge role={log.actor_role} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selected && <OpLogDrawer log={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

// ─── AI Interaction Logs Table ────────────────────────────────────────────────

function AILogsTab() {
  const { fetchAILogs } = useAuditLogs();
  const [logs, setLogs] = useState<AIAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AIAuditLog | null>(null);

  const [toolFilter, setToolFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchAILogs({
        tool_called: toolFilter || undefined,
        status: statusFilter || undefined,
        limit: 100,
      });
      setLogs(res.data);
    } catch { /* error handled silently */ }
    finally { setLoading(false); }
  }, [toolFilter, statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const hasFilters = toolFilter || statusFilter;

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative">
          <select
            value={toolFilter}
            onChange={(e) => setToolFilter(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-300 text-slate-700"
          >
            <option value="">All tools</option>
            <option value="vision_extraction">Vision Extraction</option>
            <option value="rag_assistant">RAG Assistant</option>
            <option value="copilot">Copilot</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        </div>

        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-300 text-slate-700"
          >
            <option value="">All statuses</option>
            <option value="success">Success</option>
            <option value="error">Error</option>
            <option value="blocked">Blocked</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        </div>

        <button
          onClick={load}
          className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
        </button>

        {hasFilters && (
          <button
            onClick={() => { setToolFilter(''); setStatusFilter(''); }}
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-3 h-3" /> Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {loading ? (
          <div className="p-8 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center">
            <Bot className="w-8 h-8 text-slate-200 mx-auto mb-3" />
            <p className="text-sm text-slate-400">
              {hasFilters ? 'No AI interactions match these filters.' : 'No AI interaction logs yet.'}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60">
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Timestamp</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Prompt</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Tool</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Role</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Tokens</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((log) => (
                <tr
                  key={log.id}
                  onClick={() => setSelected(log)}
                  className="hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    <p className="text-xs text-slate-700">{formatTs(log.created_at)}</p>
                    <p className="text-xs text-slate-400">{timeAgo(log.created_at)}</p>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <p className="text-slate-800 truncate text-sm">{log.prompt}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                      {log.tool_called ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={log.status} />
                  </td>
                  <td className="px-4 py-3">
                    <RoleBadge role={log.user_role ?? undefined} />
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-slate-500">
                    {log.tokens_used ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selected && <AILogDrawer log={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AuditLogsPage() {
  const profile = useUserProfile();
  const [activeTab, setActiveTab] = useState<'operational' | 'ai'>('operational');

  const canViewLogs =
    profile.role === 'pi' ||
    hasPermission(profile.role, 'view_audit_logs', profile.permissions);

  if (!canViewLogs) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-4">
          <Shield className="w-6 h-6 text-slate-400" />
        </div>
        <h2 className="text-lg font-semibold text-slate-800 mb-1">Access Restricted</h2>
        <p className="text-sm text-slate-500 max-w-xs">
          Audit logs are only accessible to the PI or researchers granted access by the PI.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Audit Logs</h1>
        <p className="text-slate-500 text-sm mt-1">
          Operational history, traceability, and AI interaction records
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('operational')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            activeTab === 'operational'
              ? 'border-slate-800 text-slate-800'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          Operational Events
        </button>
        <button
          onClick={() => setActiveTab('ai')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            activeTab === 'ai'
              ? 'border-slate-800 text-slate-800'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Bot className="w-3.5 h-3.5" />
          AI Interactions
        </button>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 mb-5">
        <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        <p className="text-xs text-slate-500 leading-relaxed">
          {activeTab === 'operational'
            ? 'All create, update, and delete actions across inventory, tasks, packages, and procurement are recorded here.'
            : 'Every AI tool call — Vision extraction, KB RAG queries, and Copilot interactions — is logged with model, token usage, and status.'}
        </p>
      </div>

      {activeTab === 'operational' ? <OpLogsTab /> : <AILogsTab />}
    </div>
  );
}
