import { guard } from '@/lib/api';
import { db, type DocumentType } from '@/services/db';
import { storeDocument } from '@/services/documents';

const ALLOWED: DocumentType[] = [
  'CV',
  'certificate',
  'diploma',
  'reference',
  'language certificate',
  'passport',
  'contract',
  'school certificate',
  'other',
];

const MAX_BYTES = 15 * 1024 * 1024;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return guard(async () => db.byCandidate('documents', id));
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return guard(async () => {
    const candidate = await db.get('candidates', id);
    if (!candidate) throw new Error('Person not found.');

    const form = await request.formData();
    const file = form.get('file');
    const type = String(form.get('type') ?? 'other') as DocumentType;
    if (!(file instanceof File)) throw new Error('No file was sent.');
    if (!ALLOWED.includes(type)) throw new Error(`Unknown document type "${type}".`);
    if (file.size > MAX_BYTES) throw new Error('The file is larger than 15 MB.');

    const body = Buffer.from(await file.arrayBuffer());
    return storeDocument({
      candidateId: id,
      candidateName: candidate.name,
      type,
      filename: file.name,
      mimeType: file.type || 'application/octet-stream',
      body,
    });
  });
}
