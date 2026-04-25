'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg('');

    const endpoint = mode === 'signin' ? '/api/auth/sign-in/email' : '/api/auth/sign-up/email';
    const body: Record<string, string> = { email, password };
    if (mode === 'signup') body.name = name;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();

    if (!res.ok) {
      setMsg(data.error ?? data.message ?? '操作失败');
      setLoading(false);
      return;
    }

    if (mode === 'signup') {
      setMsg('注册成功，请登录');
      setMode('signin');
      setLoading(false);
      return;
    }

    // 登录成功后跳转
    router.push('/upload');
  }

  return (
    <main className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center p-8">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-[var(--color-fg)]">
            {mode === 'signin' ? '登录' : '注册'}
          </h1>
          <p className="text-sm text-[var(--color-fg-muted)] mt-1">
            {mode === 'signin' ? '已有账号？直接登录' : '创建新账号'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <input
              type="text"
              placeholder="用户名"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full border border-[var(--color-border)] rounded-lg px-4 py-2.5 text-sm bg-[var(--color-bg)] text-[var(--color-fg)]"
            />
          )}
          <input
            type="email"
            placeholder="邮箱"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full border border-[var(--color-border)] rounded-lg px-4 py-2.5 text-sm bg-[var(--color-bg)] text-[var(--color-fg)]"
          />
          <input
            type="password"
            placeholder="密码（至少 8 位）"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="w-full border border-[var(--color-border)] rounded-lg px-4 py-2.5 text-sm bg-[var(--color-bg)] text-[var(--color-fg)]"
          />

          {msg && (
            <p className={`text-sm px-3 py-2 rounded-lg ${msg.includes('成功') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
              {msg}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-[var(--color-primary)] text-[var(--color-primary-fg)] text-sm font-medium disabled:opacity-50"
          >
            {loading ? '处理中…' : mode === 'signin' ? '登录' : '注册'}
          </button>
        </form>

        <p className="text-center text-sm text-[var(--color-fg-muted)]">
          {mode === 'signin' ? (
            <>没有账号？<button onClick={() => setMode('signup')} className="text-[var(--color-primary)] underline">注册</button></>
          ) : (
            <>已有账号？<button onClick={() => setMode('signin')} className="text-[var(--color-primary)] underline">登录</button></>
          )}
        </p>
      </div>
    </main>
  );
}
