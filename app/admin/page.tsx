import { requireAdminPage } from '@/lib/auth/admin-guard';
import { AdminDashboardClient } from './dashboard-client';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  const admin = await requireAdminPage();
  return <AdminDashboardClient userName={admin.name} />;
}
