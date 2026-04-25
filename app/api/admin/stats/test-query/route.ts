import { NextResponse } from 'next/server';
import { sql, count } from 'drizzle-orm';

import { withAdminAuth } from '@/lib/auth/admin-guard';
import { db } from '@/lib/db';
import { user, task, apiCall } from '@/lib/db/schema';

export const GET = withAdminAuth(async () => {
  const results: Record<string, unknown> = {};

  // Test 1: simple count
  try {
    const r = await db.select({ count: count() }).from(user);
    results['user_count'] = r;
  } catch (err) {
    results['user_count_error'] = String(err);
  }

  // Test 2: task count
  try {
    const r = await db.select({ count: count() }).from(task);
    results['task_count'] = r;
  } catch (err) {
    results['task_count_error'] = String(err);
  }

  // Test 3: task with costActualFen query
  try {
    const r = await db
      .select({ fen: sql<number>`COALESCE(SUM(${task.costActualFen}), 0)` })
      .from(task);
    results['cost_sum'] = r;
  } catch (err) {
    results['cost_sum_error'] = String(err);
  }

  // Test 4: apiCall query
  try {
    const r = await db
      .select({ fen: sql<number>`COALESCE(SUM(${apiCall.costFen}), 0)` })
      .from(apiCall);
    results['api_cost_sum'] = r;
  } catch (err) {
    results['api_cost_sum_error'] = String(err);
  }

  // Test 4b: apiCall table exists?
  try {
    const r = await db.select({ count: count() }).from(apiCall);
    results['api_call_count'] = r;
  } catch (err) {
    results['api_call_count_error'] = String(err);
  }

  // Test 5: task with completedAt + group by (for trend)
  try {
    const r = await db
      .select({ date: sql<string>`DATE(${task.completedAt})`, count: count() })
      .from(task)
      .groupBy(sql`DATE(${task.completedAt})`);
    results['task_trend'] = r.slice(0, 3);
  } catch (err) {
    results['task_trend_error'] = String(err);
  }

  return NextResponse.json(results);
});
