import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: '引用核查 · 文史类书稿三维度比对',
  description: '对照原始文献，从字词、解释、语境三维度比对书稿引用。机器不判错，终审权归编辑。',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" data-skin="C" suppressHydrationWarning>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
