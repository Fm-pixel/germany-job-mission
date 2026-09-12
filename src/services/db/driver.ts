import type { BaseDoc, CollectionName } from './types';

export type WhereOp = '==' | '!=' | '<' | '<=' | '>' | '>=' | 'in' | 'array-contains';

export interface Where {
  field: string;
  op: WhereOp;
  value: unknown;
}

export interface ListQuery {
  where?: Where[];
  orderBy?: { field: string; direction?: 'asc' | 'desc' };
  limit?: number;
}

export interface DbDriver {
  readonly kind: 'firestore' | 'local-file';
  readonly label: string;
  list<T extends BaseDoc>(collection: CollectionName, query?: ListQuery): Promise<T[]>;
  get<T extends BaseDoc>(collection: CollectionName, id: string): Promise<T | null>;
  create<T extends BaseDoc>(
    collection: CollectionName,
    data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>,
    id?: string,
  ): Promise<T>;
  update<T extends BaseDoc>(collection: CollectionName, id: string, data: Partial<T>): Promise<T>;
  remove(collection: CollectionName, id: string): Promise<void>;
}

/** Applies the query semantics shared by both drivers (the local one needs it in JS). */
export function applyQueryInMemory<T extends BaseDoc>(rows: T[], query?: ListQuery): T[] {
  let out = rows;
  for (const w of query?.where ?? []) {
    out = out.filter((row) => matches(readPath(row, w.field), w.op, w.value));
  }
  if (query?.orderBy) {
    const { field, direction } = query.orderBy;
    const dir = direction === 'desc' ? -1 : 1;
    out = [...out].sort((a, b) => {
      const av = readPath(a, field);
      const bv = readPath(b, field);
      if (av === bv) return 0;
      if (av === undefined || av === null) return 1;
      if (bv === undefined || bv === null) return -1;
      return (av > bv ? 1 : -1) * dir;
    });
  }
  if (query?.limit !== undefined) out = out.slice(0, query.limit);
  return out;
}

function readPath(row: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key];
    return undefined;
  }, row);
}

function matches(actual: unknown, op: WhereOp, expected: unknown): boolean {
  switch (op) {
    case '==':
      return actual === expected;
    case '!=':
      return actual !== expected;
    case '<':
      return compare(actual, expected) < 0;
    case '<=':
      return compare(actual, expected) <= 0;
    case '>':
      return compare(actual, expected) > 0;
    case '>=':
      return compare(actual, expected) >= 0;
    case 'in':
      return Array.isArray(expected) && expected.includes(actual);
    case 'array-contains':
      return Array.isArray(actual) && actual.includes(expected);
    default:
      return false;
  }
}

function compare(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  const as = String(a ?? '');
  const bs = String(b ?? '');
  return as === bs ? 0 : as > bs ? 1 : -1;
}

/** Firestore rejects `undefined`; strip it everywhere before writing. */
export function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((v) => stripUndefined(v)) as unknown as T;
  }
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) out[k] = stripUndefined(v);
    }
    return out as T;
  }
  return value;
}
