'use client';

import * as React from 'react';
import { ThemeProvider } from 'next-themes';

import { AdminHeader } from '@/components/admin/admin-header';
import { AppSidebar } from '@/components/admin/app-sidebar';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = React.useState(false);

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <div className="flex h-screen bg-[hsl(var(--shadcn-background))]">
        <AppSidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <AdminHeader />
          <main className="flex-1 overflow-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </ThemeProvider>
  );
}
