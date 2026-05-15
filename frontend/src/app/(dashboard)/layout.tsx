import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppLayout } from '@/components/layout/AppLayout';
import type { UserProfile, Permission } from '@/types';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // Split into two queries to avoid ambiguous embedded join resolution
  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  const { data: permissionsData } = await supabase
    .from('user_permissions')
    .select('permission_name')
    .eq('user_id', user.id);

  if (profileError || !profileData) {
    // User is authenticated but has no profile — sign them out first to break
    // any potential middleware redirect loop before sending back to login.
    await supabase.auth.signOut();
    redirect('/login');
  }

  if (!profileData.is_active) {
    await supabase.auth.signOut();
    redirect('/login');
  }

  const profile: UserProfile = {
    id: profileData.id,
    email: user.email ?? '',
    full_name: profileData.full_name,
    role: profileData.role,
    permissions: (permissionsData ?? []).map(
      (p: { permission_name: string }) => p.permission_name as Permission
    ),
    lab_id: profileData.lab_id,
    org_id: profileData.org_id,
    is_active: profileData.is_active,
    created_at: profileData.created_at,
  };

  return <AppLayout profile={profile}>{children}</AppLayout>;
}
