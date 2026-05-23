import { DashboardNav } from '@/components/DashboardNav';
import { LaunchDashboard } from '@/components/LaunchDashboard';
import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { getUserOrg } from '@/lib/org-context';
import { sql } from 'drizzle-orm';
import { redirect } from 'next/navigation';

export default async function FleetPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const ctx = await getUserOrg(session.user.id);
  if (!ctx) redirect('/post-login');

  const result = await getDb().execute(sql`
    SELECT instance_id, instance_name, region, version, hostname, status,
           metrics_snapshot, last_heartbeat
    FROM guardian_fleet_instances
    WHERE org_id = ${ctx.org.id}
    ORDER BY last_heartbeat DESC
    LIMIT 200
  `);

  const instances = result as unknown as Array<{
    instance_id: string;
    instance_name: string | null;
    region: string | null;
    version: string | null;
    hostname: string | null;
    status: string;
    metrics_snapshot: Record<string, unknown> | null;
    last_heartbeat: Date | string;
  }>;

  return (
    <main className="dashboard-page">
      <DashboardNav />
      <section className="dashboard-section">
        <h1>Fleet</h1>
        <p>Self-hosted Guardian instances registered via heartbeat ({instances.length})</p>
        <LaunchDashboard />
        <table className="fleet-table">
          <thead>
            <tr>
              <th>Instance</th>
              <th>Region</th>
              <th>Status</th>
              <th>Version</th>
              <th>Last heartbeat</th>
            </tr>
          </thead>
          <tbody>
            {instances.map((i) => (
              <tr key={i.instance_id}>
                <td>
                  <strong>{i.instance_name || i.instance_id}</strong>
                  <div className="muted">{i.hostname}</div>
                </td>
                <td>{i.region || '—'}</td>
                <td>{i.status}</td>
                <td>{i.version || '—'}</td>
                <td>{new Date(i.last_heartbeat).toLocaleString()}</td>
              </tr>
            ))}
            {instances.length === 0 && (
              <tr>
                <td colSpan={5}>
                  No instances yet. Set <code>GUARDIAN_CLOUD_API_KEY</code> and{' '}
                  <code>GUARDIAN_CONTROL_PLANE_URL</code> on your Guardian host.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
