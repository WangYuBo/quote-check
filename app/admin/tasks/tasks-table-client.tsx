'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

interface TaskItem {
  id: string;
  displayId: string;
  userEmail: string;
  userName: string | null;
  status: string;
  totalQuotes: number | null;
  costActualFen: number | null;
  createdAt: string;
  completedAt: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  PENDING_PARSE: '待解析', PARSING: '解析中',
  PENDING_ESTIMATE: '待估价', AWAITING_CONFIRM: '待确认',
  VERIFYING: '校验中', PAUSED_COST: '已暂停',
  REJECTED_BY_MODERATION: '已拒绝',
  COMPLETED: '已完成', FAILED: '失败', CANCELED: '已取消',
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

export function TasksTableClient() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<TaskItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (search) params.set('q', search);
      if (status) params.set('status', status);
      const res = await fetch(`/api/admin/tasks?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [page, search, status]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (error) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm text-red-500">数据加载失败：{error}</p>
          <button onClick={fetchData} className="mt-4 rounded-md border px-4 py-2 text-sm hover:bg-[hsl(var(--shadcn-accent))]">重试</button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">任务列表（共 {total} 个）</CardTitle>
          <div className="flex items-center gap-2">
            <Input
              placeholder="搜索任务 ID..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="h-8 w-[180px]"
            />
            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }}
              className="h-8 rounded-md border bg-transparent px-2 text-xs"
            >
              <option value="">全部状态</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
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
            {loading ? (
              <TableRow><TableCell colSpan={7} className="h-24 text-center">加载中...</TableCell></TableRow>
            ) : items.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="h-24 text-center text-sm text-[hsl(var(--shadcn-muted-foreground))]">暂无数据</TableCell></TableRow>
            ) : items.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-mono text-xs">{t.displayId}</TableCell>
                <TableCell className="text-xs">{t.userEmail}</TableCell>
                <TableCell>
                  <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${COLOR_MAP[t.status] ?? ''}`}>
                    {STATUS_LABELS[t.status] ?? t.status}
                  </span>
                </TableCell>
                <TableCell>{t.totalQuotes ?? '-'}</TableCell>
                <TableCell>{t.costActualFen != null ? `¥${(t.costActualFen / 100).toFixed(2)}` : '-'}</TableCell>
                <TableCell className="text-xs text-[hsl(var(--shadcn-muted-foreground))]">
                  {t.createdAt?.slice(0, 16).replace('T', ' ') ?? ''}
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
              {page > 1 && <button onClick={() => setPage(page - 1)} className="h-8 rounded-md border px-3 text-xs hover:bg-[hsl(var(--shadcn-accent))]">上一页</button>}
              {page * 20 < total && <button onClick={() => setPage(page + 1)} className="h-8 rounded-md border px-3 text-xs hover:bg-[hsl(var(--shadcn-accent))]">下一页</button>}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
