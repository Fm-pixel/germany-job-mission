import { applyQueryInMemory, type DbDriver, type ListQuery, type Where } from './driver';
import { LocalFileDriver } from './drivers/local-file';
import { FirestoreDriver } from './drivers/firestore';
import { NotConnectedDriver } from './drivers/not-connected';
import { adminDb, firebaseAdminAvailable } from '../firebase/admin';
import type { BaseDoc, CollectionName, Collections } from './types';

export * from './types';
export type { ListQuery, Where } from './driver';
export { applyQueryInMemory };

let cached: DbDriver | null = null;

export function localTestModeEnabled(): boolean {
  return process.env.GJM_DB_DRIVER === 'local-file';
}

export function dbStatus(): { connected: boolean; driver: string; label: string; reason?: string } {
  if (localTestModeEnabled()) {
    return { connected: true, driver: 'local-file', label: 'LOCAL TEST DATABASE — not Firestore' };
  }
  if (firebaseAdminAvailable()) {
    return { connected: true, driver: 'firestore', label: 'Firestore' };
  }
  return {
    connected: false,
    driver: 'none',
    label: 'DATABASE NOT CONNECTED',
    reason: 'FIREBASE_SERVICE_ACCOUNT_JSON is not set on the server.',
  };
}

export function getDriver(): DbDriver {
  if (cached) return cached;
  if (localTestModeEnabled()) {
    cached = new LocalFileDriver();
    return cached;
  }
  if (!firebaseAdminAvailable()) {
    // Pages keep rendering (empty, under the NOT CONNECTED banner); writes explain themselves.
    cached = new NotConnectedDriver();
    return cached;
  }
  cached = new FirestoreDriver(adminDb());
  return cached;
}

/** Test seam only — never called by app code. */
export function __setDriverForTests(driver: DbDriver | null) {
  cached = driver;
}

export const db = {
  list<C extends CollectionName>(collection: C, query?: ListQuery): Promise<Collections[C][]> {
    return getDriver().list<Collections[C] & BaseDoc>(collection, query) as Promise<Collections[C][]>;
  },
  get<C extends CollectionName>(collection: C, id: string): Promise<Collections[C] | null> {
    return getDriver().get<Collections[C] & BaseDoc>(collection, id) as Promise<Collections[C] | null>;
  },
  create<C extends CollectionName>(
    collection: C,
    data: Omit<Collections[C], 'id' | 'createdAt' | 'updatedAt'>,
    id?: string,
  ): Promise<Collections[C]> {
    return getDriver().create<Collections[C] & BaseDoc>(collection, data as never, id) as Promise<
      Collections[C]
    >;
  },
  update<C extends CollectionName>(
    collection: C,
    id: string,
    data: Partial<Collections[C]>,
  ): Promise<Collections[C]> {
    return getDriver().update<Collections[C] & BaseDoc>(collection, id, data as never) as Promise<
      Collections[C]
    >;
  },
  remove(collection: CollectionName, id: string): Promise<void> {
    return getDriver().remove(collection, id);
  },
  async byCandidate<C extends CollectionName>(
    collection: C,
    candidateId: string,
    extra?: ListQuery,
  ): Promise<Collections[C][]> {
    const where: Where[] = [{ field: 'candidateId', op: '==', value: candidateId }, ...(extra?.where ?? [])];
    return this.list(collection, { ...extra, where });
  },
  async first<C extends CollectionName>(
    collection: C,
    query: ListQuery,
  ): Promise<Collections[C] | null> {
    const rows = await this.list(collection, { ...query, limit: 1 });
    return rows[0] ?? null;
  },
};
