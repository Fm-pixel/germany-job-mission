import fs from 'node:fs';
import path from 'node:path';
import { applyQueryInMemory, stripUndefined, type DbDriver, type ListQuery } from '../driver';
import type { BaseDoc, CollectionName } from '../types';

/**
 * Local JSON store used ONLY for testing this app without a Firebase project.
 * It is never silently used: `GJM_DB_DRIVER=local-file` must be set explicitly,
 * and the UI shows a permanent "LOCAL TEST DATABASE" banner while it is active.
 */
export class LocalFileDriver implements DbDriver {
  readonly kind = 'local-file' as const;
  readonly label = 'Local test database (JSON files on this machine)';
  private readonly dir: string;

  constructor(dir = process.env.GJM_LOCAL_DB_DIR || path.join(process.cwd(), '.gjm-data')) {
    this.dir = dir;
  }

  private file(collection: CollectionName) {
    return path.join(this.dir, `${collection}.json`);
  }

  private readAll<T extends BaseDoc>(collection: CollectionName): T[] {
    const file = this.file(collection);
    if (!fs.existsSync(file)) return [];
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8')) as T[];
    } catch {
      return [];
    }
  }

  private writeAll<T extends BaseDoc>(collection: CollectionName, rows: T[]) {
    fs.mkdirSync(this.dir, { recursive: true });
    fs.writeFileSync(this.file(collection), JSON.stringify(rows, null, 2), 'utf8');
  }

  async list<T extends BaseDoc>(collection: CollectionName, query?: ListQuery): Promise<T[]> {
    return applyQueryInMemory(this.readAll<T>(collection), query);
  }

  async get<T extends BaseDoc>(collection: CollectionName, id: string): Promise<T | null> {
    return this.readAll<T>(collection).find((r) => r.id === id) ?? null;
  }

  async create<T extends BaseDoc>(
    collection: CollectionName,
    data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>,
    id?: string,
  ): Promise<T> {
    const rows = this.readAll<T>(collection);
    const now = new Date().toISOString();
    const doc = {
      ...stripUndefined(data),
      id: id ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
      createdAt: now,
      updatedAt: now,
    } as T;
    const existingIndex = rows.findIndex((r) => r.id === doc.id);
    if (existingIndex >= 0) rows[existingIndex] = doc;
    else rows.push(doc);
    this.writeAll(collection, rows);
    return doc;
  }

  async update<T extends BaseDoc>(
    collection: CollectionName,
    id: string,
    data: Partial<T>,
  ): Promise<T> {
    const rows = this.readAll<T>(collection);
    const index = rows.findIndex((r) => r.id === id);
    if (index < 0) throw new Error(`${collection}/${id} not found`);
    const updated = {
      ...rows[index],
      ...stripUndefined(data),
      id,
      updatedAt: new Date().toISOString(),
    } as T;
    rows[index] = updated;
    this.writeAll(collection, rows);
    return updated;
  }

  async remove(collection: CollectionName, id: string): Promise<void> {
    const rows = this.readAll<BaseDoc>(collection).filter((r) => r.id !== id);
    this.writeAll(collection, rows);
  }
}
