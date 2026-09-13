import { cert, getApp, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';

export interface ServiceAccountInfo {
  project_id: string;
  client_email: string;
  private_key: string;
}

export class NotConnectedError extends Error {
  readonly code = 'NOT_CONNECTED';
  constructor(
    readonly service: string,
    readonly missing: string,
    readonly setupStep: string,
  ) {
    super(`${service} is NOT CONNECTED — missing ${missing}. See SETUP_FOR_ME.md step ${setupStep}.`);
    this.name = 'NotConnectedError';
  }
}

/**
 * Reads the service-account key out of the environment.
 *
 * This value gets pasted by hand into consoles, shells and .env files, and it
 * arrives in several shapes. All of these are accepted, because the difference
 * between them is not something the owner should have to debug:
 *   - the plain JSON
 *   - JSON wrapped in single or double quotes
 *   - JSON whose inner quotes were escaped by a shell (\" instead of ")
 *   - the whole thing base64-encoded
 * Anything else returns null, and the app says NOT CONNECTED rather than
 * half-working.
 */
export function readServiceAccount(): ServiceAccountInfo | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw || raw.trim() === '') return null;
  const parsed = parseServiceAccount(raw);
  if (!parsed) return null;
  if (!parsed.project_id || !parsed.client_email || !parsed.private_key) return null;
  // A private key pasted through a shell or a form usually has literal \n.
  return { ...parsed, private_key: parsed.private_key.replace(/\\n/g, '\n') };
}

export function parseServiceAccount(raw: string): ServiceAccountInfo | null {
  const candidates: string[] = [];
  const trimmed = raw.trim();
  candidates.push(trimmed);

  // Wrapped in quotes by a shell or a copy-paste.
  const unquoted =
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
      ? trimmed.slice(1, -1)
      : null;
  if (unquoted) candidates.push(unquoted);

  // Inner quotes escaped, e.g. {\"type\":\"service_account\"}.
  for (const candidate of [...candidates]) {
    if (candidate.includes('\\"')) candidates.push(candidate.replace(/\\"/g, '"'));
  }

  // Base64 of any of the above.
  if (/^[A-Za-z0-9+/=\s]+$/.test(trimmed) && trimmed.length > 100) {
    try {
      candidates.push(Buffer.from(trimmed, 'base64').toString('utf8'));
    } catch {
      // Not base64 after all.
    }
  }

  for (const candidate of candidates) {
    try {
      const value = JSON.parse(candidate) as ServiceAccountInfo;
      if (value && typeof value === 'object' && 'private_key' in value) return value;
    } catch {
      // Try the next shape.
    }
  }
  return null;
}

export function firebaseAdminAvailable(): boolean {
  return readServiceAccount() !== null;
}

let cachedApp: App | null = null;

export function getAdminApp(): App {
  if (cachedApp) return cachedApp;
  if (getApps().length > 0) {
    cachedApp = getApp();
    return cachedApp;
  }
  const serviceAccount = readServiceAccount();
  if (!serviceAccount) {
    throw new NotConnectedError('Firebase', 'FIREBASE_SERVICE_ACCOUNT_JSON', '1');
  }
  cachedApp = initializeApp({
    credential: cert({
      projectId: serviceAccount.project_id,
      clientEmail: serviceAccount.client_email,
      privateKey: serviceAccount.private_key,
    }),
    projectId: serviceAccount.project_id,
  });
  return cachedApp;
}

export function adminDb(): Firestore {
  return getFirestore(getAdminApp());
}

export function adminAuth(): Auth {
  return getAuth(getAdminApp());
}
