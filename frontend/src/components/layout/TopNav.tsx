'use client';

import { Bell } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getRoleLabel } from '@/lib/rbac';
import { LogoutButton } from '@/components/auth/LogoutButton';
import type { UserProfile } from '@/types';

interface TopNavProps {
  profile: UserProfile;
}

export function TopNav({ profile }: TopNavProps) {
  const initials = profile.full_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="fixed top-0 right-0 left-60 z-40 h-14 bg-white border-b border-slate-200 flex items-center px-6 gap-4">
      <div className="flex-1" />

      <div className="flex items-center gap-3">
        <Badge variant="outline" className="text-xs font-medium text-slate-600">
          {getRoleLabel(profile.role)}
        </Badge>

        <span className="text-sm text-slate-700 font-medium">{profile.full_name}</span>

        <button
          type="button"
          className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
          aria-label="Notifications"
        >
          <Bell className="w-4 h-4 text-slate-500" />
        </button>

        <div className="w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center text-white text-xs font-semibold">
          {initials}
        </div>

        <LogoutButton />
      </div>
    </header>
  );
}
