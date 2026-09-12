import { describe, expect, it } from 'vitest';
import type { Firestore } from 'firebase-admin/firestore';
import { FirestoreDriver } from '@/services/db/drivers/firestore';

/**
 * The Firestore driver is the code that runs in production, and it cannot be
 * exercised without a Firebase project. This fake records exactly what the
 * driver asks Firestore to do, so the mapping is checked here instead of on
 * the owner's live data.
 */
function fakeFirestore(seed: Record<string, Record<string, object>> = {}) {
  const calls: string[] = [];
  const data: Record<string, Record<string, object>> = JSON.parse(JSON.stringify(seed));

  function makeQuery(collection: string, filters: [string, string, unknown][], order: string[], limit?: number) {
    return {
      where(field: string, op: string, value: unknown) {
        calls.push(`where(${field} ${op} ${JSON.stringify(value)})`);
        return makeQuery(collection, [...filters, [field, op, value]], order, limit);
      },
      orderBy(field: string, direction = 'asc') {
        calls.push(`orderBy(${field} ${direction})`);
        return makeQuery(collection, filters, [...order, `${field} ${direction}`], limit);
      },
      limit(n: number) {
        calls.push(`limit(${n})`);
        return makeQuery(collection, filters, order, n);
      },
      async get() {
        const rows = Object.entries(data[collection] ?? {});
        return { docs: rows.map(([id, value]) => ({ id, data: () => value })) };
      },
    };
  }

  const firestore = {
    collection(name: string) {
      calls.push(`collection(${name})`);
      const query = makeQuery(name, [], []);
      return Object.assign(query, {
        doc(id?: string) {
          const docId = id ?? `auto-${Object.keys(data[name] ?? {}).length + 1}`;
          calls.push(`doc(${name}/${docId})`);
          return {
            id: docId,
            async set(payload: object, options?: { merge?: boolean }) {
              calls.push(`set(${name}/${docId}${options?.merge ? ' merge' : ''})`);
              data[name] = data[name] ?? {};
              data[name][docId] = options?.merge ? { ...(data[name][docId] ?? {}), ...payload } : payload;
            },
            async get() {
              const value = data[name]?.[docId];
              return { exists: value !== undefined, id: docId, data: () => value };
            },
            async delete() {
              calls.push(`delete(${name}/${docId})`);
              delete data[name]?.[docId];
            },
          };
        },
      });
    },
  } as unknown as Firestore;

  return { firestore, calls, data };
}

describe('the Firestore driver', () => {
  it('lets Firestore generate the id and returns it on the document', async () => {
    const { firestore, data } = fakeFirestore();
    const driver = new FirestoreDriver(firestore);
    const created = await driver.create('candidates', { name: 'Jean', country: 'Rwanda' } as never);
    expect(created.id).toBeTruthy();
    expect(created.createdAt).toBeTruthy();
    expect(created.updatedAt).toBe(created.createdAt);
    expect(data.candidates[created.id]).toMatchObject({ name: 'Jean' });
  });

  it('writes to the id it is given, so a fixed document like settings keeps its name', async () => {
    const { firestore, data } = fakeFirestore();
    const driver = new FirestoreDriver(firestore);
    const created = await driver.create('settings', { followUpDays: 10 } as never, 'app-settings');
    expect(created.id).toBe('app-settings');
    expect(Object.keys(data.settings)).toEqual(['app-settings']);
  });

  it('merges on update so a partial patch never wipes the rest of the record', async () => {
    const { firestore, calls, data } = fakeFirestore({
      candidates: { c1: { name: 'Jean', country: 'Rwanda', createdAt: 'yesterday' } },
    });
    const driver = new FirestoreDriver(firestore);
    const updated = await driver.update('candidates', 'c1', { profession: 'Electrician' } as never);
    expect(calls).toContain('set(candidates/c1 merge)');
    expect(data.candidates.c1).toMatchObject({ name: 'Jean', profession: 'Electrician', createdAt: 'yesterday' });
    expect(updated.id).toBe('c1');
  });

  it('never writes the id into the document body', async () => {
    const { firestore, data } = fakeFirestore({ candidates: { c1: { name: 'Jean' } } });
    const driver = new FirestoreDriver(firestore);
    await driver.update('candidates', 'c1', { id: 'something-else', name: 'Jean B' } as never);
    expect(data.candidates.c1).not.toHaveProperty('id');
    expect(data.candidates.c1).toMatchObject({ name: 'Jean B' });
  });

  it('drops undefined, which Firestore rejects outright', async () => {
    const { firestore, data } = fakeFirestore();
    const driver = new FirestoreDriver(firestore);
    const created = await driver.create('jobs', { title: 'Elektriker', salary: undefined } as never);
    expect(data.jobs[created.id]).not.toHaveProperty('salary');
  });

  it('passes filters, ordering and the limit through to Firestore', async () => {
    const { firestore, calls } = fakeFirestore({ jobs: { j1: { title: 'A' } } });
    const driver = new FirestoreDriver(firestore);
    await driver.list('jobs', {
      where: [{ field: 'active', op: '==', value: true }],
      orderBy: { field: 'discoveredAt', direction: 'desc' },
      limit: 25,
    });
    expect(calls).toContain('where(active == true)');
    expect(calls).toContain('orderBy(discoveredAt desc)');
    expect(calls).toContain('limit(25)');
  });

  it('returns null for a document that is not there', async () => {
    const { firestore } = fakeFirestore();
    const driver = new FirestoreDriver(firestore);
    expect(await driver.get('candidates', 'nope')).toBeNull();
  });

  it('puts the document id on every row it reads back', async () => {
    const { firestore } = fakeFirestore({ jobs: { j1: { title: 'A' }, j2: { title: 'B' } } });
    const driver = new FirestoreDriver(firestore);
    const rows = await driver.list('jobs');
    expect(rows.map((row) => row.id).sort()).toEqual(['j1', 'j2']);
  });

  it('deletes', async () => {
    const { firestore, data } = fakeFirestore({ jobs: { j1: { title: 'A' } } });
    const driver = new FirestoreDriver(firestore);
    await driver.remove('jobs', 'j1');
    expect(data.jobs.j1).toBeUndefined();
  });
});

describe('keeping this tool apart from the other app in the same project', () => {
  it('prefixes every collection it touches', async () => {
    const { firestore, calls, data } = fakeFirestore();
    const driver = new FirestoreDriver(firestore, 'gjm_');

    const created = await driver.create('candidates', { name: 'Jean' } as never);
    await driver.get('candidates', created.id);
    await driver.update('candidates', created.id, { name: 'Jean B' } as never);
    await driver.list('jobs', { where: [{ field: 'active', op: '==', value: true }] });
    await driver.remove('candidates', created.id);

    expect(calls.filter((call) => call.startsWith('collection(')).every((call) => call.includes('gjm_'))).toBe(
      true,
    );
    expect(Object.keys(data)).toEqual(['gjm_candidates']);
    expect(Object.keys(data)).not.toContain('candidates');
  });

  it('writes plain collection names when the prefix is switched off', async () => {
    const { firestore, data } = fakeFirestore();
    const driver = new FirestoreDriver(firestore, '');
    await driver.create('candidates', { name: 'Jean' } as never);
    expect(Object.keys(data)).toEqual(['candidates']);
  });
});
