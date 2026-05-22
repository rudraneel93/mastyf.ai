import { DashboardNav } from '@/components/DashboardNav';
import { auth } from '@/lib/auth';
import { getUserOrg } from '@/lib/org-context';
import { provisionFreeOrganization } from '@/lib/provision';
import { redirect } from 'next/navigation';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  let ctx = await getUserOrg(session.user.id);
  if (!ctx && session.user.email) {
    await provisionFreeOrganization({
      userId: session.user.id,
      email: session.user.email,
      name: session.user.name,
    });
    ctx = await getUserOrg(session.user.id);
  }
  if (!ctx) {
    redirect('/login');
  }

  return (
    <>
      <DashboardNav />
      {children}
    </>
  );
}
