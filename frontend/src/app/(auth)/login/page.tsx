import { Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const demoRoles = [
  {
    label: 'Login as PI',
    email: 'pi@demo.alma.lab',
    description: 'Full administrative and approval access',
  },
  {
    label: 'Login as Researcher',
    email: 'researcher@demo.alma.lab',
    description: 'Operational access — inventory, requests, tasks',
  },
  {
    label: 'Login as Operations Researcher',
    email: 'ops@demo.alma.lab',
    description: 'Elevated researcher with additional operational permissions',
  },
  {
    label: 'Login as Student',
    email: 'student@demo.alma.lab',
    description: 'Limited access — tasks and onboarding',
  },
] as const;

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">ALMA LabOps</h1>
          <p className="text-slate-500 mt-1.5 text-sm">Operational Intelligence for Research Labs</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">
            Demo Access
          </p>

          <div className="space-y-2">
            {demoRoles.map((role) => (
              <form key={role.email} action="/api/auth/demo-login" method="POST">
                <input type="hidden" name="email" value={role.email} />
                <Button
                  type="submit"
                  variant="outline"
                  className="w-full justify-start h-auto py-3 px-4 text-left hover:bg-slate-50"
                >
                  <div>
                    <p className="font-medium text-sm text-slate-800">{role.label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{role.description}</p>
                  </div>
                </Button>
              </form>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100">
            <Button
              variant="outline"
              disabled
              className="w-full justify-start h-auto py-3 px-4 opacity-40 cursor-not-allowed"
            >
              <Building2 className="w-4 h-4 mr-3 shrink-0 text-slate-400" />
              <div>
                <p className="font-medium text-sm text-slate-700">
                  Continue with Organization Email
                </p>
                <p className="text-xs text-slate-400 mt-0.5">Coming soon — SSO</p>
              </div>
            </Button>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">ALMA LabOps MVP — Demo Environment</p>
      </div>
    </div>
  );
}
