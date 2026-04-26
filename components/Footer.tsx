'use client';

import { usePathname } from 'next/navigation';

export default function Footer() {
  const pathname = usePathname();
  if (pathname?.startsWith('/admin')) return null;

  return (
    <footer className="border-t border-(--color-border) bg-(--color-bg) py-6 text-center text-xs text-(--color-fg-muted)">
      © 2025 钰博 · 黑猫校对
    </footer>
  );
}
