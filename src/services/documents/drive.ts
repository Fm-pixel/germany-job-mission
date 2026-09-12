import { google, type drive_v3 } from 'googleapis';
import { NotConnectedError, readServiceAccount } from '../firebase/admin';

const SCOPES = ['https://www.googleapis.com/auth/drive'];

let cachedClient: drive_v3.Drive | null = null;

export function driveAvailable(): boolean {
  return readServiceAccount() !== null && Boolean(process.env.GOOGLE_DRIVE_FOLDER_ID?.trim());
}

export function rootFolderId(): string {
  const id = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim();
  if (!id) throw new NotConnectedError('Google Drive', 'GOOGLE_DRIVE_FOLDER_ID', '2');
  return id;
}

export function driveClient(): drive_v3.Drive {
  if (cachedClient) return cachedClient;
  const sa = readServiceAccount();
  if (!sa) throw new NotConnectedError('Google Drive', 'FIREBASE_SERVICE_ACCOUNT_JSON', '1');
  const auth = new google.auth.JWT({
    email: sa.client_email,
    key: sa.private_key,
    scopes: SCOPES,
  });
  cachedClient = google.drive({ version: 'v3', auth });
  return cachedClient;
}

function escapeName(name: string): string {
  return name.replace(/'/g, "\\'");
}

/**
 * Finds (or creates) a subfolder inside a parent folder.
 * The client can be passed in so this logic is testable without a Drive account.
 */
export async function ensureFolder(
  name: string,
  parentId: string,
  client: drive_v3.Drive = driveClient(),
): Promise<string> {
  const drive = client;
  const res = await drive.files.list({
    q: `name='${escapeName(name)}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id,name)',
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const existing = res.data.files?.[0]?.id;
  if (existing) return existing;

  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id',
    supportsAllDrives: true,
  });
  if (!created.data.id) throw new Error(`Could not create the Drive folder "${name}".`);
  return created.data.id;
}

export async function ensureCandidateFolder(
  candidateName: string,
  candidateId: string,
  subfolder?: string,
  client: drive_v3.Drive = driveClient(),
): Promise<string> {
  const personFolder = await ensureFolder(`${candidateName} (${candidateId})`, rootFolderId(), client);
  if (!subfolder) return personFolder;
  return ensureFolder(subfolder, personFolder, client);
}

export async function uploadFile(
  params: {
    folderId: string;
    filename: string;
    mimeType: string;
    body: Buffer;
  },
  client: drive_v3.Drive = driveClient(),
): Promise<{ fileId: string }> {
  const drive = client;
  const { Readable } = await import('node:stream');
  const res = await drive.files.create({
    requestBody: { name: params.filename, parents: [params.folderId] },
    media: { mimeType: params.mimeType, body: Readable.from(params.body) },
    fields: 'id',
    supportsAllDrives: true,
  });
  if (!res.data.id) throw new Error('Drive did not return a file ID.');
  return { fileId: res.data.id };
}

export async function downloadFile(fileId: string): Promise<Buffer> {
  const drive = driveClient();
  const res = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'arraybuffer' },
  );
  return Buffer.from(res.data as ArrayBuffer);
}

export async function deleteFile(fileId: string): Promise<void> {
  await driveClient().files.delete({ fileId, supportsAllDrives: true });
}

/** Used by the Settings page to prove the connection really works. */
export async function checkDriveConnection(): Promise<{ ok: boolean; message: string }> {
  if (!driveAvailable()) {
    return {
      ok: false,
      message:
        'NOT CONNECTED — the service account JSON and/or GOOGLE_DRIVE_FOLDER_ID are missing. See SETUP_FOR_ME.md step 2.',
    };
  }
  try {
    const res = await driveClient().files.get({
      fileId: rootFolderId(),
      fields: 'id,name',
      supportsAllDrives: true,
    });
    return { ok: true, message: `Connected to the Drive folder "${res.data.name}".` };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      message: `NOT CONNECTED — Drive refused the request: ${message}. Check that the folder is shared with the service-account email as Editor and that the Drive API is enabled (SETUP_FOR_ME.md step 2).`,
    };
  }
}
