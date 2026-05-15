'use client';

import { useState, useEffect } from 'react';
import {
  Shield, Users, Bot, Package, FlaskConical, BookOpen,
  CheckCircle2, Cpu, Key,
} from 'lucide-react';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { createClient } from '@/lib/supabase/client';
import { apiClient } from '@/lib/api/client';
import type { LabMember } from '@/types';

// ─── Role badge ───────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
  pi: 'bg-purple-100 text-purple-700',
  researcher: 'bg-blue-100 text-blue-700',
  student: 'bg-green-100 text-green-700',
};

function RoleBadge({ role }: { role: string }) {
  const cls = ROLE_COLORS[role] ?? 'bg-slate-100 text-slate-600';
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${cls}`}>
      {role === 'pi' ? 'PI' : role}
    </span>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  icon, title, description, children,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-start gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50/60">
        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800">{title}</p>
          {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ─── Read-only field ──────────────────────────────────────────────────────────

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <p className="w-40 shrink-0 text-xs text-slate-500 pt-0.5">{label}</p>
      <p className={`text-sm text-slate-800 ${mono ? 'font-mono text-xs break-all' : ''}`}>{value}</p>
    </div>
  );
}

// ─── Lab Info section ─────────────────────────────────────────────────────────

function LabInfoSection() {
  const profile = useUserProfile();
  return (
    <Section
      icon={<FlaskConical className="w-4 h-4 text-slate-600" />}
      title="Lab Information"
      description="Read-only system identifiers for this lab."
    >
      <div className="space-y-3">
        <Field label="Lab ID" value={profile.lab_id} mono />
        <Field label="Organisation ID" value={profile.org_id} mono />
        <Field label="Your email" value={profile.email} />
        <Field label="Your name" value={profile.full_name} />
        <div className="flex items-start gap-3">
          <p className="w-40 shrink-0 text-xs text-slate-500 pt-0.5">Your role</p>
          <RoleBadge role={profile.role} />
        </div>
      </div>
    </Section>
  );
}

// ─── Team Members section ─────────────────────────────────────────────────────

async function getToken(): Promise<string> {
  const { data: { session } } = await createClient().auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');
  return session.access_token;
}

function TeamMembersSection() {
  const [members, setMembers] = useState<LabMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        const res = await apiClient.get<{ data: LabMember[] }>('/api/v1/auth/members', token);
        setMembers(res.data);
      } catch { /* silent */ }
      finally { setLoading(false); }
    })();
  }, []);

  const toggleAuditAccess = async (member: LabMember) => {
    const hasAccess = (member.permissions ?? []).includes('view_audit_logs');

    // Optimistic update — flip the permission in local state immediately
    setMembers((prev) =>
      prev.map((m) => {
        if (m.id !== member.id) return m;
        const perms = m.permissions ?? [];
        return {
          ...m,
          permissions: hasAccess
            ? perms.filter((p) => p !== 'view_audit_logs')
            : [...perms, 'view_audit_logs'],
        };
      })
    );

    setToggling(member.id);
    try {
      const token = await getToken();
      if (hasAccess) {
        await apiClient.delete(`/api/v1/auth/members/${member.id}/permissions/view_audit_logs`, token);
      } else {
        await apiClient.post(
          `/api/v1/auth/members/${member.id}/permissions`,
          { permission_name: 'view_audit_logs' },
          token,
        );
      }
    } catch {
      // Revert optimistic update on failure
      setMembers((prev) =>
        prev.map((m) => {
          if (m.id !== member.id) return m;
          const perms = m.permissions ?? [];
          return {
            ...m,
            permissions: hasAccess
              ? [...perms, 'view_audit_logs']
              : perms.filter((p) => p !== 'view_audit_logs'),
          };
        })
      );
    } finally {
      setToggling(null);
    }
  };

  const researchers = members.filter((m) => m.role === 'researcher');
  const others = members.filter((m) => m.role !== 'researcher');

  return (
    <Section
      icon={<Users className="w-4 h-4 text-slate-600" />}
      title="Team Members"
      description="All active members in this lab. Grant researchers access to audit logs."
    >
      {loading ? (
        <div className="flex items-center justify-center py-6">
          <div className="w-4 h-4 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
        </div>
      ) : members.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-4">No members found.</p>
      ) : (
        <div className="space-y-1">
          {/* Researchers — with audit log toggle */}
          {researchers.length > 0 && (
            <>
              <p className="text-xs text-slate-400 uppercase tracking-wide pb-1">Researchers</p>
              {researchers.map((m) => {
                const hasAccess = (m.permissions ?? []).includes('view_audit_logs');
                const isToggling = toggling === m.id;
                return (
                  <div key={m.id} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center">
                        <span className="text-xs font-medium text-slate-600">
                          {m.full_name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm text-slate-800">{m.full_name}</p>
                        {hasAccess && (
                          <p className="text-xs text-teal-600 mt-0.5">Can view audit logs</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <RoleBadge role={m.role} />
                      <button
                        onClick={() => toggleAuditAccess(m)}
                        disabled={isToggling}
                        title={hasAccess ? 'Revoke audit log access' : 'Grant audit log access'}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
                          hasAccess ? 'bg-teal-500' : 'bg-slate-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                            hasAccess ? 'translate-x-5' : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {/* PI and students — no toggle */}
          {others.length > 0 && (
            <>
              {researchers.length > 0 && <div className="pt-2" />}
              <p className="text-xs text-slate-400 uppercase tracking-wide pb-1">Other members</p>
              {others.map((m) => (
                <div key={m.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center">
                      <span className="text-xs font-medium text-slate-600">
                        {m.full_name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm text-slate-800">{m.full_name}</p>
                  </div>
                  <RoleBadge role={m.role} />
                </div>
              ))}
            </>
          )}

          <p className="text-xs text-slate-400 pt-2">{members.length} member{members.length !== 1 ? 's' : ''} total</p>
        </div>
      )}
    </Section>
  );
}

// ─── AI Configuration section ─────────────────────────────────────────────────

function AIConfigSection() {
  return (
    <Section
      icon={<Bot className="w-4 h-4 text-slate-600" />}
      title="AI Configuration"
      description="Models and settings for AI-powered features."
    >
      <div className="space-y-4">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Models in use</p>
          <div className="space-y-2">
            {[
              { label: 'Vision Extraction (Package Intake)', model: 'gpt-4.1-mini', badge: 'multimodal' },
              { label: 'Knowledge Base RAG Assistant', model: 'gpt-4.1-mini', badge: 'text + retrieval' },
              { label: 'Operational Copilot', model: 'gpt-4.1-mini', badge: 'text' },
              { label: 'KB Embeddings', model: 'text-embedding-3-small', badge: '1536 dims' },
            ].map(({ label, model, badge }) => (
              <div key={label} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                <p className="text-sm text-slate-700">{label}</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{badge}</span>
                  <span className="text-xs font-mono text-slate-600">{model}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-1">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">API Key</p>
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
            <Key className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <p className="text-xs text-slate-500">
              Stored in <code className="font-mono">backend/.env</code> — never exposed to the browser or frontend.
            </p>
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Safety constraints</p>
          <div className="space-y-1.5">
            {[
              'RAG answers only from approved KB documents — no general knowledge',
              'Copilot cannot approve, reject, create, or modify records',
              'AI calls only triggered by explicit user action',
              'RBAC enforced before retrieval and generation',
            ].map((rule) => (
              <div key={rule} className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-600">{rule}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}

// ─── Inventory Settings section ───────────────────────────────────────────────

function InventorySection() {
  return (
    <Section
      icon={<Package className="w-4 h-4 text-slate-600" />}
      title="Inventory Settings"
      description="How stock levels and alerts are computed."
    >
      <div className="space-y-3">
        {[
          { label: 'Low stock trigger', value: 'quantity ≤ threshold (per item)' },
          { label: 'Out-of-stock trigger', value: 'quantity = 0' },
          { label: 'Threshold default', value: '0 (disabled — set per item)' },
          { label: 'Max items fetched by Copilot', value: '30 items per query' },
        ].map(({ label, value }) => (
          <Field key={label} label={label} value={value} />
        ))}
      </div>
    </Section>
  );
}

// ─── Knowledge Base section ───────────────────────────────────────────────────

function KnowledgeBaseSection() {
  return (
    <Section
      icon={<BookOpen className="w-4 h-4 text-slate-600" />}
      title="Knowledge Base & RAG"
      description="Document visibility rules and retrieval configuration."
    >
      <div className="space-y-4">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Visibility access matrix</p>
          <div className="rounded-lg border border-slate-200 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-3 py-2 font-medium text-slate-500">Visibility level</th>
                  <th className="text-center px-3 py-2 font-medium text-slate-500">PI</th>
                  <th className="text-center px-3 py-2 font-medium text-slate-500">Researcher</th>
                  <th className="text-center px-3 py-2 font-medium text-slate-500">Student</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  { level: 'All lab members', pi: true, researcher: true, student: true },
                  { level: 'Researchers only', pi: true, researcher: true, student: false },
                  { level: 'PI only', pi: true, researcher: false, student: false },
                ].map(({ level, pi, researcher, student }) => (
                  <tr key={level} className="bg-white">
                    <td className="px-3 py-2 text-slate-700">{level}</td>
                    {[pi, researcher, student].map((has, i) => (
                      <td key={i} className="px-3 py-2 text-center">
                        {has
                          ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 mx-auto" />
                          : <span className="text-slate-300">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-3">
          {[
            { label: 'Chunk size', value: '800 tokens (approx.)' },
            { label: 'Chunk overlap', value: '100 tokens' },
            { label: 'Similarity metric', value: 'Cosine (pgvector IVFFlat)' },
            { label: 'Top-K retrieval', value: '5 chunks per query' },
          ].map(({ label, value }) => (
            <Field key={label} label={label} value={value} />
          ))}
        </div>
      </div>
    </Section>
  );
}

// ─── System section ───────────────────────────────────────────────────────────

function SystemSection() {
  return (
    <Section
      icon={<Cpu className="w-4 h-4 text-slate-600" />}
      title="System"
      description="Stack and environment information."
    >
      <div className="space-y-3">
        {[
          { label: 'Frontend', value: 'Next.js 15 (App Router)' },
          { label: 'Backend', value: 'FastAPI + Python 3.12' },
          { label: 'Database', value: 'Supabase (PostgreSQL + pgvector)' },
          { label: 'Auth', value: 'Supabase Auth (JWT)' },
          { label: 'AI provider', value: 'OpenAI (backend-only)' },
          { label: 'File storage', value: 'Supabase Storage' },
        ].map(({ label, value }) => (
          <Field key={label} label={label} value={value} />
        ))}
      </div>
    </Section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'lab', label: 'Lab Info', icon: <FlaskConical className="w-3.5 h-3.5" /> },
  { id: 'team', label: 'Team', icon: <Users className="w-3.5 h-3.5" /> },
  { id: 'ai', label: 'AI Config', icon: <Bot className="w-3.5 h-3.5" /> },
  { id: 'inventory', label: 'Inventory', icon: <Package className="w-3.5 h-3.5" /> },
  { id: 'kb', label: 'Knowledge Base', icon: <BookOpen className="w-3.5 h-3.5" /> },
  { id: 'system', label: 'System', icon: <Cpu className="w-3.5 h-3.5" /> },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function SettingsPage() {
  const profile = useUserProfile();
  const [tab, setTab] = useState<TabId>('lab');

  if (profile.role !== 'pi') {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-4">
          <Shield className="w-6 h-6 text-slate-400" />
        </div>
        <h2 className="text-lg font-semibold text-slate-800 mb-1">Access Restricted</h2>
        <p className="text-sm text-slate-500 max-w-xs">
          Settings are only accessible to the Principal Investigator.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 text-sm mt-1">
          Lab configuration, team, and AI system settings
        </p>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 mb-6 border-b border-slate-200 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
              tab === t.id
                ? 'border-slate-800 text-slate-800'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <div className="max-w-2xl">
        {tab === 'lab' && <LabInfoSection />}
        {tab === 'team' && <TeamMembersSection />}
        {tab === 'ai' && <AIConfigSection />}
        {tab === 'inventory' && <InventorySection />}
        {tab === 'kb' && <KnowledgeBaseSection />}
        {tab === 'system' && <SystemSection />}
      </div>
    </div>
  );
}
