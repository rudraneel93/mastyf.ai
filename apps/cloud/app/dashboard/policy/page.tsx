import { auth } from '@/lib/auth';
import { getUserOrg } from '@/lib/org-context';
import { PolicyEditor } from '@/components/PolicyEditor';
import { redirect } from 'next/navigation';

export default async function PolicyPage() {
  const session = await auth();
  const ctx = await getUserOrg(session!.user!.id);
  if (!ctx) redirect('/login');

  return (
    <main className="container">
      <h1>Policy</h1>
      <PolicyEditor initialYaml={ctx.policy?.yamlContent ?? ''} />
    </main>
  );
}
