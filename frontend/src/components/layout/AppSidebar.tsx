'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FlaskConical,
  ShoppingCart,
  CheckSquare,
  Package,
  BookOpen,
  ScrollText,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Role } from '@/types';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['pi', 'researcher', 'student'] },
  { label: 'Inventory', href: '/inventory', icon: FlaskConical, roles: ['pi', 'researcher', 'student'] },
  { label: 'Purchase Requests', href: '/purchase-requests', icon: ShoppingCart, roles: ['pi', 'researcher', 'student'] },
  { label: 'Tasks', href: '/tasks', icon: CheckSquare, roles: ['pi', 'researcher', 'student'] },
  { label: 'Incoming Packages', href: '/incoming-packages', icon: Package, roles: ['pi', 'researcher', 'student'] },
  { label: 'Knowledge Base', href: '/knowledge-base', icon: BookOpen, roles: ['pi', 'researcher', 'student'] },
  { label: 'Audit Logs', href: '/audit-logs', icon: ScrollText, roles: ['pi', 'researcher'] },
  { label: 'Settings', href: '/settings', icon: Settings, roles: ['pi', 'researcher'] },
] as const;

interface AppSidebarProps {
  role: Role;
}

export function AppSidebar({ role }: AppSidebarProps) {
  const pathname = usePathname();
  const visibleItems = NAV_ITEMS.filter((item) => (item.roles as readonly string[]).includes(role));

  return (
    <aside className="fixed inset-y-0 left-0 z-50 w-60 bg-slate-900 flex flex-col">
      <div className="flex items-center px-6 py-5 border-b border-slate-800">
        <span className="text-white font-semibold text-base tracking-tight">ALMA LabOps</span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-6 py-4 border-t border-slate-800">
        <p className="text-slate-500 text-xs">MVP v0.1</p>
      </div>
    </aside>
  );
}
