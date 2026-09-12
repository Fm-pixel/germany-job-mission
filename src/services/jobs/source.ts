import type { Job, LanguageLevel } from '../db';

export interface JobSearchQuery {
  what?: string;
  where?: string;
  radiusKm?: number;
  page?: number;
  size?: number;
  kind?: 'job' | 'apprenticeship';
  publishedWithinDays?: number;
}

export type RawJob = Omit<Job, 'id' | 'createdAt' | 'updatedAt' | 'discoveredAt' | 'checkedAt'> & {
  discoveredAt?: string;
  checkedAt?: string;
};

export interface JobSearchResult {
  jobs: RawJob[];
  total: number;
  page: number;
}

export class SourceNotConnectedError extends Error {
  readonly code = 'SOURCE_NOT_CONNECTED';
  constructor(
    readonly sourceKey: string,
    readonly reason: string,
  ) {
    super(`SOURCE NOT CONNECTED (${sourceKey}): ${reason}`);
    this.name = 'SourceNotConnectedError';
  }
}

export interface JobSource {
  readonly key: string;
  readonly name: string;
  readonly homepage: string;
  search(query: JobSearchQuery): Promise<JobSearchResult>;
  fetchDetail(sourceId: string): Promise<Partial<RawJob>>;
  checkStillActive(job: Pick<Job, 'sourceId' | 'url'>): Promise<boolean>;
}

/**
 * Reads a German level out of a job advert text. Heuristic on purpose: it only
 * reports a level when the advert actually names one, and the matching engine
 * treats the result as "detected from the advert text", not as a fact.
 */
export function detectLanguageRequirement(text?: string): LanguageLevel | undefined {
  if (!text) return undefined;
  const normalised = text.replace(/\s+/g, ' ');
  const level = /\b(A1|A2|B1|B2|C1|C2)\b/gi;
  const matches = [...normalised.matchAll(level)];
  if (matches.length === 0) {
    if (/verhandlungssicher|muttersprach|fließend\s+Deutsch|sehr gute Deutschkenntnisse/i.test(normalised)) {
      return 'C1';
    }
    if (/gute Deutschkenntnisse|Deutschkenntnisse erforderlich/i.test(normalised)) return 'B2';
    return undefined;
  }
  const order: LanguageLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  let highest: LanguageLevel | undefined;
  for (const m of matches) {
    const found = m[1].toUpperCase() as LanguageLevel;
    // Only count it when German is mentioned near the level.
    const start = Math.max(0, (m.index ?? 0) - 60);
    const context = normalised.slice(start, (m.index ?? 0) + 20);
    if (!/deutsch|german/i.test(context)) continue;
    if (!highest || order.indexOf(found) > order.indexOf(highest)) highest = found;
  }
  return highest;
}
