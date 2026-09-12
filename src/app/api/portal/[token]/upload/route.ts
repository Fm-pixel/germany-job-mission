import { NextResponse } from 'next/server';
import { findByPortalToken } from '@/services/candidates';
import { storeDocument } from '@/services/documents';
import { logAudit } from '@/services/tracking/audit';
import type { DocumentType } from '@/services/db';

const MAX_BYTES = 15 * 1024 * 1024;

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const candidate = await findByPortalToken(token);
  if (!candidate) return NextResponse.json({ ok: false, error: 'This link is not valid.' }, { status: 404 });

  try {
    const form = await request.formData();
    const file = form.get('file');
    const type = String(form.get('type') ?? 'other') as DocumentType;
    if (!(file instanceof File)) return NextResponse.json({ ok: false, error: 'No file.' }, { status: 400 });
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ ok: false, error: 'The file is larger than 15 MB.' }, { status: 400 });
    }

    const document = await storeDocument({
      candidateId: candidate.id,
      candidateName: candidate.name,
      type,
      filename: file.name,
      mimeType: file.type || 'application/octet-stream',
      body: Buffer.from(await file.arrayBuffer()),
    });
    await logAudit({
      who: `${candidate.name} (their own page)`,
      what: `Uploaded ${file.name} (${type})`,
      why: 'Document requested from them',
      candidateId: candidate.id,
    });
    return NextResponse.json({ ok: true, data: { id: document.id } });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'The upload did not work.' },
      { status: 400 },
    );
  }
}
