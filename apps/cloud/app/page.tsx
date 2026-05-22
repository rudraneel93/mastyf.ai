import Link from 'next/link';
import { auth } from '@/lib/auth';

export default async function HomePage() {
  const session = await auth();

  return (
    <main className="container">
      <section className="hero">
        <h1>MCP Guardian Cloud</h1>
        <p>
          Optional hosted control plane for policy management, tenant provisioning, and API keys.
          Run Guardian on your infrastructure — free and open source.
        </p>
      </section>

      <section className="price-card">
        <div className="amount">Free</div>
        <div className="period">Open source</div>
        <p className="muted" style={{ marginTop: '1rem' }}>
          Sign in with Google or GitHub to get an organization, policy editor, API keys, and SSO
          into your self-hosted dashboard. No payment required.
        </p>
        {session ? (
          <Link href="/dashboard" className="btn btn-primary" style={{ display: 'block' }}>
            Go to dashboard
          </Link>
        ) : (
          <Link href="/login" className="btn btn-primary" style={{ display: 'block' }}>
            Sign in to get started
          </Link>
        )}
      </section>

      <div className="footer-links">
        <Link href="/terms">Terms</Link>
        <Link href="/privacy">Privacy</Link>
      </div>
    </main>
  );
}
