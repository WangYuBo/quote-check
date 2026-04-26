'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { authClient } from '@/lib/auth-client';

export default function NavBar() {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<{ user: { email: string } } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authClient
      .getSession()
      .then(({ data }) => {
        setSession(data as { user: { email: string } } | null);
      })
      .catch(() => {
        setSession(null);
      })
      .finally(() => setLoading(false));
  }, [pathname]);

  async function handleSignOut() {
    await fetch('/api/auth/sign-out', { method: 'POST' });
    setSession(null);
    router.push('/');
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-(--color-border) bg-(--color-bg)/95 backdrop-blur-sm">
      <div className="mx-auto flex h-12 max-w-5xl items-center justify-between px-6">
        <Link href="/" className="text-sm font-semibold text-(--color-fg) no-underline">
          黑猫校对
        </Link>

        <div className="flex items-center gap-3">
          {loading ? (
            <span className="text-xs text-(--color-fg-muted)">…</span>
          ) : session ? (
            <>
              <span className="text-xs text-(--color-fg-muted)">{session.user.email}</span>
              <button
                type="button"
                onClick={handleSignOut}
                className="rounded-lg border border-(--color-border) px-3 py-1 text-xs text-(--color-fg-muted) hover:bg-gray-50 transition-colors"
              >
                退出
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-lg bg-(--color-primary) px-4 py-1.5 text-xs font-medium text-(--color-primary-fg) no-underline hover:opacity-90 transition-opacity"
            >
              登录 / 注册
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
