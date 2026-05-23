import { extractBearerToken } from '@/lib/api-keys';
import {
  getUserOrg,
  resolveOrgFromApiKey,
  userCanManageOrg,
} from '@/lib/org-context';
import { publishPolicyYaml } from '@/lib/policy-publish';
import { NextResponse } from 'next/server';

async function resolveWriteContext(request: Request) {
  const bearer = extractBearerToken(request.headers.get('authorization'));
  if (bearer) {
    const apiCtx = await resolveOrgFromApiKey(bearer);
    if (!apiCtx) return null;
    return { orgId: apiCtx.org.id, canManage: true };
  }

  const { auth } = await import('@/lib/auth');
  const session = await auth();
  if (!session?.user?.id) return null;
  const ctx = await getUserOrg(session.user.id);
  if (!ctx) return null;
  return { orgId: ctx.org.id, canManage: userCanManageOrg(ctx.membership) };
}

export async function POST(request: Request) {
  const writeCtx = await resolveWriteContext(request);
  if (!writeCtx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!writeCtx.canManage) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let yaml: string;
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const body = (await request.json()) as { yaml?: string };
    yaml = body.yaml ?? '';
  } else {
    yaml = await request.text();
  }

  if (!yaml.trim()) {
    return NextResponse.json({ error: 'Policy YAML required' }, { status: 400 });
  }

  const { version, publishedAt } = await publishPolicyYaml(writeCtx.orgId, yaml);

  return NextResponse.json({ ok: true, version, publishedAt });
}
