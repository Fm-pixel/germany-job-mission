import { NextResponse } from 'next/server';
import { requireSession, UnauthorizedError } from './auth';

export async function guard<T>(handler: () => Promise<T>): Promise<NextResponse> {
  try {
    await requireSession();
    const data = await handler();
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return errorResponse(err);
  }
}

export function errorResponse(err: unknown): NextResponse {
  if (err instanceof UnauthorizedError) {
    return NextResponse.json({ ok: false, error: 'Not signed in.' }, { status: 401 });
  }
  const code = (err as { code?: string } | null)?.code;
  const message = err instanceof Error ? err.message : String(err);
  if (code === 'AI_NOT_CONNECTED' || code === 'NOT_CONNECTED' || code === 'SOURCE_NOT_CONNECTED') {
    return NextResponse.json({ ok: false, error: message, code }, { status: 503 });
  }
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

/** For the cron routes, which run without a browser session. */
export function cronAuthorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get('authorization') ?? '';
  if (header === `Bearer ${secret}`) return true;
  const url = new URL(request.url);
  return url.searchParams.get('secret') === secret;
}
