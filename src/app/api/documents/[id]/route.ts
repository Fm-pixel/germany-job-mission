import { NextResponse } from 'next/server';
import { errorResponse, guard } from '@/lib/api';
import { requireSession } from '@/lib/auth';
import { db } from '@/services/db';
import { deleteDocument, readDocument } from '@/services/documents';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await requireSession();
    const doc = await db.get('documents', id);
    if (!doc) throw new Error('Document not found.');
    const body = await readDocument(id);
    return new NextResponse(new Uint8Array(body), {
      headers: {
        'Content-Type': doc.mimeType,
        'Content-Disposition': `inline; filename="${encodeURIComponent(doc.filename)}"`,
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return guard(async () => {
    await deleteDocument(id);
    return { deleted: true };
  });
}
