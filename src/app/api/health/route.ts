import { NextResponse } from 'next/server';
import { cronAuthorised } from '@/lib/api';
import { getSession } from '@/lib/auth';
import { connectionStates, firebaseProjectId } from '@/lib/env';
import { collectionPrefix, db, dbStatus } from '@/services/db';
import { checkDriveConnection } from '@/services/documents';
import { aiAvailable } from '@/services/ai/client';
import { ownerUids } from '@/lib/owner';

export const dynamic = 'force-dynamic';

interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

/**
 * "Did the deployment work?" — without having to sign in first.
 *
 * A wrong environment variable otherwise leaves you at a broken page with no
 * way to find out which one. Protected: it needs either a signed-in session or
 * the CRON_SECRET, because it names the project and what is connected.
 *
 *   https://<your app>/api/health?secret=<CRON_SECRET>
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session && !cronAuthorised(request)) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Sign in first, or add ?secret=<CRON_SECRET> to this address. If CRON_SECRET is not set in the environment yet, set it — the automatic daily run needs it too.',
      },
      { status: 401 },
    );
  }

  const checks: Check[] = [];

  const database = dbStatus();
  if (database.connected) {
    try {
      await db.list('candidates', { limit: 1 });
      checks.push({
        name: 'Database (Firestore)',
        ok: true,
        detail: `Reachable, and this tool's collections are named ${collectionPrefix()}…`,
      });
    } catch (err) {
      checks.push({
        name: 'Database (Firestore)',
        ok: false,
        detail: `Configured but the read failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  } else {
    checks.push({
      name: 'Database (Firestore)',
      ok: false,
      detail: `${database.label}. ${database.reason ?? ''}`,
    });
  }

  const drive = await checkDriveConnection().catch((err) => ({
    ok: false,
    message: err instanceof Error ? err.message : String(err),
    warnings: [] as { level: string; text: string }[],
  }));
  checks.push({
    name: 'Documents (Google Drive)',
    ok: drive.ok,
    detail: [drive.message, ...(drive.warnings ?? []).map((w) => w.text)].join(' '),
  });

  checks.push({
    name: 'AI (Anthropic)',
    ok: aiAvailable(),
    detail: aiAvailable()
      ? 'A key is configured. Whether it has credit only shows when something is generated.'
      : 'ANTHROPIC_API_KEY is not set — CV reading, application writing and the assistant are paused.',
  });

  const owners = ownerUids();
  checks.push({
    name: 'Owner lock',
    ok: owners.length > 0,
    detail:
      owners.length > 0
        ? `${owners.length} user id(s) may sign in.`
        : 'OWNER_UIDS is not set. Until it is, sign-in only works while this Firebase project has a single account.',
  });

  const emailState = connectionStates().find((state) => state.key === 'email');
  checks.push({
    name: 'Email sending',
    ok: Boolean(emailState?.connected),
    detail: emailState?.detail ?? '',
  });

  return NextResponse.json({
    ok: checks.every((check) => check.ok),
    project: firebaseProjectId(),
    checks,
    readyToUse: checks.find((c) => c.name === 'Database (Firestore)')?.ok === true && owners.length > 0,
  });
}
