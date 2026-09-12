import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isOwnerUid, ownerListConfigured, ownerUids } from '@/lib/owner';

const original = { OWNER_UIDS: process.env.OWNER_UIDS, OWNER_UID: process.env.OWNER_UID };

beforeEach(() => {
  delete process.env.OWNER_UIDS;
  delete process.env.OWNER_UID;
});

afterEach(() => {
  process.env.OWNER_UIDS = original.OWNER_UIDS;
  process.env.OWNER_UID = original.OWNER_UID;
  if (original.OWNER_UIDS === undefined) delete process.env.OWNER_UIDS;
  if (original.OWNER_UID === undefined) delete process.env.OWNER_UID;
});

describe('who owns this tool', () => {
  it('reads a list, because each way of signing in is its own Firebase user', () => {
    // email/password + Google share one id; the phone sign-in is a second one.
    process.env.OWNER_UIDS = 'uid-email-google, uid-phone';
    expect(ownerUids()).toEqual(['uid-email-google', 'uid-phone']);
    expect(isOwnerUid('uid-phone')).toBe(true);
    expect(isOwnerUid('uid-email-google')).toBe(true);
    expect(isOwnerUid('somebody-else')).toBe(false);
  });

  it('still honours the original single OWNER_UID', () => {
    process.env.OWNER_UID = 'just-me';
    expect(ownerUids()).toEqual(['just-me']);
    expect(isOwnerUid('just-me')).toBe(true);
    expect(isOwnerUid('other')).toBe(false);
  });

  it('merges both names and ignores duplicates and blanks', () => {
    process.env.OWNER_UIDS = 'a, b, , a';
    process.env.OWNER_UID = 'b';
    expect(ownerUids()).toEqual(['a', 'b']);
  });

  it('reports when nothing is recorded yet, so the caller can decide', () => {
    expect(ownerListConfigured()).toBe(false);
    expect(ownerUids()).toEqual([]);
    // Nothing to compare against yet — the session route falls back to
    // "only while this project has a single user".
    expect(isOwnerUid('anyone')).toBe(true);
    process.env.OWNER_UIDS = 'a';
    expect(ownerListConfigured()).toBe(true);
    expect(isOwnerUid('anyone')).toBe(false);
  });
});
