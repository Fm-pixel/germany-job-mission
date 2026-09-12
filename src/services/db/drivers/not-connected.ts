import { NotConnectedError } from '../../firebase/admin';
import type { DbDriver } from '../driver';
import type { BaseDoc } from '../types';

/**
 * Used while no database is configured. Reads come back empty so the pages
 * still render — with the red "DATABASE NOT CONNECTED" banner on top — and any
 * attempt to write says exactly what is missing instead of failing silently.
 */
export class NotConnectedDriver implements DbDriver {
  readonly kind = 'firestore' as const;
  readonly label = 'DATABASE NOT CONNECTED';

  private fail(): never {
    throw new NotConnectedError('Firestore database', 'FIREBASE_SERVICE_ACCOUNT_JSON', '1');
  }

  async list<T extends BaseDoc>(): Promise<T[]> {
    return [];
  }

  async get<T extends BaseDoc>(): Promise<T | null> {
    return null;
  }

  async create<T extends BaseDoc>(): Promise<T> {
    this.fail();
  }

  async update<T extends BaseDoc>(): Promise<T> {
    this.fail();
  }

  async remove(): Promise<void> {
    this.fail();
  }
}
