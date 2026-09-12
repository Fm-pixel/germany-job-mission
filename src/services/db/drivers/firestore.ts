import type { Firestore } from 'firebase-admin/firestore';
import { stripUndefined, type DbDriver, type ListQuery } from '../driver';
import type { BaseDoc, CollectionName } from '../types';

/** The production driver: Firestore through firebase-admin (server only). */
export class FirestoreDriver implements DbDriver {
  readonly kind = 'firestore' as const;
  readonly label = 'Firestore';
  constructor(private readonly db: Firestore) {}

  async list<T extends BaseDoc>(collection: CollectionName, query?: ListQuery): Promise<T[]> {
    let ref: FirebaseFirestore.Query = this.db.collection(collection);
    for (const w of query?.where ?? []) {
      ref = ref.where(w.field, w.op, w.value);
    }
    if (query?.orderBy) ref = ref.orderBy(query.orderBy.field, query.orderBy.direction ?? 'asc');
    if (query?.limit !== undefined) ref = ref.limit(query.limit);
    const snap = await ref.get();
    return snap.docs.map((d) => ({ ...(d.data() as object), id: d.id }) as T);
  }

  async get<T extends BaseDoc>(collection: CollectionName, id: string): Promise<T | null> {
    const doc = await this.db.collection(collection).doc(id).get();
    if (!doc.exists) return null;
    return { ...(doc.data() as object), id: doc.id } as T;
  }

  async create<T extends BaseDoc>(
    collection: CollectionName,
    data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>,
    id?: string,
  ): Promise<T> {
    const now = new Date().toISOString();
    const payload = { ...stripUndefined(data), createdAt: now, updatedAt: now };
    const ref = id ? this.db.collection(collection).doc(id) : this.db.collection(collection).doc();
    await ref.set(payload);
    return { ...payload, id: ref.id } as T;
  }

  async update<T extends BaseDoc>(
    collection: CollectionName,
    id: string,
    data: Partial<T>,
  ): Promise<T> {
    const ref = this.db.collection(collection).doc(id);
    const payload = { ...stripUndefined(data), updatedAt: new Date().toISOString() };
    delete (payload as Record<string, unknown>).id;
    await ref.set(payload, { merge: true });
    const after = await ref.get();
    return { ...(after.data() as object), id } as T;
  }

  async remove(collection: CollectionName, id: string): Promise<void> {
    await this.db.collection(collection).doc(id).delete();
  }
}
