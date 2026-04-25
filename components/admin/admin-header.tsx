'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, User } from 'lucide-react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ThemeToggle } from '@/components/admin/theme-toggle';
import { authClient } from '@/lib/auth-client';

export function AdminHeader() {
  const router = useRouter();
  const [session, setSession] = React.useState<{ email: string; name: string } | null>(null);

  React.useEffect(() => {
    authClient.getSession().then((res) => {
      if (res.data?.user) {
        setSession({
          email: res.data.user.email ?? '',
          name: res.data.user.name ?? '',
        });
      }
    });
  }, []);

  const handleSignOut = React.useCallback(async () => {
    await authClient.signOut();
    router.push('/login');
  }, [router]);

  const initials = session?.name?.slice(0, 2).toUpperCase() ?? 'AD';

  return (
    <header className="flex h-14 items-center justify-between border-b bg-[hsl(var(--shadcn-background))] px-6">
      <div>
        <h2 className="text-sm font-medium text-[hsl(var(--shadcn-foreground))]">
          管理后台
        </h2>
      </div>

      <div className="flex items-center gap-2">
        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-[hsl(var(--shadcn-accent))]">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
              <span className="text-sm text-[hsl(var(--shadcn-foreground))]">
                {session?.email ?? 'Admin'}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span>{session?.name ?? '管理员'}</span>
                <span className="text-xs font-normal text-[hsl(var(--shadcn-muted-foreground))]">
                  {session?.email}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push('/')}>
              <User className="mr-2 h-4 w-4" />
              返回前台
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              退出登录
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
