/**
 * The Firebase web app for the project `certifypm-pro`.
 *
 * These six values are public identifiers, not secrets: they are compiled into
 * the JavaScript every visitor downloads, and Google documents them as safe to
 * expose. What actually protects the data is Firebase Auth (only the owner's
 * user ids may sign in) and the Firestore rules — not hiding these.
 *
 * They live here so the app works without six environment variables having to
 * be pasted correctly into Vercel. Any of them can still be overridden with an
 * environment variable, which is what you would do to point this code at a
 * different Firebase project.
 */
const CERTIFYPM_PRO = {
  apiKey: 'AIzaSyAed3d7HsG9sXhzi1ONvuKHUCjr4GNTmL0',
  authDomain: 'certifypm-pro.firebaseapp.com',
  projectId: 'certifypm-pro',
  storageBucket: 'certifypm-pro.firebasestorage.app',
  messagingSenderId: '694185611531',
  appId: '1:694185611531:web:e162b6f982a7af3e00920e',
} as const;

/**
 * Deliberately not used:
 * - measurementId / Google Analytics — this is a private tool for a handful of
 *   people; there is no reason to send their usage to an analytics product.
 * - databaseURL / Realtime Database — this tool stores everything in Firestore.
 */
export const firebaseWebConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || CERTIFYPM_PRO.apiKey,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || CERTIFYPM_PRO.authDomain,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || CERTIFYPM_PRO.projectId,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || CERTIFYPM_PRO.storageBucket,
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || CERTIFYPM_PRO.messagingSenderId,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || CERTIFYPM_PRO.appId,
};

export function firebaseWebConfigComplete(): boolean {
  const { apiKey, authDomain, projectId, appId } = firebaseWebConfig;
  return Boolean(apiKey && authDomain && projectId && appId);
}
