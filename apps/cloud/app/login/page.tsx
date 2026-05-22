import Link from 'next/link';
import { SignInButtons } from '@/components/SignInButtons';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

type Props = {
  searchParams: Promise<{ callbackUrl?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const session = await auth();
  const params = await searchParams;
  const callbackUrl = params.callbackUrl ?? '/dashboard';

  if (session) {
    redirect(callbackUrl);
  }

  return (
    <main className="container">
      <section className="hero">
        <h1>Sign in</h1>
        <p className="muted">Use Google or GitHub to access MCP Guardian Cloud.</p>
      </section>
      <SignInButtons callbackUrl={callbackUrl} />
      <p className="footer-links">
        <Link href="/">Back to home</Link>
      </p>
    </main>
  );
}
