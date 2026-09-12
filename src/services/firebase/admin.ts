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

export function readServiceAccount(): ServiceAccountInfo | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw || raw.trim() === '') return null;
  try {
    const parsed = JSON.parse(raw) as ServiceAccountInfo;
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) return null;
    return { ...parsed, private_key: parsed.private_key.replace(/\\n/g, '\n') };
  } catch {
    return null;
  }
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
