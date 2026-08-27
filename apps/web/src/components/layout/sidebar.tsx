'use client';

import * as React from 'react';
import Link from 'next/navigation';
import { usePathname } from 'next/navigation';
import { useAuth } from '../providers/auth-provider';
import { cn } from '../../lib/utils';
import {
  LayoutDashboard,
  FileText,
  CheckSquare,
  Bot,
  Users,
  Cpu,
  Settings,
  LogOut,
  ChevronRight,
  GitBranch,
} from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  adminOnly?: boolean;
}

export function Sidebar() {
  const pathname = usePathname();
  const { user, userRole, signOut } = useAuth();

  const navItems: NavItem[] = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Workflows', href: '/workflows', icon: GitBranch, badge: 'Live' },
    { name: 'Requirements', href: '/requirements', icon: FileText, badge: 'P4' },
    { name: 'Tasks', href: '/tasks', icon: CheckSquare, badge: 'P6' },
    { name: 'Agents', href: '/agents', icon: Bot, badge: 'P3' },
    { name: 'Team & Members', href: '/settings/organization', icon: Users },
    { name: 'AI Providers', href: '/settings/providers', icon: Cpu },
    { name: 'Account Settings', href: '/settings/account', icon: Settings },
  ];

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-border bg-card/60 backdrop-blur-md">
      {/* Brand Header */}
      <div className="flex h-14 items-center border-b border-border px-5">
        <a
          href="/dashboard"
          className="flex items-center gap-2 font-bold tracking-tight text-foreground"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground font-black text-xs shadow-sm">
            IL
          </div>
          <span className="text-base tracking-wider bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
            IRONLOOM
          </span>
          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
            OS
          </span>
        </a>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <div className="px-3 py-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          Workspace
        </div>

        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <a
              key={item.href}
              href={item.href}
              className={cn(
                'group flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={cn(
                    'h-4 w-4',
                    isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground',
                  )}
                />
                <span>{item.name}</span>
              </div>
              {item.badge && (
                <span className="rounded bg-muted px-1.5 py-0.2 text-[10px] font-semibold text-muted-foreground">
                  {item.badge}
                </span>
              )}
            </a>
          );
        })}
      </div>

      {/* User Footer & Logout */}
      <div className="border-t border-border p-3">
        <div className="flex items-center justify-between rounded-lg bg-muted/40 p-2 text-xs">
          <div className="flex flex-col truncate pr-2">
            <span className="font-medium text-foreground truncate">
              {user?.name || user?.email?.split('@')[0]}
            </span>
            <span className="text-[10px] text-muted-foreground capitalize">
              {userRole || 'Member'}
            </span>
          </div>
          <button
            onClick={() => signOut()}
            title="Sign out"
            className="rounded p-1.5 text-muted-foreground hover:bg-destructive/20 hover:text-destructive transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
