import Link from 'next/link';
import { auth } from '@/lib/auth';
import { GITHUB_REPO_URL } from '@/lib/github-links';
import { resolveProCheckoutUrl } from '@/lib/pro-checkout-url';

const PRO_CHECKOUT_URL = resolveProCheckoutUrl();

export default async function HomePage() {
  const session = await auth();

  return (
    <main className="container">
      <section className="hero">
        <h1>MCP Guardian</h1>
        <p>
          Runtime security, cost governance, and health monitoring for Model Context Protocol (MCP)
          infrastructure. Self-hosted open source with an optional cloud control plane.
        </p>
      </section>

      <div className="pricing-grid">
        <section className="price-card">
          <div className="badge badge-muted">Community</div>
          <div className="amount">Free</div>
          <div className="period">MIT open source</div>
          <p className="muted" style={{ marginTop: '1rem' }}>
            Proxy, CLI, and local policy (block mode). Sign in records your org for optional cloud
            policy and API keys; install and run Guardian from GitHub on your own servers.
          </p>
          {session ? (
            <>
              <a
                href={GITHUB_REPO_URL}
                className="btn btn-primary"
                style={{ display: 'block' }}
                rel="noopener noreferrer"
              >
                Get started on GitHub
              </a>
              <Link href="/dashboard" className="btn" style={{ display: 'block', marginTop: '0.5rem' }}>
                Cloud console
              </Link>
            </>
          ) : (
            <Link href="/login" className="btn btn-primary" style={{ display: 'block' }}>
              Sign in (free)
            </Link>
          )}
        </section>

        <section className="price-card price-card-pro">
          <div className="badge badge-active">Pro</div>
          <div className="amount">$4.99</div>
          <div className="period">Lifetime · one-time</div>
          <p className="muted" style={{ marginTop: '1rem' }}>
            Lifetime Pro license for self-hosted deployments. Includes your license key by email and
            setup guide. Supports ongoing development.
          </p>
          <ul className="pro-features">
            <li>Lifetime license key (no subscription)</li>
            <li>Self-hosted — you control your data</li>
            <li>Email support via purchase receipt</li>
          </ul>
          <a
            href={PRO_CHECKOUT_URL}
            className="btn btn-primary"
            style={{ display: 'block' }}
            rel="noopener noreferrer"
          >
            Buy Pro — $4.99
          </a>
          <Link href="https://github.com/rudraneel93/mcp-guardian/blob/master/docs/PRO_SETUP.md" className="btn">
            Pro setup guide
          </Link>
        </section>
      </div>

      <section className="card" style={{ marginTop: '2rem' }}>
        <h2>Cloud control plane (optional)</h2>
        <p className="muted">
          Free sign-in with Google or GitHub sends you to the MCP Guardian repo to get started.
          Use the <Link href="/dashboard">cloud console</Link> when you need policy management,
          tenant provisioning, API keys, or advanced SSO into a running self-hosted instance.
        </p>
      </section>

      <div className="footer-links">
        <Link href="/terms">Terms</Link>
        <Link href="/privacy">Privacy</Link>
        <a href="https://github.com/rudraneel93/mcp-guardian">GitHub</a>
        <a href="https://www.npmjs.com/package/@mcp-guardian/server">npm</a>
      </div>
    </main>
  );
}
