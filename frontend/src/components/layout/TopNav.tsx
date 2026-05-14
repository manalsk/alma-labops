'use client';

import { Bell, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { getRoleLabel } from '@/lib/rbac';
import type { Role } from '@/types';

interface TopNavProps {
  userRole?: Role;
  userName?: string;
}

export function TopNav({ userRole, userName }: TopNavProps) {
  const initials = userName
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) ?? 'U';

  return (
    <header className="fixed top-0 right-0 left-60 z-40 h-14 bg-white border-b border-slate-200 flex items-center px-6 gap-4">
      <div className="flex-1 max-w-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <Input
            placeholder="Search inventory, requests, tasks..."
            className="pl-9 h-9 bg-slate-50 border-slate-200 text-sm"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 ml-auto">
        {userRole && (
          <Badge variant="outline" className="text-xs font-medium text-slate-600">
            {getRoleLabel(userRole)}
          </Badge>
        )}

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
      </div>
    </header>
  );
}
