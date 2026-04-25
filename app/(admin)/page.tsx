import { Suspense } from 'react';
import { Activity, DollarSign, FileText, Users } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getDashboardStats, getTaskTrend } from '@/lib/services/admin';
import { requireAdminPage } from '@/lib/auth/admin-guard';

/* ─────────────────────────────────────────────────
 * Dashboard 页面（Server Component）
 * ───────────────────────────────────────────────── */

export default async function AdminDashboardPage() {
  await requireAdminPage();
  const [stats, trend] = await Promise.all([
    getDashboardStats(),
    getTaskTrend(30),
  ]);

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--shadcn-foreground))]">
          仪表盘
        </h1>
        <p className="text-sm text-[hsl(var(--shadcn-muted-foreground))]">
          系统运行概览
        </p>
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">总用户数</CardTitle>
            <Users className="h-4 w-4 text-[hsl(var(--shadcn-muted-foreground))]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">本月任务</CardTitle>
            <FileText className="h-4 w-4 text-[hsl(var(--shadcn-muted-foreground))]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTasks}</div>
            <p className="text-xs text-[hsl(var(--shadcn-muted-foreground))]">本月创建</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">本月收入</CardTitle>
            <DollarSign className="h-4 w-4 text-[hsl(var(--shadcn-muted-foreground))]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ¥{(stats.monthlyRevenueFen / 100).toFixed(2)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">API 成本</CardTitle>
            <Activity className="h-4 w-4 text-[hsl(var(--shadcn-muted-foreground))]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ¥{(stats.monthlyApiCostFen / 100).toFixed(2)}
            </div>
            <p className="text-xs text-[hsl(var(--shadcn-muted-foreground))]">本月累计</p>
          </CardContent>
        </Card>
      </div>

      {/* 趋势图 + 最近动态 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>任务趋势</CardTitle>
            <CardDescription>最近 30 天完成任务数</CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<Skeleton className="h-[200px] w-full" />}>
              <TaskTrendChart data={trend} />
            </Suspense>
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>快速入口</CardTitle>
            <CardDescription>管理操作</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <a
              href="/admin/users"
              className="block rounded-md border p-3 text-sm hover:bg-[hsl(var(--shadcn-accent))] transition-colors"
            >
              <div className="font-medium">用户管理</div>
              <div className="text-xs text-[hsl(var(--shadcn-muted-foreground))]">
                查看和管理所有用户
              </div>
            </a>
            <a
              href="/admin/tasks"
              className="block rounded-md border p-3 text-sm hover:bg-[hsl(var(--shadcn-accent))] transition-colors"
            >
              <div className="font-medium">任务管理</div>
              <div className="text-xs text-[hsl(var(--shadcn-muted-foreground))]">
                浏览和控制系统任务
              </div>
            </a>
            <a
              href="/admin/audit-logs"
              className="block rounded-md border p-3 text-sm hover:bg-[hsl(var(--shadcn-accent))] transition-colors"
            >
              <div className="font-medium">审计日志</div>
              <div className="text-xs text-[hsl(var(--shadcn-muted-foreground))]">
                查看系统操作记录
              </div>
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────
 * 趋势图（客户端组件）
 * ───────────────────────────────────────────────── */

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

function TaskTrendChart({ data }: { data: { date: string; count: number }[] }) {
  const chartData = data.map((d) => ({
    date: d.date?.slice(5) ?? '', // MM-DD
    count: d.count,
  }));

  return (
    <div className="h-[200px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-[hsl(var(--shadcn-border))]" />
          <XAxis
            dataKey="date"
            className="text-xs text-[hsl(var(--shadcn-muted-foreground))]"
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            className="text-xs text-[hsl(var(--shadcn-muted-foreground))]"
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              background: 'hsl(var(--shadcn-popover))',
              border: '1px solid hsl(var(--shadcn-border))',
              borderRadius: '0.5rem',
            }}
          />
          <Bar dataKey="count" fill="hsl(var(--shadcn-primary))" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
