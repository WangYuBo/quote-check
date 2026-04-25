'use client';

import { useEffect, useState } from 'react';
import { Activity, DollarSign, FileText, RefreshCw, Users } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface DashboardData {
  stats: {
    totalUsers: number;
    activeUsers: number;
    totalTasks: number;
    monthlyRevenueFen: number;
    monthlyApiCostFen: number;
  } | null;
  trend: { date: string; count: number }[];
}

export function AdminDashboardClient({ userName }: { userName: string }) {
  const [data, setData] = useState<DashboardData>({ stats: null, trend: [] });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/stats');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const result = await res.json();
      setData({
        stats: result.stats ?? null,
        trend: result.trend ?? [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">仪表盘</h1>
          <p className="text-sm text-[hsl(var(--shadcn-muted-foreground))]">
            欢迎，{userName}
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <p className="text-sm text-red-500">数据加载失败：{error}</p>
            <button
              onClick={fetchData}
              className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm hover:bg-[hsl(var(--shadcn-accent))]"
            >
              <RefreshCw className="h-4 w-4" />
              重试
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const s = data.stats;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">仪表盘</h1>
        <p className="text-sm text-[hsl(var(--shadcn-muted-foreground))]">
          欢迎，{userName}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">总用户数</CardTitle>
            <Users className="h-4 w-4 text-[hsl(var(--shadcn-muted-foreground))]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '...' : (s?.totalUsers ?? 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">本月任务</CardTitle>
            <FileText className="h-4 w-4 text-[hsl(var(--shadcn-muted-foreground))]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '...' : (s?.totalTasks ?? 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">本月收入</CardTitle>
            <DollarSign className="h-4 w-4 text-[hsl(var(--shadcn-muted-foreground))]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '...' : `¥${((s?.monthlyRevenueFen ?? 0) / 100).toFixed(2)}`}
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
              {loading ? '...' : `¥${((s?.monthlyApiCostFen ?? 0) / 100).toFixed(2)}`}
            </div>
            <p className="text-xs text-[hsl(var(--shadcn-muted-foreground))]">本月累计</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>任务趋势</CardTitle>
            <CardDescription>最近 30 天完成任务数</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-[200px] flex items-center justify-center text-sm text-[hsl(var(--shadcn-muted-foreground))]">
                加载中...
              </div>
            ) : data.trend.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-sm text-[hsl(var(--shadcn-muted-foreground))]">
                暂无数据
              </div>
            ) : (
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.trend.map((d) => ({ date: d.date?.slice(5) ?? '', count: d.count }))}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-[hsl(var(--shadcn-border))]" />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} className="text-xs" />
                    <YAxis tickLine={false} axisLine={false} allowDecimals={false} className="text-xs" />
                    <Tooltip contentStyle={{ background: 'hsl(var(--shadcn-popover))', border: '1px solid hsl(var(--shadcn-border))', borderRadius: '0.5rem' }} />
                    <Bar dataKey="count" fill="hsl(var(--shadcn-primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>快速入口</CardTitle>
            <CardDescription>管理操作</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <a href="/admin/users" className="block rounded-md border p-3 text-sm hover:bg-[hsl(var(--shadcn-accent))] transition-colors">
              <div className="font-medium">用户管理</div>
              <div className="text-xs text-[hsl(var(--shadcn-muted-foreground))]">查看和管理所有用户</div>
            </a>
            <a href="/admin/tasks" className="block rounded-md border p-3 text-sm hover:bg-[hsl(var(--shadcn-accent))] transition-colors">
              <div className="font-medium">任务管理</div>
              <div className="text-xs text-[hsl(var(--shadcn-muted-foreground))]">浏览和控制系统任务</div>
            </a>
            <a href="/admin/audit-logs" className="block rounded-md border p-3 text-sm hover:bg-[hsl(var(--shadcn-accent))] transition-colors">
              <div className="font-medium">审计日志</div>
              <div className="text-xs text-[hsl(var(--shadcn-muted-foreground))]">查看系统操作记录</div>
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
