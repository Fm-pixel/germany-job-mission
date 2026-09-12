import { NextResponse } from 'next/server';
import { cronAuthorised, errorResponse } from '@/lib/api';
import { runDueAgents } from '@/agents';
import { sendDailySummary, sendWeeklyReport } from '@/services/notify';

export const maxDuration = 300;

/** The single cron entry point. Vercel Cron (daily) and GitHub Actions (hourly) both call it. */
export async function GET(request: Request) {
  if (!cronAuthorised(request)) {
    return NextResponse.json(
      { ok: false, error: 'CRON_SECRET is missing or wrong. The cron route refuses to run.' },
      { status: 401 },
    );
  }
  try {
    const summary = await runDueAgents({ trigger: 'cron' });
    const url = new URL(request.url);
    const notify = url.searchParams.get('notify');
    let notified: unknown = null;
    if (notify === 'daily') notified = await sendDailySummary();
    if (notify === 'weekly') notified = await sendWeeklyReport();
    return NextResponse.json({ ok: true, data: { ...summary, notified } });
  } catch (err) {
    return errorResponse(err);
  }
}

export const POST = GET;
