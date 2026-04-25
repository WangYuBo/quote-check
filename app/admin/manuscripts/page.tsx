import { Suspense } from 'react';
import { requireAdminPage } from '@/lib/auth/admin-guard';
import { listManuscripts } from '@/lib/services/admin';
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
import { ManuscriptActionsClient } from './manuscript-actions-client';

interface PageProps {
  searchParams: Promise<{
    q?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}

export default async function AdminManuscriptsPage({ searchParams }: PageProps) {
  await requireAdminPage();
  const params = await searchParams;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--shadcn-foreground))]">
          稿件管理
        </h1>
        <p className="text-sm text-[hsl(var(--shadcn-muted-foreground))]">
          查看所有上传的稿件
        </p>
      </div>

      <Suspense fallback={<ManuscriptsTableSkeleton />}>
        <ManuscriptsTable
          q={params.q}
          from={params.from}
          to={params.to}
          page={params.page ? Number(params.page) : 1}
        />
      </Suspense>
    </div>
  );
}

async function ManuscriptsTable({
  q,
  from,
  to,
  page,
}: {
  q?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
  page: number;
}) {
  const { items, total } = await listManuscripts({ q, from, to, page, pageSize: 20 });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">稿件列表（共 {total} 个）</CardTitle>
          <div className="flex items-center gap-2">
            <form className="flex items-center gap-2">
              <Input
                name="q"
                placeholder="搜索 ID/文件名..."
                defaultValue={q}
                className="h-8 w-[160px]"
              />
              <input
                type="date"
                name="from"
                defaultValue={from}
                className="h-8 rounded-md border bg-transparent px-2 text-xs"
              />
              <input
                type="date"
                name="to"
                defaultValue={to}
                className="h-8 rounded-md border bg-transparent px-2 text-xs"
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
              <TableHead>ID</TableHead>
              <TableHead>用户</TableHead>
              <TableHead>文件名</TableHead>
              <TableHead>字数</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>上传时间</TableHead>
              <TableHead>操作</TableHead>
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
            {items.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-mono text-xs">{m.displayId}</TableCell>
                <TableCell className="text-xs">{m.userEmail}</TableCell>
                <TableCell className="max-w-[200px] truncate text-xs" title={m.filename}>
                  {m.filename}
                </TableCell>
                <TableCell>{m.charCount?.toLocaleString() ?? '-'}</TableCell>
                <TableCell>
                  {m.destroyedAt ? (
                    <Badge variant="destructive">已销毁</Badge>
                  ) : (
                    <Badge variant="secondary">正常</Badge>
                  )}
                </TableCell>
                <TableCell className="text-xs text-[hsl(var(--shadcn-muted-foreground))]">
                  {m.createdAt.slice(0, 16).replace('T', ' ')}
                </TableCell>
                <TableCell>
                  <ManuscriptActionsClient
                    manuscript={{ id: m.id, displayId: m.displayId, destroyedAt: m.destroyedAt }}
                  />
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
                  href={`/admin/manuscripts?page=${page - 1}${q ? `&q=${q}` : ''}${from ? `&from=${from}` : ''}${to ? `&to=${to}` : ''}`}
                  className="h-8 rounded-md border px-3 text-xs inline-flex items-center hover:bg-[hsl(var(--shadcn-accent))]"
                >
                  上一页
                </a>
              )}
              {page * 20 < total && (
                <a
                  href={`/admin/manuscripts?page=${page + 1}${q ? `&q=${q}` : ''}${from ? `&from=${from}` : ''}${to ? `&to=${to}` : ''}`}
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

function ManuscriptsTableSkeleton() {
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
