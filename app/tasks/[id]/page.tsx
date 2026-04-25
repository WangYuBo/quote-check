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
  PAUSED_COST: '已暂停（成本预警）',
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
    <main className="min-h-screen bg-(--color-bg) flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-md text-center space-y-6">
        {task ? (
          <>
            <div className="space-y-1">
              <p className="text-xs text-(--color-fg-muted)">{task.displayId}</p>
              <h1 className="text-xl font-semibold text-(--color-fg)">
                {STATUS_LABELS[task.status] ?? task.status}
              </h1>
            </div>

            {task.status === 'VERIFYING' && (
              <div className="space-y-2">
                <div className="w-full bg-(--color-border) rounded-full h-2">
                  <div
                    className="bg-(--color-primary) h-2 rounded-full transition-all duration-500"
                    style={{ width: progress !== null ? `${progress}%` : '10%' }}
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
              <div className="border border-amber-200 bg-amber-50 rounded-xl px-4 py-4 space-y-2">
                <div className="flex items-center gap-2 text-amber-700">
                  <PauseCircle size={18} />
                  <span className="text-sm font-medium">已暂停（费用超出预估 1.5 倍）</span>
                </div>
                <p className="text-xs text-amber-600">
                  如需继续，请联系支持重新发起任务。已完成的引文核查结果已保存。
                </p>
              </div>
            )}

            {task.status === 'REJECTED_BY_MODERATION' && (
              <div
                className="rounded-xl px-4 py-5 space-y-3 opacity-60"
                style={{
                  background:
                    'repeating-linear-gradient(-45deg,#f3f4f6,#f3f4f6 4px,#e5e7eb 4px,#e5e7eb 8px)',
                }}
              >
                <div className="flex items-center justify-center gap-2 text-(--color-fg-muted)">
                  <ShieldOff size={20} />
                  <span className="text-sm font-medium">审核未通过，无法校对</span>
                </div>
                <p className="text-xs text-(--color-fg-muted) text-center">
                  本书稿内容未通过平台内容审核，核查任务已终止。如有疑问请联系支持。
                </p>
              </div>
            )}

            {task.status === 'PENDING_PARSE' && (
              <div className="flex justify-center">
                <div className="w-8 h-8 border-2 border-(--color-primary) border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : (
          <div className="flex justify-center">
            <div className="w-8 h-8 border-2 border-(--color-primary) border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
    </main>
  );
}
