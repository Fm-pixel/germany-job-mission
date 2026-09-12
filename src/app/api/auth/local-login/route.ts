import { NextResponse } from 'next/server';
import { LOCAL_SESSION_VALUE, SESSION_COOKIE } from '@/lib/auth';
import { localModeEnabled } from '@/lib/env';
import { secretsMatch } from '@/lib/safe';

/**
 * Test-only login. It exists so the app can be clicked through without a
 * Firebase project; it refuses to work as soon as a real Firebase service
 * account is configured, and the UI shows a permanent warning banner.
 */
export async function POST(request: Request) {
  if (!localModeEnabled()) {
    return NextResponse.json({ error: 'Local test login is not enabled.' }, { status: 404 });
  }
  const expected = process.env.GJM_LOCAL_PASSWORD?.trim();
  if (!expected) {
    // No guessable default: without a password of your own there is no way in.
    return NextResponse.json(
      { error: 'Local test login needs GJM_LOCAL_PASSWORD to be set. There is no default password.' },
      { status: 404 },
    );
  }
  const form = await request.formData();
  const password = String(form.get('password') ?? '');
  if (!secretsMatch(password, expected)) {
    return NextResponse.redirect(new URL('/login?error=1', request.url), { status: 303 });
  }
  const response = NextResponse.redirect(new URL('/', request.url), { status: 303 });
  response.cookies.set(SESSION_COOKIE, LOCAL_SESSION_VALUE, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 12,
  });
  return response;
}
