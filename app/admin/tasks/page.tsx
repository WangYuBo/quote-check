import { requireAdminPage } from '@/lib/auth/admin-guard';
import { TasksTableClient } from './tasks-table-client';

export const dynamic = 'force-dynamic';

export default async function AdminTasksPage() {
  await requireAdminPage();
  return <TasksTableClient />;
}
