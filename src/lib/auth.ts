import { cookies } from 'next/headers';
import { adminAuth, firebaseAdminAvailable } from '@/services/firebase/admin';
import { localModeEnabled } from './env';

export const SESSION_COOKIE = 'gjm_session';
export const LOCAL_SESSION_VALUE = 'local-test-session';

export interface Session {
  uid: string;
  email?: string;
  mode: 'firebase' | 'local-test';
}

/** Verifies the session cookie. Returns null when nobody is logged in. */
export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const value = store.get(SESSION_COOKIE)?.value;
  if (!value) return null;
  return verifySessionValue(value);
}

export async function verifySessionValue(value: string): Promise<Session | null> {
  if (value === LOCAL_SESSION_VALUE) {
    return localModeEnabled() ? { uid: 'local-test-user', mode: 'local-test' } : null;
  }
  if (!firebaseAdminAvailable()) return null;
  try {
    const decoded = await adminAuth().verifySessionCookie(value, true);
    const ownerUid = process.env.OWNER_UID?.trim();
    if (ownerUid && decoded.uid !== ownerUid) return null;
    return { uid: decoded.uid, email: decoded.email, mode: 'firebase' };
  } catch {
    return null;
  }
}

export class UnauthorizedError extends Error {
  readonly status = 401;
  constructor(message = 'Not signed in') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

/** Use at the top of every protected API route. */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new UnauthorizedError();
  return session;
}

/** True while no account exists yet — sign-up is only allowed in that window. */
export async function signUpAllowed(): Promise<boolean> {
  if (!firebaseAdminAvailable()) return false;
  if (process.env.OWNER_UID?.trim()) return false;
  const users = await adminAuth().listUsers(2);
  return users.users.length === 0;
}
