import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LocalFileDriver } from '@/services/db/drivers/local-file';
import { applyQueryInMemory, stripUndefined } from '@/services/db/driver';
import { COLLECTION_NAMES } from '@/services/db/types';

let dir: string;
let driver: LocalFileDriver;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gjm-test-'));
  driver = new LocalFileDriver(dir);
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('the data layer', () => {
  it('creates with an id and timestamps', async () => {
    const row = await driver.create('candidates', { name: 'Jean', country: 'Rwanda' } as never);
    expect(row.id).toBeTruthy();
    expect(row.createdAt).toBeTruthy();
    expect(row.updatedAt).toBeTruthy();
  });

  it('reads back what it wrote', async () => {
    const row = await driver.create('candidates', { name: 'Aline', country: 'Rwanda' } as never);
    const found = await driver.get('candidates', row.id);
    expect((found as unknown as { name: string }).name).toBe('Aline');
  });

  it('updates without losing other fields', async () => {
    const row = await driver.create('candidates', { name: 'Jean', country: 'Rwanda' } as never);
    const updated = await driver.update('candidates', row.id, { profession: 'Electrician' } as never);
    expect((updated as unknown as { name: string }).name).toBe('Jean');
    expect((updated as unknown as { profession: string }).profession).toBe('Electrician');
  });

  it('deletes', async () => {
    const row = await driver.create('candidates', { name: 'Jean', country: 'Rwanda' } as never);
    await driver.remove('candidates', row.id);
    expect(await driver.get('candidates', row.id)).toBeNull();
  });

  it('filters, sorts and limits', async () => {
    await driver.create('jobs', { title: 'A', active: true, score: 1 } as never);
    await driver.create('jobs', { title: 'B', active: false, score: 2 } as never);
    await driver.create('jobs', { title: 'C', active: true, score: 3 } as never);

    const active = await driver.list('jobs', { where: [{ field: 'active', op: '==', value: true }] });
    expect(active).toHaveLength(2);

    const sorted = await driver.list('jobs', { orderBy: { field: 'title', direction: 'desc' }, limit: 2 });
    expect((sorted[0] as unknown as { title: string }).title).toBe('C');
    expect(sorted).toHaveLength(2);
  });

  it('returns an empty list for a collection that was never written', async () => {
    expect(await driver.list('opportunities')).toEqual([]);
  });
});

describe('query helpers', () => {
  const rows = [
    { id: '1', createdAt: '', updatedAt: '', score: 10, tags: ['a'] },
    { id: '2', createdAt: '', updatedAt: '', score: 50, tags: ['b'] },
    { id: '3', createdAt: '', updatedAt: '', score: 90, tags: ['a', 'c'] },
  ];

  it('supports the comparison operators', () => {
    expect(applyQueryInMemory(rows, { where: [{ field: 'score', op: '>=', value: 50 }] })).toHaveLength(2);
    expect(applyQueryInMemory(rows, { where: [{ field: 'score', op: '<', value: 50 }] })).toHaveLength(1);
    expect(applyQueryInMemory(rows, { where: [{ field: 'id', op: 'in', value: ['1', '3'] }] })).toHaveLength(2);
    expect(applyQueryInMemory(rows, { where: [{ field: 'tags', op: 'array-contains', value: 'a' }] })).toHaveLength(2);
  });

  it('strips undefined so Firestore never rejects a write', () => {
    const cleaned = stripUndefined({ a: 1, b: undefined, c: { d: undefined, e: 2 }, f: [{ g: undefined, h: 3 }] });
    expect(cleaned).toEqual({ a: 1, c: { e: 2 }, f: [{ h: 3 }] });
  });
});

describe('collections', () => {
  it('covers every table named in SPEC section 25', () => {
    for (const name of [
      'candidates',
      'candidate_profiles',
      'education',
      'qualifications',
      'work_experience',
      'languages',
      'documents',
      'companies',
      'jobs',
      'job_sources',
      'job_matches',
      'applications',
      'application_messages',
      'emails',
      'interviews',
      'offers',
      'contracts',
      'visa_pathways',
      'visa_requirements',
      'visa_assessments',
      'tasks',
      'notes',
      'sources',
      'audit_logs',
    ]) {
      expect(COLLECTION_NAMES).toContain(name);
    }
  });
});

describe('with no database configured', () => {
  it('reads empty instead of crashing the page, and refuses to write', async () => {
    const { NotConnectedDriver } = await import('@/services/db/drivers/not-connected');
    const driver = new NotConnectedDriver();
    expect(await driver.list()).toEqual([]);
    expect(await driver.get()).toBeNull();
    await expect(driver.create()).rejects.toThrow(/NOT CONNECTED/);
    await expect(driver.remove()).rejects.toThrow(/SETUP_FOR_ME/);
  });
});

describe('the collection prefix', () => {
  it('defaults to gjm_ and can be switched off', async () => {
    const { collectionPrefix } = await import('@/services/db');
    const original = process.env.FIRESTORE_COLLECTION_PREFIX;

    delete process.env.FIRESTORE_COLLECTION_PREFIX;
    expect(collectionPrefix()).toBe('gjm_');

    process.env.FIRESTORE_COLLECTION_PREFIX = '';
    expect(collectionPrefix()).toBe('');

    process.env.FIRESTORE_COLLECTION_PREFIX = 'mission_';
    expect(collectionPrefix()).toBe('mission_');

    if (original === undefined) delete process.env.FIRESTORE_COLLECTION_PREFIX;
    else process.env.FIRESTORE_COLLECTION_PREFIX = original;
  });
});
