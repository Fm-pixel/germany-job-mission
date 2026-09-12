import { db, type AuditLog } from '../db';

export async function logAudit(entry: {
  who: string;
  what: string;
  why: string;
  candidateId?: string;
  applicationId?: string;
  outcome?: AuditLog['outcome'];
  detail?: string;
}): Promise<AuditLog> {
  return db.create('audit_logs', {
    who: entry.who,
    what: entry.what,
    why: entry.why,
    candidateId: entry.candidateId,
    applicationId: entry.applicationId,
    outcome: entry.outcome ?? 'ok',
    detail: entry.detail,
    at: new Date().toISOString(),
  });
}

export async function recentAudit(limit = 100): Promise<AuditLog[]> {
  const rows = await db.list('audit_logs', { limit: 500 });
  return rows.sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, limit);
}

/** "Has this exact work already been done?" — stops the agents repeating themselves. */
export async function alreadyDone(what: string, withinHours = 20): Promise<boolean> {
  const since = new Date(Date.now() - withinHours * 3600_000).toISOString();
  const rows = await db.list('audit_logs', { where: [{ field: 'what', op: '==', value: what }] });
  return rows.some((row) => row.at >= since && row.outcome !== 'error');
}
