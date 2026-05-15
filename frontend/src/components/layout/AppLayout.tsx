import { AppSidebar } from './AppSidebar';
import { TopNav } from './TopNav';
import { UserProfileProvider } from '@/contexts/UserProfileContext';
import { CopilotPanel } from '@/components/copilot/CopilotPanel';
import type { UserProfile } from '@/types';

interface AppLayoutProps {
  children: React.ReactNode;
  profile: UserProfile;
}

export function AppLayout({ children, profile }: AppLayoutProps) {
  return (
    <UserProfileProvider profile={profile}>
      <div className="min-h-screen bg-slate-50">
        <AppSidebar role={profile.role} />
        <TopNav profile={profile} />
        <main className="ml-60 pt-14">
          <div className="p-6 max-w-7xl">{children}</div>
        </main>
        <CopilotPanel role={profile.role} />
      </div>
    </UserProfileProvider>
  );
}
