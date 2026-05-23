import { extractBearerToken } from '@/lib/api-keys';
import { queryFleetThreatGraph } from '@/lib/fleet-threat-graph';
import { resolveOrgFromApiKey } from '@/lib/org-context';
import { auth } from '@/lib/auth';
import { getUserOrg } from '@/lib/org-context';
import { NextResponse } from 'next/server';

async function resolveOrgId(request: Request): Promise<string | null> {
  const bearer = extractBearerToken(request.headers.get('authorization'));
  if (bearer) {
    const ctx = await resolveOrgFromApiKey(bearer);
    return ctx?.org.id ?? null;
  }
  const session = await auth();
  if (session?.user?.id) {
    const ctx = await getUserOrg(session.user.id);
    return ctx?.org.id ?? null;
  }
  return null;
}

export async function GET(request: Request) {
  const orgId = await resolveOrgId(request);
  if (!orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const windowHours = parseInt(url.searchParams.get('windowHours') || '24', 10);
  const graph = await queryFleetThreatGraph(orgId, Number.isFinite(windowHours) ? windowHours : 24);
  return NextResponse.json(graph);
}
