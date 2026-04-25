import { Suspense } from 'react';
import { requireAdmin } from '@/lib/auth/admin-guard';
import { listAllTasks } from '@/lib/services/admin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

interface PageProps {
  searchParams: Promise<{
    status?: string;
    q?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}

export default async function AdminTasksPage({ searchParams }: PageProps) {
  await requireAdmin();
  const params = await searchParams;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--shadcn-foreground))]">
          任务管理
        </h1>
        <p className="text-sm text-[hsl(var(--shadcn-muted-foreground))]">
          查看所有用户的校对任务
        </p>
      </div>

      <Suspense fallback={<TasksTableSkeleton />}>
        <TasksTable
          status={params.status}
          q={params.q}
          from={params.from}
          to={params.to}
          page={params.page ? Number(params.page) : 1}
        />
      </Suspense>
    </div>
  );
}

const STATUS_LABELS: Record<string, string> = {
  PENDING_PARSE: '待解析',
  PARSING: '解析中',
  PENDING_ESTIMATE: '待估价',
  AWAITING_CONFIRM: '待确认',
  VERIFYING: '校验中',
  PAUSED_COST: '已暂停',
  REJECTED_BY_MODERATION: '已拒绝',
  COMPLETED: '已完成',
  FAILED: '失败',
  CANCELED: '已取消',
};

const COLOR_MAP: Record<string, string> = {
  COMPLETED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  FAILED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  CANCELED: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  VERIFYING: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  PARSING: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  PENDING_PARSE: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  REJECTED_BY_MODERATION: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
};

async function TasksTable({
  status,
  q,
  from,
  to,
  page,
}: {
  status?: string | undefined;
  q?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
  page: number;
}) {
  const { items, total } = await listAllTasks({ status, q, from, to, page, pageSize: 20 });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">任务列表（共 {total} 个）</CardTitle>
          <div className="flex items-center gap-2">
            <form className="flex items-center gap-2">
              <Input
                name="q"
                placeholder="搜索任务 ID..."
                defaultValue={q}
                className="h-8 w-[180px]"
              />
              <select
                name="status"
                defaultValue={status ?? ''}
                className="h-8 rounded-md border bg-transparent px-2 text-xs"
                onChange={(e) => {
                  const url = new URL(window.location.href);
                  if (e.target.value) url.searchParams.set('status', e.target.value);
                  else url.searchParams.delete('status');
                  window.location.href = url.toString();
                }}
              >
                <option value="">全部状态</option>
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <button
                type="submit"
                className="h-8 rounded-md border px-3 text-xs hover:bg-[hsl(var(--shadcn-accent))]"
              >
                搜索
              </button>
            </form>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>任务 ID</TableHead>
              <TableHead>用户</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>引文数</TableHead>
              <TableHead>费用(元)</TableHead>
              <TableHead>创建时间</TableHead>
              <TableHead>完成时间</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-sm text-[hsl(var(--shadcn-muted-foreground))]">
                  暂无数据
                </TableCell>
              </TableRow>
            )}
            {items.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-mono text-xs">{t.displayId}</TableCell>
                <TableCell className="text-xs">{t.userEmail}</TableCell>
                <TableCell>
                  <span
                    className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${COLOR_MAP[t.status] ?? ''}`}
                  >
                    {STATUS_LABELS[t.status] ?? t.status}
                  </span>
                </TableCell>
                <TableCell>{t.totalQuotes ?? '-'}</TableCell>
                <TableCell>
                  {t.costActualFen != null ? `¥${(t.costActualFen / 100).toFixed(2)}` : '-'}
                </TableCell>
                <TableCell className="text-xs text-[hsl(var(--shadcn-muted-foreground))]">
                  {t.createdAt.slice(0, 16).replace('T', ' ')}
                </TableCell>
                <TableCell className="text-xs text-[hsl(var(--shadcn-muted-foreground))]">
                  {t.completedAt?.slice(0, 16).replace('T', ' ') ?? '-'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {total > 20 && (
          <div className="flex items-center justify-between pt-4">
            <p className="text-sm text-[hsl(var(--shadcn-muted-foreground))]">
              第 {page} / {Math.ceil(total / 20)} 页
            </p>
            <div className="flex gap-2">
              {page > 1 && (
                <a
                  href={`/admin/tasks?page=${page - 1}${status ? `&status=${status}` : ''}${q ? `&q=${q}` : ''}`}
                  className="h-8 rounded-md border px-3 text-xs inline-flex items-center hover:bg-[hsl(var(--shadcn-accent))]"
                >
                  上一页
                </a>
              )}
              {page * 20 < total && (
                <a
                  href={`/admin/tasks?page=${page + 1}${status ? `&status=${status}` : ''}${q ? `&q=${q}` : ''}`}
                  className="h-8 rounded-md border px-3 text-xs inline-flex items-center hover:bg-[hsl(var(--shadcn-accent))]"
                >
                  下一页
                </a>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TasksTableSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-40" />
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
