'use client';

import { useEffect, useState } from 'react';
import { Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useUserProfile } from '@/contexts/UserProfileContext';

export function DevDebugPanel() {
  if (process.env.NODE_ENV !== 'development') return null;

  return <DevDebugPanelInner />;
}

function DevDebugPanelInner() {
  const profile = useUserProfile();
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    createClient()
      .auth.getSession()
      .then(({ data }) => setToken(data.session?.access_token ?? null));
  }, []);

  const copyToken = async () => {
    if (!token) return;
    await navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-8 rounded-xl border border-dashed border-amber-300 bg-amber-50 text-xs">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-amber-700 font-medium"
      >
        <span>DEV — Auth Debug</span>
        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {expanded && (
        <div className="border-t border-amber-200 px-4 py-4 space-y-3">
          <Row label="Email" value={profile.email} />
          <Row label="Full name" value={profile.full_name} />
          <Row label="Role" value={profile.role} highlight />
          <Row label="Lab ID" value={profile.lab_id ?? '—'} />
          <Row label="Org ID" value={profile.org_id ?? '—'} />
          {profile.permissions.length > 0 && (
            <div className="flex gap-2">
              <span className="w-28 shrink-0 text-amber-600">Extra perms</span>
              <span className="text-slate-700 break-all">{profile.permissions.join(', ')}</span>
            </div>
          )}

          <div className="pt-1 space-y-1.5">
            <span className="text-amber-600">JWT access token</span>
            <div className="flex items-start gap-2">
              <code className="flex-1 break-all rounded bg-white border border-amber-200 px-2 py-1.5 text-slate-600 leading-relaxed select-all">
                {token ?? 'Loading…'}
              </code>
              <button
                type="button"
                onClick={copyToken}
                title="Copy full token"
                className="shrink-0 mt-1 p-1.5 rounded hover:bg-amber-100 text-amber-700 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="text-amber-500">Use in Swagger: Authorization → Bearer &lt;token&gt;</p>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex gap-2">
      <span className="w-28 shrink-0 text-amber-600">{label}</span>
      <span className={highlight ? 'font-semibold text-amber-800' : 'text-slate-700'}>{value}</span>
    </div>
  );
}
