'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createClient } from '@/lib/supabase/client';

const DEMO_ROLES = [
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
    description: 'Researcher with elevated operational permissions',
  },
  {
    label: 'Login as Student',
    email: 'student@demo.alma.lab',
    description: 'Limited access — tasks and onboarding',
  },
] as const;

const DEMO_PASSWORD = 'demo1234';

export default function LoginPage() {
  const router = useRouter();
  const [loadingRole, setLoadingRole] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = async (email: string, password: string) => {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    router.push('/dashboard');
  };

  const handleDemoLogin = async (roleEmail: string) => {
    setError(null);
    setLoadingRole(roleEmail);
    try {
      await signIn(roleEmail, DEMO_PASSWORD);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Login failed. Make sure the demo users have been seeded.'
      );
      setLoadingRole(null);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setFormLoading(true);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.');
      setFormLoading(false);
    }
  };

  const anyLoading = loadingRole !== null || formLoading;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Branding */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">ALMA LabOps</h1>
          <p className="text-slate-500 mt-1.5 text-sm">
            Operational Intelligence for Research Labs
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5">
          {/* Demo access */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
              Demo Access
            </p>
            <div className="space-y-2">
              {DEMO_ROLES.map((role) => {
                const isLoading = loadingRole === role.email;
                return (
                  <Button
                    key={role.email}
                    variant="outline"
                    className="w-full justify-start h-auto py-3 px-4 hover:bg-slate-50 disabled:opacity-60"
                    onClick={() => handleDemoLogin(role.email)}
                    disabled={anyLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 mr-3 shrink-0 animate-spin text-slate-400" />
                    ) : (
                      <span className="w-4 h-4 mr-3 shrink-0" />
                    )}
                    <div className="text-left">
                      <p className="font-medium text-sm text-slate-800">{role.label}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{role.description}</p>
                    </div>
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 border-t border-slate-100" />
            <span className="text-xs text-slate-400">or sign in with email</span>
            <div className="flex-1 border-t border-slate-100" />
          </div>

          {/* Email / password form */}
          <form onSubmit={handleFormSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium text-slate-600">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@lab.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={anyLoading}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-medium text-slate-600">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={anyLoading}
                className="h-9 text-sm"
              />
            </div>
            <Button
              type="submit"
              className="w-full h-9 text-sm bg-teal-600 hover:bg-teal-700 text-white"
              disabled={anyLoading}
            >
              {formLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Sign In
            </Button>
          </form>

          {/* Error message */}
          {error && (
            <p className="text-xs text-red-500 text-center bg-red-50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* Future SSO */}
          <div className="pt-1 border-t border-slate-100">
            <Button
              variant="outline"
              disabled
              className="w-full justify-start h-auto py-3 px-4 opacity-40 cursor-not-allowed"
            >
              <Building2 className="w-4 h-4 mr-3 shrink-0 text-slate-400" />
              <div className="text-left">
                <p className="font-medium text-sm text-slate-700">
                  Continue with Organization Email
                </p>
                <p className="text-xs text-slate-400 mt-0.5">Coming soon — SSO</p>
              </div>
            </Button>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          ALMA LabOps MVP — Demo Environment
        </p>
      </div>
    </div>
  );
}
