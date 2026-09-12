import fs from 'node:fs';
import path from 'node:path';
import { db, localTestModeEnabled, type DocumentType, type StoredDocument } from '../db';
import { driveAvailable, deleteFile, downloadFile, ensureCandidateFolder, uploadFile } from './drive';

const FOLDER_FOR_TYPE: Record<DocumentType, string> = {
  CV: 'CV',
  certificate: 'certificates',
  diploma: 'diplomas',
  reference: 'references',
  'language certificate': 'language',
  passport: 'passport',
  contract: 'contracts',
  'school certificate': 'school',
  other: 'other',
};

function localDir(): string {
  return process.env.GJM_LOCAL_FILES_DIR || path.join(process.cwd(), '.gjm-data', 'files');
}

export interface UploadInput {
  candidateId: string;
  candidateName: string;
  type: DocumentType;
  filename: string;
  mimeType: string;
  body: Buffer;
}

export async function storeDocument(input: UploadInput): Promise<StoredDocument> {
  if (driveAvailable()) {
    const folderId = await ensureCandidateFolder(
      input.candidateName,
      input.candidateId,
      FOLDER_FOR_TYPE[input.type],
    );
    const { fileId } = await uploadFile({
      folderId,
      filename: input.filename,
      mimeType: input.mimeType,
      body: input.body,
    });
    return db.create('documents', {
      candidateId: input.candidateId,
      type: input.type,
      filename: input.filename,
      mimeType: input.mimeType,
      size: input.body.length,
      driveFileId: fileId,
      storage: 'drive',
    });
  }

  if (!localTestModeEnabled()) {
    throw new Error(
      'Google Drive is NOT CONNECTED — documents cannot be stored. See SETUP_FOR_ME.md step 2.',
    );
  }

  const dir = path.join(localDir(), input.candidateId);
  fs.mkdirSync(dir, { recursive: true });
  const safeName = `${Date.now()}-${input.filename.replace(/[^\w.\-]+/g, '_')}`;
  const fullPath = path.join(dir, safeName);
  fs.writeFileSync(fullPath, input.body);
  return db.create('documents', {
    candidateId: input.candidateId,
    type: input.type,
    filename: input.filename,
    mimeType: input.mimeType,
    size: input.body.length,
    storage: 'local-test',
    localPath: fullPath,
  });
}

export async function readDocument(documentId: string): Promise<Buffer> {
  const doc = await db.get('documents', documentId);
  if (!doc) throw new Error('Document not found.');
  if (doc.storage === 'drive' && doc.driveFileId) return downloadFile(doc.driveFileId);
  if (doc.localPath && fs.existsSync(doc.localPath)) return fs.readFileSync(doc.localPath);
  throw new Error('The file is not available any more.');
}

export async function deleteDocument(documentId: string): Promise<void> {
  const doc = await db.get('documents', documentId);
  if (!doc) return;
  if (doc.storage === 'drive' && doc.driveFileId) {
    await deleteFile(doc.driveFileId).catch(() => undefined);
  } else if (doc.localPath && fs.existsSync(doc.localPath)) {
    fs.unlinkSync(doc.localPath);
  }
  await db.remove('documents', documentId);
}

/** Plain text out of a CV so the AI can read it. PDFs are sent to the AI as-is. */
export async function extractText(doc: StoredDocument, body: Buffer): Promise<string | null> {
  const name = doc.filename.toLowerCase();
  if (doc.mimeType === 'text/plain' || name.endsWith('.txt')) return body.toString('utf8');
  if (
    name.endsWith('.docx') ||
    doc.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer: body });
    return result.value;
  }
  return null;
}

export function isPdf(doc: { filename: string; mimeType: string }): boolean {
  return doc.mimeType === 'application/pdf' || doc.filename.toLowerCase().endsWith('.pdf');
}

export { driveAvailable, checkDriveConnection } from './drive';
