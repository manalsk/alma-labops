import { DevDebugPanel } from '@/components/dev/DevDebugPanel';

export default function SettingsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 text-sm mt-1">
          Manage users, locations, vendors, and lab configuration
        </p>
      </div>
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
        <p className="text-slate-400 text-sm">Settings implementation coming in Phase 2</p>
      </div>

      <DevDebugPanel />
    </div>
  );
}
