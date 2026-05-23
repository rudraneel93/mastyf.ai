import { randomUUID } from 'crypto';
import { getDb } from '@/lib/db';
import { policies } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export type PublishPolicyResult = {
  version: number;
  publishedAt: string;
};

/** Upsert org policy YAML and bump version (shared by PUT and POST /publish). */
export async function publishPolicyYaml(orgId: string, yaml: string): Promise<PublishPolicyResult> {
  const existing = await getDb().query.policies.findFirst({
    where: eq(policies.orgId, orgId),
  });

  const publishedAt = new Date().toISOString();
  let version = 1;

  if (existing) {
    version = existing.version + 1;
    await getDb()
      .update(policies)
      .set({ yamlContent: yaml, version, updatedAt: new Date() })
      .where(eq(policies.id, existing.id));
  } else {
    await getDb().insert(policies).values({
      id: randomUUID(),
      orgId,
      yamlContent: yaml,
      version: 1,
    });
  }

  return { version, publishedAt };
}
