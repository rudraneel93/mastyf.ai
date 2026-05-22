import { randomUUID } from 'crypto';
import { eq, and, isNull } from 'drizzle-orm';
import { extractBearerToken, generateApiKey } from '@/lib/api-keys';
import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { apiKeys } from '@/lib/db/schema';
import {
  getUserOrg,
  resolveOrgFromApiKey,
  userCanManageOrg,
} from '@/lib/org-context';
import { NextResponse } from 'next/server';

async function authorizeRotate(request: Request): Promise<{ orgId: string } | null> {
  const bearer = extractBearerToken(request.headers.get('authorization'));
  if (bearer) {
    const ctx = await resolveOrgFromApiKey(bearer);
    if (!ctx) return null;
    return { orgId: ctx.org.id };
  }

  const session = await auth();
  if (!session?.user?.id) return null;
  const ctx = await getUserOrg(session.user.id);
  if (!ctx || !userCanManageOrg(ctx.membership)) return null;
  return { orgId: ctx.org.id };
}

export async function POST(request: Request) {
  const authCtx = await authorizeRotate(request);
  if (!authCtx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await getDb()
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeys.orgId, authCtx.orgId), isNull(apiKeys.revokedAt)));

  const { plaintext, prefix, hash } = generateApiKey();
  await getDb().insert(apiKeys).values({
    id: randomUUID(),
    orgId: authCtx.orgId,
    keyHash: hash,
    prefix,
    name: 'default',
  });

  return NextResponse.json({ apiKey: plaintext });
}
