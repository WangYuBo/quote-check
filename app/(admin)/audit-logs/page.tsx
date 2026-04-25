import { Suspense } from 'react';
import { requireAdmin } from '@/lib/auth/admin-guard';
import { listAuditLogs } from '@/lib/services/admin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
    op?: string;
    userId?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}

export default async function AdminAuditLogsPage({ searchParams }: PageProps) {
  await requireAdmin();
  const params = await searchParams;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--shadcn-foreground))]">
          审计日志
        </h1>
        <p className="text-sm text-[hsl(var(--shadcn-muted-foreground))]">
          系统操作记录（append-only）
        </p>
      </div>

      <Suspense fallback={<AuditLogsSkeleton />}>
        <AuditLogsTable
          op={params.op}
          userId={params.userId}
          from={params.from}
          to={params.to}
          page={params.page ? Number(params.page) : 1}
        />
      </Suspense>
    </div>
  );
}

async function AuditLogsTable({
  op,
  userId,
  from,
  to,
  page,
}: {
  op?: string | undefined;
  userId?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
  page: number;
}) {
  const { items, total } = await listAuditLogs({ op, userId, from, to, page, pageSize: 20 });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">日志记录（共 {total} 条）</CardTitle>
          <div className="flex items-center gap-2">
            <form className="flex items-center gap-2">
              <Input
                name="op"
                placeholder="操作类型..."
                defaultValue={op}
                className="h-8 w-[140px]"
              />
              <Input
                name="userId"
                placeholder="用户 ID..."
                defaultValue={userId}
                className="h-8 w-[180px]"
              />
              <button
                type="submit"
                className="h-8 rounded-md border px-3 text-xs hover:bg-[hsl(var(--shadcn-accent))]"
              >
                筛选
              </button>
            </form>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>用户</TableHead>
              <TableHead>操作</TableHead>
              <TableHead>目标类型</TableHead>
              <TableHead>目标 ID</TableHead>
              <TableHead>元数据</TableHead>
              <TableHead>时间</TableHead>
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
            {items.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="text-xs text-[hsl(var(--shadcn-muted-foreground))]">
                  {log.id}
                </TableCell>
                <TableCell className="text-xs">{log.userEmail ?? '-'}</TableCell>
                <TableCell>
                  <code className="rounded bg-[hsl(var(--shadcn-muted))] px-1.5 py-0.5 text-xs font-mono">
                    {log.op}
                  </code>
                </TableCell>
                <TableCell className="text-xs">{log.targetType ?? '-'}</TableCell>
                <TableCell className="font-mono text-xs text-[hsl(var(--shadcn-muted-foreground))]">
                  {log.targetId?.slice(0, 8) ?? '-'}
                </TableCell>
                <TableCell className="max-w-[200px] truncate text-xs text-[hsl(var(--shadcn-muted-foreground))]">
                  {log.metadataJson ? JSON.stringify(log.metadataJson) : '-'}
                </TableCell>
                <TableCell className="text-xs text-[hsl(var(--shadcn-muted-foreground))]">
                  {log.createdAt.slice(0, 19).replace('T', ' ')}
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
                  href={`/admin/audit-logs?page=${page - 1}${op ? `&op=${op}` : ''}${userId ? `&userId=${userId}` : ''}`}
                  className="h-8 rounded-md border px-3 text-xs inline-flex items-center hover:bg-[hsl(var(--shadcn-accent))]"
                >
                  上一页
                </a>
              )}
              {page * 20 < total && (
                <a
                  href={`/admin/audit-logs?page=${page + 1}${op ? `&op=${op}` : ''}${userId ? `&userId=${userId}` : ''}`}
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

function AuditLogsSkeleton() {
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
