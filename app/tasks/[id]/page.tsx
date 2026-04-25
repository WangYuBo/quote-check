'use client';

import { PauseCircle, ShieldOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { use, useEffect, useState } from 'react';

interface TaskStatus {
  taskId: string;
  displayId: string;
  status: string;
  totalQuotes: number | null;
  verifiedQuotes: number;
  failedQuotes: number;
}

const STATUS_LABELS: Record<string, string> = {
  PENDING_PARSE: '等待中…',
  VERIFYING: '正在核查…',
  PAUSED_COST: '已暂停',
  REJECTED_BY_MODERATION: '内容审核未通过',
  COMPLETED: '核查完成',
  CANCELED: '已取消',
};

export default function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [task, setTask] = useState<TaskStatus | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function poll() {
      while (active) {
        try {
          const res = await fetch(`/api/tasks/${id}`);
          if (!res.ok) {
            setError('无法获取任务状态');
            return;
          }
          const data = (await res.json()) as TaskStatus;
          if (active) setTask(data);

          if (data.status === 'COMPLETED') {
            router.push(`/reports/${id}`);
            return;
          }
          if (
            data.status === 'CANCELED' ||
            data.status === 'REJECTED_BY_MODERATION' ||
            data.status === 'PAUSED_COST' ||
            data.status === 'FAILED'
          ) {
            return;
          }
        } catch {
          if (active) setError('网络错误，稍后自动重试');
        }
        await new Promise((r) => setTimeout(r, 3000));
      }
    }

    void poll();
    return () => {
      active = false;
    };
  }, [id, router]);

  const progress =
    task?.totalQuotes && task.totalQuotes > 0
      ? Math.round((task.verifiedQuotes / task.totalQuotes) * 100)
      : null;

  return (
    <main className="min-h-screen bg-(--color-bg)">
      <div className="max-w-lg mx-auto px-6 py-16">
        {task ? (
          <div className="rounded-xl border border-(--color-border) bg-(--color-card) p-8 space-y-6 text-center">
            <div className="space-y-2">
              <p className="text-xs text-(--color-fg-muted)">{task.displayId}</p>
              <h1 className="text-xl font-semibold text-(--color-fg)">
                {STATUS_LABELS[task.status] ?? task.status}
              </h1>
            </div>

            {task.status === 'VERIFYING' && (
              <div className="space-y-4">
                <div className="w-full bg-(--color-border) rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{
                      width: progress !== null ? `${progress}%` : '10%',
                      background: 'linear-gradient(90deg, var(--color-primary), oklch(0.65 0.12 195))',
                    }}
                  />
                </div>
                <p className="text-sm text-(--color-fg-muted)">
                  {task.totalQuotes !== null
                    ? `${task.verifiedQuotes} / ${task.totalQuotes} 条引文`
                    : '正在提取引文…'}
                </p>
              </div>
            )}

            {task.status === 'PAUSED_COST' && (
              <div className="rounded-xl border border-(--color-border) bg-(--color-bg) px-5 py-5 space-y-2">
                <div className="flex items-center justify-center gap-2 text-(--color-fg-muted)">
                  <PauseCircle size={18} />
                  <span className="text-sm font-medium">任务已暂停</span>
                </div>
                <p className="text-xs text-(--color-fg-muted)">
                  如需继续，请联系支持重新发起任务。已完成的引文核查结果已保存。
                </p>
              </div>
            )}

            {task.status === 'REJECTED_BY_MODERATION' && (
              <div className="rounded-xl border border-(--color-border) bg-(--color-bg) px-5 py-5 space-y-2">
                <div className="flex items-center justify-center gap-2 text-(--color-fg-muted)">
                  <ShieldOff size={18} />
                  <span className="text-sm font-medium">审核未通过</span>
                </div>
                <p className="text-xs text-(--color-fg-muted)">
                  本书稿内容未通过平台内容审核，核查任务已终止。如有疑问请联系支持。
                </p>
              </div>
            )}

            {task.status === 'PENDING_PARSE' && (
              <div className="flex justify-center py-4">
                <div className="w-8 h-8 border-2 border-(--color-primary) border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-(--color-border) bg-(--color-card) p-8 text-center">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        ) : (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-(--color-primary) border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
    </main>
  );
}
