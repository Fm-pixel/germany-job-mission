import { guard } from '@/lib/api';
import { db } from '@/services/db';
import { extractText, isPdf, readDocument } from '@/services/documents';
import { extractCv } from '@/services/ai/cv';
import { applyExtraction, toPendingExtraction, type PendingExtraction } from '@/services/candidates';
import { aiAvailable } from '@/services/ai/client';

/** Step 1: read the CV and return what was found — nothing is saved yet. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return guard(async () => {
    if (!aiAvailable()) {
      throw Object.assign(
        new Error(
          'CV analysis needs the Anthropic API. It is NOT CONNECTED — add ANTHROPIC_API_KEY (SETUP_FOR_ME.md step 3). You can still fill the profile in by hand.',
        ),
        { code: 'AI_NOT_CONNECTED' },
      );
    }
    const { documentId } = (await request.json()) as { documentId?: string };
    if (!documentId) throw new Error('Choose the CV to analyse.');
    const doc = await db.get('documents', documentId);
    if (!doc || doc.candidateId !== id) throw new Error('Document not found for this person.');

    const body = await readDocument(documentId);
    const text = await extractText(doc, body);
    if (!isPdf(doc) && !text) {
      throw new Error(
        `"${doc.filename}" is neither a PDF nor a DOCX/TXT file, so its text cannot be read. Upload the CV as PDF.`,
      );
    }
    const extraction = await extractCv({
      pdf: isPdf(doc) ? body : undefined,
      text: text ?? undefined,
      filename: doc.filename,
    });
    return { documentId, pending: toPendingExtraction(extraction) };
  });
}

/** Step 2: I confirmed the fields — now they become the profile. */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return guard(async () => {
    const body = (await request.json()) as { documentId?: string; pending: PendingExtraction };
    if (!body?.pending) throw new Error('Nothing to confirm.');
    return applyExtraction(id, body.pending, body.documentId);
  });
}
