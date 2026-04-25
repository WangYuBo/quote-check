'use client';

import * as React from 'react';
import {
  LayoutDashboard,
  Users,
  FileText,
  ClipboardList,
  ScrollText,
  Shield,
  ChevronRight,
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  items?: { title: string; url: string }[];
}

const navItems: NavItem[] = [
  { title: '仪表盘', url: '/admin', icon: LayoutDashboard },
  { title: '用户管理', url: '/admin/users', icon: Users },
  { title: '任务管理', url: '/admin/tasks', icon: ClipboardList },
  { title: '稿件管理', url: '/admin/manuscripts', icon: FileText },
  {
    title: '系统',
    url: '#',
    icon: Shield,
    items: [{ title: '审计日志', url: '/admin/audit-logs' }],
  },
];

export function AppSidebar({ collapsed = false, onToggle }: { collapsed?: boolean; onToggle?: () => void }) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        'flex flex-col border-r bg-[hsl(var(--shadcn-sidebar-background))] transition-all duration-300',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      {/* Header */}
      <div className="flex h-14 items-center border-b px-4">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-[hsl(var(--shadcn-sidebar-primary))]" />
            <span className="font-semibold text-sm text-[hsl(var(--shadcn-sidebar-foreground))]">
              管理后台
            </span>
          </div>
        )}
        {collapsed && (
          <Shield className="mx-auto h-5 w-5 text-[hsl(var(--shadcn-sidebar-primary))]" />
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-auto p-2 space-y-1">
        {navItems.map((item) => {
          if (item.items) {
            return (
              <div key={item.title}>
                {!collapsed && (
                  <div className="px-3 py-2 text-xs font-medium text-[hsl(var(--shadcn-muted-foreground))] uppercase tracking-wider">
                    {item.title}
                  </div>
                )}
                {item.items.map((sub) => {
                  const isActive = pathname === sub.url;
                  return (
                    <Link
                      key={sub.url}
                      href={sub.url}
                      className={cn(
                        'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                        isActive
                          ? 'bg-[hsl(var(--shadcn-sidebar-accent))] text-[hsl(var(--shadcn-sidebar-accent-foreground))] font-medium'
                          : 'text-[hsl(var(--shadcn-sidebar-foreground))] hover:bg-[hsl(var(--shadcn-sidebar-accent))]',
                      )}
                    >
                      <ScrollText className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{sub.title}</span>}
                    </Link>
                  );
                })}
              </div>
            );
          }

          const isActive = pathname === item.url;
          return (
            <Link
              key={item.url}
              href={item.url}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-[hsl(var(--shadcn-sidebar-accent))] text-[hsl(var(--shadcn-sidebar-accent-foreground))] font-medium'
                  : 'text-[hsl(var(--shadcn-sidebar-foreground))] hover:bg-[hsl(var(--shadcn-sidebar-accent))]',
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{item.title}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="border-t p-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-center"
          onClick={onToggle}
        >
          <ChevronRight
            className={cn(
              'h-4 w-4 transition-transform',
              collapsed ? '' : 'rotate-180',
            )}
          />
        </Button>
      </div>
    </aside>
  );
}
