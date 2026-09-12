import { NextResponse } from 'next/server';
import { adminAuth, firebaseAdminAvailable } from '@/services/firebase/admin';
import { SESSION_COOKIE } from '@/lib/auth';
import { isOwnerUid, ownerListConfigured, ownerUids } from '@/lib/owner';

const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

/**
 * Turns a Firebase sign-in into this app's session cookie — whichever of the
 * three ways was used (email and password, Google, or a phone code).
 */
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

    if (ownerListConfigured()) {
      if (!isOwnerUid(decoded.uid)) {
        return NextResponse.json(
          {
            error:
              'This account is not the owner of this tool. If it is really you — a phone sign-in and a Google sign-in are different Firebase users — add this user ID to OWNER_UIDS: ' +
              decoded.uid,
          },
          { status: 403 },
        );
      }
    } else {
      // No owner recorded yet: only safe while this project has a single user.
      const users = await adminAuth().listUsers(2);
      if (users.users.length > 1) {
        return NextResponse.json(
          {
            error:
              'More than one account exists in this Firebase project. Set OWNER_UIDS to your own user ID(s) so only you can sign in.',
          },
          { status: 403 },
        );
      }
    }

    const cookie = await adminAuth().createSessionCookie(idToken, { expiresIn: FIVE_DAYS_MS });
    const response = NextResponse.json({
      ok: true,
      uid: decoded.uid,
      signInProvider: decoded.firebase?.sign_in_provider,
      ownerListConfigured: ownerListConfigured(),
      ownerUids: ownerUids(),
    });
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
