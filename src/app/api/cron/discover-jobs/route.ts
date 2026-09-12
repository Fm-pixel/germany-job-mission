import { NextResponse } from 'next/server';
import { cronAuthorised, errorResponse } from '@/lib/api';
import { runDueAgents } from '@/agents';

/** Job discovery only — searches and stores, never sends anything. */
export async function GET(request: Request) {
  if (!cronAuthorised(request)) {
    return NextResponse.json({ ok: false, error: 'CRON_SECRET is missing or wrong.' }, { status: 401 });
  }
  try {
    const summary = await runDueAgents({ trigger: 'cron', only: ['scout', 'matcher'], force: true });
    return NextResponse.json({ ok: true, data: summary });
  } catch (err) {
    return errorResponse(err);
  }
}
