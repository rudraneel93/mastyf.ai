import { GitHubGettingStarted } from '@/components/GitHubGettingStarted';
import { LaunchDashboard } from '@/components/LaunchDashboard';
import { auth } from '@/lib/auth';
import { getUserOrg } from '@/lib/org-context';
import Link from 'next/link';

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? process.env.AUTH_URL ?? 'http://localhost:3001').replace(
    /\/$/,
    '',
  );
}

export default async function ConnectGuardianPage() {
  const session = await auth();
  const ctx = await getUserOrg(session!.user!.id);
  if (!ctx) return null;

  const envBlock = `# Required on your self-hosted Guardian host for cloud SSO
GUARDIAN_MULTI_TENANT_ENABLED=true
GUARDIAN_TENANT_ID=${ctx.org.slug}
GUARDIAN_CONTROL_PLANE_URL=${appUrl()}
# Same value as AUTH_SECRET on mcp-guardian-cloud (Vercel → Environment Variables):
GUARDIAN_CLOUD_JWT_SECRET=<paste-cloud-AUTH_SECRET>
DASHBOARD_JWT_SECRET=<same-as-GUARDIAN_CLOUD_JWT_SECRET>
`;

  return (
    <main className="container">
      <p className="footer-links" style={{ marginBottom: '1rem' }}>
        <Link href="/dashboard">← Back to cloud console</Link>
      </p>
      <h1>Connect self-hosted Guardian</h1>
      <p className="muted">
        Optional: open your local or remote Guardian ops dashboard with a one-time SSO token. The
        cloud console (policy, API keys) does not need this.
      </p>

      <div className="card">
        <h2>Environment</h2>
        <p className="muted">Restart Guardian after setting these variables.</p>
        <pre className="env-block">{envBlock}</pre>
      </div>

      <LaunchDashboard />
      <GitHubGettingStarted />
    </main>
  );
}
