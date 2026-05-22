import Link from 'next/link';

export default function TermsPage() {
  return (
    <main className="container">
      <h1>Terms of Service</h1>
      <div className="card">
        <p>
          MCP Guardian Cloud provides an optional hosted control plane for managing policies and
          tenant configuration for self-hosted MCP Guardian deployments. The service is free and
          open source; use it in compliance with applicable laws.
        </p>
        <p>
          The service is provided as-is. You are responsible for securing your self-hosted
          Guardian instance and API keys.
        </p>
      </div>
      <Link href="/">Back to home</Link>
    </main>
  );
}
