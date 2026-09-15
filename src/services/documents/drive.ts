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

/**
 * The address the app acts as. It comes from the service-account key once that
 * is configured; before then, GOOGLE_SERVICE_ACCOUNT_EMAIL lets the app say
 * exactly which address the Drive folder has to be shared with.
 */
export function serviceAccountEmail(): string | undefined {
  return readServiceAccount()?.client_email || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() || undefined;
}

/** True when this permission is the service account, with write access. */
function isServiceAccountEditor(
  permission: { role?: string | null; emailAddress?: string | null },
  email: string,
): boolean {
  return (
    permission.emailAddress?.toLowerCase() === email.toLowerCase() &&
    ['writer', 'owner', 'fileOrganizer', 'organizer'].includes(permission.role ?? '')
  );
}

export interface SharingWarning {
  level: 'danger' | 'warning';
  text: string;
}

/**
 * Reads a Drive permission list and says what is wrong with it.
 *
 * This folder holds passports, diplomas and contracts belonging to other
 * people. "Anyone with the link" is the setting that quietly makes all of that
 * public, so it is called out loudly rather than mentioned.
 */
export function describeSharing(
  permissions: { type?: string | null; role?: string | null; emailAddress?: string | null }[],
  expectedServiceAccount?: string,
): { warnings: SharingWarning[]; sharedWith: string[] } {
  const warnings: SharingWarning[] = [];
  const sharedWith: string[] = [];

  if (expectedServiceAccount) {
    const present = permissions.some((permission) =>
      isServiceAccountEditor(permission, expectedServiceAccount),
    );
    if (!present) {
      warnings.push({
        level: 'danger',
        text: `The folder is not shared with ${expectedServiceAccount} as an Editor, so this app cannot put anything in it. Open the folder in Drive → Share → paste that address → set it to Editor → Send.`,
      });
    }
  }

  for (const permission of permissions) {
    if (permission.type === 'anyone') {
      warnings.push({
        level: 'danger',
        text: 'This folder is set to "anyone with the link". Everything in it — passports, certificates, contracts — can be opened by anybody who ever sees the address. Change it to "Restricted" in Drive.',
      });
      continue;
    }
    if (permission.type === 'domain') {
      warnings.push({
        level: 'danger',
        text: 'This folder is shared with a whole organisation. Share it only with yourself and the service account.',
      });
      continue;
    }
    if (permission.emailAddress) sharedWith.push(`${permission.emailAddress} (${permission.role ?? 'unknown role'})`);
  }

  const people = sharedWith.filter((entry) => !entry.includes('gserviceaccount.com'));
  if (people.length > 2) {
    warnings.push({
      level: 'warning',
      text: `This folder is shared with ${people.length} people. Everyone on that list can read the candidates' documents.`,
    });
  }
  return { warnings, sharedWith };
}

/** Used by the Settings page to prove the connection really works. */
export async function checkDriveConnection(): Promise<{
  ok: boolean;
  message: string;
  warnings?: SharingWarning[];
  sharedWith?: string[];
}> {
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
      fields: 'id,name,permissions(type,role,emailAddress)',
      supportsAllDrives: true,
    });
    const sharing = describeSharing(res.data.permissions ?? [], serviceAccountEmail());
    return {
      ok: true,
      message: `Connected to the Drive folder "${res.data.name}".`,
      warnings: sharing.warnings,
      sharedWith: sharing.sharedWith,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      message: `NOT CONNECTED — Drive refused the request: ${message}. Check that the folder is shared with the service-account email as Editor and that the Drive API is enabled (SETUP_FOR_ME.md step 2).`,
    };
  }
}
