'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface TaskSummary {
  id: string;
  displayId: string;
  status: string;
  totalQuotes: number | null;
  verifiedQuotes: number;
  createdAt: string;
  completedAt: string | null;
  costActualCents: number | null;
}

const STATUS_LABELS: Record<string, string> = {
  PENDING_PARSE: '等待中',
  PARSING: '解析中',
  VERIFYING: '核查中',
  COMPLETED: '已完成',
  FAILED: '失败',
  CANCELED: '已取消',
  PAUSED_COST: '已暂停（费用）',
  REJECTED_BY_MODERATION: '审核未通过',
};

const STATUS_COLORS: Record<string, string> = {
  COMPLETED: 'text-green-600',
  FAILED: 'text-red-500',
  PAUSED_COST: 'text-amber-600',
  REJECTED_BY_MODERATION: 'text-gray-400',
};

export default function HistoryPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/tasks/history')
      .then(async (res) => {
        if (!res.ok) { setError('无法加载历史记录'); return; }
        const data = (await res.json()) as { tasks: TaskSummary[] };
        setTasks(data.tasks.reverse()); // 最新在前
      })
      .catch(() => setError('网络错误'))
      .finally(() => setLoading(false));
  }, []);

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('zh-CN', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  }

  return (
    <main className="min-h-screen bg-(--color-bg) p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-(--color-fg)">核查历史</h1>
          <button
            type="button"
            onClick={() => router.push('/upload')}
            className="text-sm px-4 py-2 rounded-lg bg-(--color-primary) text-(--color-primary-fg) hover:opacity-90"
          >
            + 新建核查
          </button>
        </div>

        {loading && (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-(--color-primary) border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{error}</p>
        )}

        {!loading && !error && tasks.length === 0 && (
          <div className="text-center py-12 text-(--color-fg-muted)">
            <p className="text-sm">暂无核查记录</p>
            <button
              type="button"
              onClick={() => router.push('/upload')}
              className="mt-4 text-sm text-(--color-primary) hover:underline"
            >
              上传第一份书稿
            </button>
          </div>
        )}

        {tasks.map((t) => (
          <div
            key={t.id}
            className="border border-(--color-border) rounded-xl p-5 space-y-3 hover:border-(--color-primary) transition-colors"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-0.5">
                <p className="text-xs text-(--color-fg-muted)">{t.displayId}</p>
                <p className={`text-sm font-medium ${STATUS_COLORS[t.status] ?? 'text-(--color-fg)'}`}>
                  {STATUS_LABELS[t.status] ?? t.status}
                </p>
              </div>
              <p className="text-xs text-(--color-fg-muted) shrink-0">{formatDate(t.createdAt)}</p>
            </div>

            {t.totalQuotes !== null && (
              <div className="flex gap-4 text-xs text-(--color-fg-muted)">
                <span>共 {t.totalQuotes} 条引文</span>
                {t.status === 'COMPLETED' && <span>已核查 {t.verifiedQuotes} 条</span>}
                {t.costActualCents !== null && <span>费用 ¥{(t.costActualCents / 100).toFixed(2)}</span>}
              </div>
            )}

            {t.status === 'COMPLETED' && (
              <button
                type="button"
                onClick={() => router.push(`/reports/${t.id}`)}
                className="text-xs px-3 py-1.5 rounded-lg border border-(--color-primary) text-(--color-primary) hover:bg-blue-50 transition-colors"
              >
                查看报告
              </button>
            )}

            {['VERIFYING', 'PENDING_PARSE', 'PARSING'].includes(t.status) && (
              <button
                type="button"
                onClick={() => router.push(`/tasks/${t.id}`)}
                className="text-xs px-3 py-1.5 rounded-lg border border-(--color-border) text-(--color-fg-muted) hover:border-(--color-primary) transition-colors"
              >
                查看进度
              </button>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
