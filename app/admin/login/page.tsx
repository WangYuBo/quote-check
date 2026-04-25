'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg('');

    const res = await fetch('/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();

    if (!res.ok) {
      setMsg(data.error ?? data.message ?? '登录失败');
      setLoading(false);
      return;
    }

    // Verify admin role before redirecting
    const me = await fetch('/api/admin/me');
    const meData = await me.json();
    if (meData?.user?.role !== 'admin') {
      setMsg('该账号不是管理员，请联系管理员升级');
      setLoading(false);
      return;
    }

    router.push('/admin');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[hsl(var(--shadcn-background))]">
      <div className="w-full max-w-sm space-y-6 px-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[hsl(var(--shadcn-foreground))]">管理后台</h1>
          <p className="text-sm text-[hsl(var(--shadcn-muted-foreground))] mt-1">管理员登录</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="管理员邮箱"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
          />
          <input
            type="password"
            placeholder="密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
          />

          {msg && (
            <p className={`text-sm px-3 py-2 rounded-md ${
              msg.includes('不是管理员') ? 'bg-yellow-50 text-yellow-800' :
              msg.includes('成功') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
            }`}>
              {msg}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-[hsl(var(--shadcn-primary))] text-[hsl(var(--shadcn-primary-foreground))] px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {loading ? '登录中...' : '管理员登录'}
          </button>
        </form>
      </div>
    </div>
  );
}
