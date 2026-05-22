import { extractBearerToken } from '@/lib/api-keys';
import { auth } from '@/lib/auth';
import { getUserOrg, resolveOrgFromApiKey } from '@/lib/org-context';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const bearer = extractBearerToken(request.headers.get('authorization'));
  if (bearer) {
    const ctx = await resolveOrgFromApiKey(bearer);
    if (!ctx) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }
    return NextResponse.json({
      id: ctx.org.id,
      slug: ctx.org.slug,
      name: ctx.org.name,
    });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ctx = await getUserOrg(session.user.id);
  if (!ctx) {
    return NextResponse.json({ error: 'No organization' }, { status: 403 });
  }

  return NextResponse.json({
    id: ctx.org.id,
    slug: ctx.org.slug,
    name: ctx.org.name,
  });
}
