import { auth } from '@/lib/auth';
import { getUserOrg, userCanManageOrg } from '@/lib/org-context';
import { getDb } from '@/lib/db';
import { policies } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ctx = await getUserOrg(session.user.id);
  if (!ctx || !userCanManageOrg(ctx.membership)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = (await request.json()) as { yaml?: string };
  const yaml = body.yaml ?? '';
  if (!yaml.trim()) {
    return NextResponse.json({ error: 'Policy YAML required' }, { status: 400 });
  }

  const existing = ctx.policy;
  if (existing) {
    await getDb()
      .update(policies)
      .set({
        yamlContent: yaml,
        version: existing.version + 1,
        updatedAt: new Date(),
      })
      .where(eq(policies.id, existing.id));
  } else {
    const { randomUUID } = await import('crypto');
    await getDb().insert(policies).values({
      id: randomUUID(),
      orgId: ctx.org.id,
      yamlContent: yaml,
      version: 1,
    });
  }

  return NextResponse.json({ ok: true });
}
