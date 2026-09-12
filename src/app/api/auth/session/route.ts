import { NextResponse } from 'next/server';
import { adminAuth, firebaseAdminAvailable } from '@/services/firebase/admin';
import { SESSION_COOKIE } from '@/lib/auth';

const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

export async function POST(request: Request) {
  if (!firebaseAdminAvailable()) {
    return NextResponse.json(
      { error: 'Firebase is NOT CONNECTED on the server (FIREBASE_SERVICE_ACCOUNT_JSON missing).' },
      { status: 503 },
    );
  }
  const { idToken } = (await request.json()) as { idToken?: string };
  if (!idToken) return NextResponse.json({ error: 'No token sent.' }, { status: 400 });

  try {
    const decoded = await adminAuth().verifyIdToken(idToken, true);
    const ownerUid = process.env.OWNER_UID?.trim();
    if (ownerUid && decoded.uid !== ownerUid) {
      return NextResponse.json({ error: 'This account is not the owner of this tool.' }, { status: 403 });
    }
    if (!ownerUid) {
      const users = await adminAuth().listUsers(2);
      if (users.users.length > 1) {
        return NextResponse.json(
          { error: 'More than one account exists. Set OWNER_UID so only your account can sign in.' },
          { status: 403 },
        );
      }
    }
    const cookie = await adminAuth().createSessionCookie(idToken, { expiresIn: FIVE_DAYS_MS });
    const response = NextResponse.json({ ok: true, uid: decoded.uid });
    response.cookies.set(SESSION_COOKIE, cookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: FIVE_DAYS_MS / 1000,
    });
    return response;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'The token could not be verified.' },
      { status: 401 },
    );
  }
}
