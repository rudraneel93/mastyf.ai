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

/** Fleet-wide attack signature hints for opted-in instances (herd immunity). */
export async function GET(request: Request) {
  const orgId = await resolveOrgId(request);
  if (!orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const u = new URL(request.url);
  const windowHours = parseInt(u.searchParams.get('window') || '168', 10);
  const graph = await queryFleetThreatGraph(orgId, Number.isFinite(windowHours) ? windowHours : 168);

  const hints = graph.signatures
    .filter((s) => s.instance_count >= 2)
    .map((s) => ({
      signatureId: s.signature_id,
      rule: s.rule_name,
      tool: s.tool_name,
      category: s.category,
      instanceCount: s.instance_count,
      totalCount: s.event_count,
      message: `${s.instance_count} instances saw ${s.tool_name}/${s.category} (${s.event_count} events)`,
      lastSeen: s.last_seen,
    }));

  return NextResponse.json({
    hints,
    alerts: graph.alerts,
    generatedAt: graph.generatedAt,
    optInRequired: true,
  });
}
