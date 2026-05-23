import { randomUUID } from 'crypto';
import { extractBearerToken } from '@/lib/api-keys';
import { parseHeartbeatBody } from '@/lib/fleet-heartbeat';
import { resolveOrgFromApiKey } from '@/lib/org-context';
import { getDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const bearer = extractBearerToken(request.headers.get('authorization'));
  if (!bearer) {
    return NextResponse.json({ error: 'Bearer API key required' }, { status: 401 });
  }

  const ctx = await resolveOrgFromApiKey(bearer);
  if (!ctx) {
    return NextResponse.json({ error: 'Invalid or inactive API key' }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = parseHeartbeatBody(raw);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const body = parsed.data;

  const db = getDb();
  const rowId = randomUUID();
  await db.execute(sql`
    INSERT INTO guardian_fleet_instances (
      id, org_id, instance_id, instance_name, region, version, hostname,
      status, metrics_snapshot, last_heartbeat
    ) VALUES (
      ${rowId},
      ${ctx.org.id},
      ${body.instanceId},
      ${body.instanceName ?? null},
      ${body.region ?? null},
      ${body.version ?? null},
      ${body.hostname ?? null},
      'active',
      ${JSON.stringify(body.metrics ?? {})}::jsonb,
      NOW()
    )
    ON CONFLICT (org_id, instance_id) DO UPDATE SET
      instance_name = EXCLUDED.instance_name,
      region = EXCLUDED.region,
      version = EXCLUDED.version,
      hostname = EXCLUDED.hostname,
      status = 'active',
      metrics_snapshot = EXCLUDED.metrics_snapshot,
      last_heartbeat = NOW()
  `);

  return NextResponse.json({ ok: true, instanceId: body.instanceId });
}
