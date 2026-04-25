import { Suspense } from 'react';
import { requireAdmin } from '@/lib/auth/admin-guard';
import { listUsers } from '@/lib/services/admin';
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
    role?: string;
    status?: string;
    q?: string;
    page?: string;
  }>;
}

export default async function AdminUsersPage({ searchParams }: PageProps) {
  await requireAdmin();
  const params = await searchParams;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--shadcn-foreground))]">
          用户管理
        </h1>
        <p className="text-sm text-[hsl(var(--shadcn-muted-foreground))]">
          查看和管理所有注册用户
        </p>
      </div>

      <Suspense fallback={<UsersTableSkeleton />}>
        <UsersTable
          role={params.role}
          status={params.status}
          q={params.q}
          page={params.page ? Number(params.page) : 1}
        />
      </Suspense>
    </div>
  );
}

async function UsersTable({
  role,
  status,
  q,
  page,
}: {
  role?: string | undefined;
  status?: string | undefined;
  q?: string | undefined;
  page: number;
}) {
  const { items, total } = await listUsers({ role, status, q, page, pageSize: 20 });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">用户列表（共 {total} 人）</CardTitle>
          <div className="flex items-center gap-2">
            <form className="flex items-center gap-2">
              <Input
                name="q"
                placeholder="搜索邮箱/姓名..."
                defaultValue={q}
                className="h-8 w-[200px]"
              />
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
              <TableHead>邮箱</TableHead>
              <TableHead>姓名</TableHead>
              <TableHead>角色</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>任务数</TableHead>
              <TableHead>注册时间</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-sm text-[hsl(var(--shadcn-muted-foreground))]">
                  暂无数据
                </TableCell>
              </TableRow>
            )}
            {items.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-mono text-xs">{u.email}</TableCell>
                <TableCell>{u.name ?? '-'}</TableCell>
                <TableCell>
                  <RoleBadge role={u.role} />
                </TableCell>
                <TableCell>
                  {u.suspendedAt ? (
                    <Badge variant="destructive">停用</Badge>
                  ) : (
                    <Badge variant="secondary">正常</Badge>
                  )}
                </TableCell>
                <TableCell>{u.taskCount}</TableCell>
                <TableCell className="text-xs text-[hsl(var(--shadcn-muted-foreground))]">
                  {u.createdAt?.slice(0, 10)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Simple pagination */}
        {total > 20 && (
          <div className="flex items-center justify-between pt-4">
            <p className="text-sm text-[hsl(var(--shadcn-muted-foreground))]">
              第 {page} / {Math.ceil(total / 20)} 页
            </p>
            <div className="flex gap-2">
              {page > 1 && (
                <a
                  href={`/admin/users?page=${page - 1}&role=${role ?? ''}&status=${status ?? ''}&q=${q ?? ''}`}
                  className="h-8 rounded-md border px-3 text-xs inline-flex items-center hover:bg-[hsl(var(--shadcn-accent))]"
                >
                  上一页
                </a>
              )}
              {page * 20 < total && (
                <a
                  href={`/admin/users?page=${page + 1}&role=${role ?? ''}&status=${status ?? ''}&q=${q ?? ''}`}
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

function RoleBadge({ role }: { role: string }) {
  const variant = role === 'admin' ? 'default' : role === 'B' ? 'secondary' : 'outline';
  const label = role === 'admin' ? '管理员' : role === 'B' ? 'B 端' : 'C 端';
  return <Badge variant={variant}>{label}</Badge>;
}

function UsersTableSkeleton() {
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
