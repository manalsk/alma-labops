import { AppSidebar } from './AppSidebar';
import { TopNav } from './TopNav';
import type { Role } from '@/types';

interface AppLayoutProps {
  children: React.ReactNode;
  userRole?: Role;
  userName?: string;
}

export function AppLayout({ children, userRole, userName }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-50">
      <AppSidebar />
      <TopNav userRole={userRole} userName={userName} />
      <main className="ml-60 pt-14">
        <div className="p-6 max-w-screen-xl">{children}</div>
      </main>
    </div>
  );
}
