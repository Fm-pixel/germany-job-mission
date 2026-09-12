/** Central place that answers "is this connected?" — used by the UI banners. */

export interface ConnectionState {
  key: string;
  name: string;
  connected: boolean;
  detail: string;
  setupStep: string;
}

function has(name: string): boolean {
  const v = process.env[name];
  return typeof v === 'string' && v.trim().length > 0;
}

export function firebaseWebConfigured(): boolean {
  return (
    has('NEXT_PUBLIC_FIREBASE_API_KEY') &&
    has('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN') &&
    has('NEXT_PUBLIC_FIREBASE_PROJECT_ID') &&
    has('NEXT_PUBLIC_FIREBASE_APP_ID')
  );
}

export function firebaseProjectId(): string | undefined {
  return process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() || undefined;
}

export function localModeEnabled(): boolean {
  // Test-only, and never a fallback: it needs the flag, a password you chose,
  // and the absence of a real Firebase service account.
  return (
    process.env.GJM_LOCAL_MODE === '1' &&
    has('GJM_LOCAL_PASSWORD') &&
    !has('FIREBASE_SERVICE_ACCOUNT_JSON')
  );
}

export function anthropicConfigured(): boolean {
  return has('ANTHROPIC_API_KEY');
}

export function driveConfigured(): boolean {
  return has('FIREBASE_SERVICE_ACCOUNT_JSON') && has('GOOGLE_DRIVE_FOLDER_ID');
}

export function emailProvider(): 'gmail' | 'resend' | 'none' {
  if (has('RESEND_API_KEY') && has('EMAIL_FROM')) return 'resend';
  if (has('GMAIL_CLIENT_ID') && has('GMAIL_CLIENT_SECRET') && has('GMAIL_REFRESH_TOKEN')) {
    return 'gmail';
  }
  return 'none';
}

export function jobSourceApiKey(): string {
  // The Bundesagentur für Arbeit Jobsuche API uses a fixed public client key.
  // Overridable in case the agency changes it.
  return process.env.BA_JOBSUCHE_API_KEY || 'jobboerse-jobsuche';
}

export function anthropicModel(): string {
  return process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
}

function ownerUidList(): string[] {
  return [process.env.OWNER_UIDS, process.env.OWNER_UID]
    .filter((value): value is string => typeof value === 'string')
    .join(',')
    .split(',')
    .map((uid) => uid.trim())
    .filter(Boolean);
}

function ownerUidsConfigured(): boolean {
  return ownerUidList().length > 0;
}

function ownerUidCount(): number {
  return new Set(ownerUidList()).size;
}

export function connectionStates(): ConnectionState[] {
  const localDb = process.env.GJM_DB_DRIVER === 'local-file';
  return [
    {
      key: 'firestore',
      name: 'Database (Firestore)',
      connected: localDb || has('FIREBASE_SERVICE_ACCOUNT_JSON'),
      detail: localDb
        ? 'LOCAL TEST DATABASE — data is stored in files on the server, not in Firestore.'
        : has('FIREBASE_SERVICE_ACCOUNT_JSON')
          ? 'Connected with the Firebase service account.'
          : 'FIREBASE_SERVICE_ACCOUNT_JSON is missing.',
      setupStep: '1',
    },
    {
      key: 'auth',
      name: 'Login (Firebase Auth)',
      connected: firebaseWebConfigured(),
      detail: firebaseWebConfigured()
        ? `Three ways to sign in — email and password, Google, and a phone code. Project: ${firebaseProjectId()}. Each one must also be switched on in the Firebase console, and this app's web address must be on the authorised-domains list.`
        : localModeEnabled()
          ? 'LOCAL TEST LOGIN is active — this is not real authentication.'
          : 'The NEXT_PUBLIC_FIREBASE_* values are missing. Run npm run firebase:setup, or see SETUP_FOR_ME.md step 1.',
      setupStep: '1',
    },
    {
      key: 'owner',
      name: 'Owner lock',
      connected: ownerUidsConfigured(),
      detail: ownerUidsConfigured()
        ? `Only your own user id(s) can sign in and read the data (${ownerUidCount()} recorded).`
        : 'OWNER_UIDS is not set yet. Until it is, sign-in is only allowed while this Firebase project has a single user. Sign in once, then add your user id.',
      setupStep: '1',
    },
    {
      key: 'drive',
      name: 'Documents (Google Drive)',
      connected: driveConfigured(),
      detail: driveConfigured()
        ? 'Uploads go into your private Drive folder.'
        : 'GOOGLE_DRIVE_FOLDER_ID and/or the service account are missing.',
      setupStep: '2',
    },
    {
      key: 'anthropic',
      name: 'AI (Anthropic API)',
      connected: anthropicConfigured(),
      detail: anthropicConfigured()
        ? `Connected. Model: ${anthropicModel()}.`
        : 'ANTHROPIC_API_KEY is missing — CV extraction, application writing and the agent chat are switched off.',
      setupStep: '3',
    },
    {
      key: 'jobs',
      name: 'Job source (Bundesagentur für Arbeit)',
      connected: true,
      detail: 'Public API of the Federal Employment Agency. No key from you is needed.',
      setupStep: '-',
    },
    {
      key: 'email',
      name: 'Email sending',
      connected: emailProvider() !== 'none',
      detail:
        emailProvider() === 'none'
          ? 'No email provider connected — approved applications wait instead of being sent.'
          : `Connected via ${emailProvider()}.`,
      setupStep: '4',
    },
    {
      key: 'whatsapp',
      name: 'WhatsApp notifications',
      connected: false,
      detail: 'Not connected. Optional — the daily summary is sent by email instead.',
      setupStep: '-',
    },
  ];
}
