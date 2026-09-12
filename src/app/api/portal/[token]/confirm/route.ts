import { NextResponse } from 'next/server';
import { db } from '@/services/db';
import { findByPortalToken, getProfile, upsertProfile } from '@/services/candidates';
import { logAudit } from '@/services/tracking/audit';

/** The person confirms one of the "needs confirmation" items on their own page. */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const candidate = await findByPortalToken(token);
  if (!candidate) return NextResponse.json({ ok: false, error: 'This link is not valid.' }, { status: 404 });

  const { field, value } = (await request.json()) as { field?: string; value?: string };
  if (!field) return NextResponse.json({ ok: false, error: 'Nothing to confirm.' }, { status: 400 });

  const profile = await getProfile(candidate.id);
  const remaining = (profile?.needsConfirmation ?? []).filter((item) => item.field !== field);
  await upsertProfile(candidate.id, { needsConfirmation: remaining });

  await db.create('notes', {
    candidateId: candidate.id,
    text: `${candidate.name} confirmed "${field}": ${value || '(no text given)'}`,
    author: 'agent',
  });
  await logAudit({
    who: `${candidate.name} (their own page)`,
    what: `Confirmed "${field}"`,
    why: 'Answered a question marked as needing confirmation',
    candidateId: candidate.id,
    detail: value?.slice(0, 200),
  });

  return NextResponse.json({ ok: true, data: { remaining: remaining.length } });
}
