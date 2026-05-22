import { eq, isNull } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { licenseExchangeTokens, organizations } from '@/lib/db/schema';
import {
  cloudSsoFeatures,
  hashExchangeToken,
  signCloudSession,
} from '@/lib/license';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const body = (await request.json()) as { token?: string };
  const token = body.token?.trim();
  if (!token) {
    return NextResponse.json({ error: 'token required' }, { status: 400 });
  }

  const tokenHash = hashExchangeToken(token);
  const row = await getDb().query.licenseExchangeTokens.findFirst({
    where: eq(licenseExchangeTokens.tokenHash, tokenHash),
  });

  if (!row || row.usedAt || row.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
  }

  const org = await getDb().query.organizations.findFirst({
    where: eq(organizations.id, row.orgId),
  });
  if (!org) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
  }

  await getDb()
    .update(licenseExchangeTokens)
    .set({ usedAt: new Date() })
    .where(eq(licenseExchangeTokens.id, row.id));

  const sessionToken = signCloudSession({
    tenantSlug: org.slug,
    identity: `cloud:${org.slug}`,
    roles: ['tenant-admin'],
  });

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? process.env.AUTH_URL ?? '').replace(/\/$/, '');

  return NextResponse.json({
    sessionToken,
    tenantSlug: org.slug,
    features: cloudSsoFeatures(),
    cloudBillingUrl: appUrl ? `${appUrl}/dashboard` : '',
    licensed: true,
  });
}
