import { auth } from '@/lib/auth';
import { getUserOrg } from '@/lib/org-context';
import { SettingsClient } from '@/components/SettingsClient';
import { signOutAction } from '@/app/actions';
import { redirect } from 'next/navigation';

export default async function SettingsPage() {
  const session = await auth();
  const ctx = await getUserOrg(session!.user!.id);
  if (!ctx) redirect('/login');

  return (
    <main className="container">
      <h1>Settings</h1>
      <SettingsClient orgName={ctx.org.name} />
      <div className="card">
        <h2>Account</h2>
        <p className="muted">Signed in as {session?.user?.email}</p>
        <form action={signOutAction}>
          <button type="submit" className="btn">
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
