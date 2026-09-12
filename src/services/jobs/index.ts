import { db, type Candidate, type Job } from '../db';
import { BundesagenturSource } from './sources/bundesagentur';
import { SourceNotConnectedError, type JobSearchQuery, type JobSource, type RawJob } from './source';
import { scanForScamPatterns } from '../applications/scam';

export * from './source';

const SOURCES: JobSource[] = [new BundesagenturSource()];

export function jobSources(): JobSource[] {
  return SOURCES;
}

export function getSource(key: string): JobSource {
  const source = SOURCES.find((s) => s.key === key);
  if (!source) throw new Error(`Unknown job source "${key}".`);
  return source;
}

async function recordSourceState(
  source: JobSource,
  state: { status: 'connected' | 'error'; error?: string; jobsFound?: number },
) {
  const existing = await db.first('job_sources', { where: [{ field: 'key', op: '==', value: source.key }] });
  const payload = {
    key: source.key,
    name: source.name,
    status: state.status === 'connected' ? ('connected' as const) : ('error' as const),
    lastRunAt: new Date().toISOString(),
    lastError: state.error,
    jobsFound: state.jobsFound,
  };
  if (existing) await db.update('job_sources', existing.id, payload);
  else await db.create('job_sources', payload);
}

/** Saves a job, or refreshes the one already stored for the same source id. */
export async function upsertJob(raw: RawJob): Promise<{ job: Job; isNew: boolean }> {
  const now = new Date().toISOString();
  const existing = await db.first('jobs', {
    where: [
      { field: 'source', op: '==', value: raw.source },
      { field: 'sourceId', op: '==', value: raw.sourceId },
    ],
  });
  const scamFlags = scanForScamPatterns(
    [raw.title, raw.employer, raw.description, raw.requirements, raw.salary].filter(Boolean).join('\n'),
  ).map((flag) => flag.label);

  if (existing) {
    const job = await db.update('jobs', existing.id, {
      ...raw,
      checkedAt: now,
      scamFlags,
      discoveredAt: existing.discoveredAt,
    });
    return { job, isNew: false };
  }
  const job = await db.create('jobs', {
    ...raw,
    discoveredAt: raw.discoveredAt ?? now,
    checkedAt: now,
    scamFlags,
  });
  return { job, isNew: true };
}

export interface SearchAndStoreResult {
  jobs: Job[];
  newCount: number;
  total: number;
  sourceConnected: boolean;
  sourceError?: string;
}

export async function searchAndStore(
  query: JobSearchQuery,
  sourceKey = 'bundesagentur',
  options: { withDetail?: number } = {},
): Promise<SearchAndStoreResult> {
  const source = getSource(sourceKey);
  try {
    const result = await source.search(query);
    const stored: Job[] = [];
    let newCount = 0;
    const detailLimit = options.withDetail ?? 0;
    for (const [index, raw] of result.jobs.entries()) {
      let enriched = raw;
      if (index < detailLimit) {
        try {
          const detail = await source.fetchDetail(raw.sourceId);
          enriched = { ...raw, ...detail };
        } catch {
          // A missing detail is not a reason to drop a real vacancy.
        }
      }
      const { job, isNew } = await upsertJob(enriched);
      stored.push(job);
      if (isNew) newCount += 1;
    }
    await recordSourceState(source, { status: 'connected', jobsFound: stored.length });
    return { jobs: stored, newCount, total: result.total, sourceConnected: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await recordSourceState(source, { status: 'error', error: message });
    if (err instanceof SourceNotConnectedError) {
      return { jobs: [], newCount: 0, total: 0, sourceConnected: false, sourceError: message };
    }
    throw err;
  }
}

/** Builds the search query for a candidate out of their own profile. */
export function queryForCandidate(candidate: Candidate, overrides: JobSearchQuery = {}): JobSearchQuery {
  const what = overrides.what ?? candidate.preferredOccupation ?? candidate.profession ?? '';
  const where =
    overrides.where ??
    candidate.preferredCities?.[0] ??
    candidate.preferredStates?.[0] ??
    (candidate.relocate === false ? undefined : undefined);
  return {
    what,
    where,
    radiusKm: overrides.radiusKm ?? (where ? 50 : undefined),
    size: overrides.size ?? 25,
    page: overrides.page ?? 1,
    kind: overrides.kind ?? (candidate.track === 'B-apprenticeship' ? 'apprenticeship' : 'job'),
    publishedWithinDays: overrides.publishedWithinDays,
  };
}

export async function checkJobStillActive(job: Job): Promise<Job> {
  const source = getSource(job.source);
  const active = await source.checkStillActive(job);
  return db.update('jobs', job.id, { active, checkedAt: new Date().toISOString() });
}

export async function fetchJobDetail(job: Job): Promise<Job> {
  const source = getSource(job.source);
  const detail = await source.fetchDetail(job.sourceId);
  return db.update('jobs', job.id, { ...detail, checkedAt: new Date().toISOString() });
}
