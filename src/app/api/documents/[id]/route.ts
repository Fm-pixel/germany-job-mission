import { NextResponse } from 'next/server';
import { errorResponse, guard } from '@/lib/api';
import { requireSession } from '@/lib/auth';
import { db } from '@/services/db';
import { deleteDocument, readDocument } from '@/services/documents';
import { howToServe, safeFilename } from '@/lib/safe';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await requireSession();
    const doc = await db.get('documents', id);
    if (!doc) throw new Error('Document not found.');
    const body = await readDocument(id);
    // A file somebody else uploaded is never rendered as HTML on this origin.
    const serve = howToServe(doc.mimeType, doc.filename);
    return new NextResponse(new Uint8Array(body), {
      headers: {
        'Content-Type': serve.contentType,
        'Content-Disposition': `${serve.disposition}; filename="${safeFilename(doc.filename)}"`,
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'Cache-Control': 'private, no-store',
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
