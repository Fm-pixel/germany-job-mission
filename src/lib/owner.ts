/**
 * Who is allowed into this tool.
 *
 * With more than one way to sign in, one person can end up with more than one
 * Firebase user id: Google and email/password are merged when they share an
 * address, but a phone sign-in is always a separate user with no email at all.
 * So the owner is a LIST of ids, not a single one.
 *
 * OWNER_UIDS  — comma-separated list (preferred)
 * OWNER_UID   — the original single value, still honoured
 */
export function ownerUids(): string[] {
  const raw = [process.env.OWNER_UIDS, process.env.OWNER_UID]
    .filter((value): value is string => typeof value === 'string')
    .join(',');
  return [...new Set(raw.split(',').map((uid) => uid.trim()).filter(Boolean))];
}

export function ownerListConfigured(): boolean {
  return ownerUids().length > 0;
}

export function isOwnerUid(uid: string): boolean {
  const list = ownerUids();
  // Before the first id is recorded the check cannot run; the caller decides
  // what to do in that window (see signUpAllowed / the session route).
  if (list.length === 0) return true;
  return list.includes(uid);
}
