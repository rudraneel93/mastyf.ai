import { auth } from '@/lib/auth';
import { GITHUB_REPO_URL } from '@/lib/github-links';
import { redirect } from 'next/navigation';

export default async function PostLoginPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }
  redirect(GITHUB_REPO_URL);
}
