import { jobSourceApiKey } from '@/lib/env';
import {
  detectLanguageRequirement,
  SourceNotConnectedError,
  type JobSearchQuery,
  type JobSearchResult,
  type JobSource,
  type RawJob,
} from '../source';

/**
 * Bundesagentur für Arbeit — "Jobsuche" API.
 * The Federal Employment Agency's own public job search service.
 * Docs: https://jobsuche.api.bund.dev/
 *
 * Nothing here is ever faked: if the API cannot be reached, the caller gets a
 * SourceNotConnectedError and the UI shows "SOURCE NOT CONNECTED".
 */
const BASE = 'https://rest.arbeitsagentur.de/jobboerse/jobsuche-service';
const TIMEOUT_MS = 20000;

interface BaListItem {
  beruf?: string;
  titel?: string;
  refnr?: string;
  arbeitgeber?: string;
  arbeitsort?: { ort?: string; plz?: string; region?: string; land?: string };
  aktuelleVeroeffentlichungsdatum?: string;
  eintrittsdatum?: string;
  hashId?: string;
  externeUrl?: string;
  modifikationsTimestamp?: string;
}

interface BaListResponse {
  stellenangebote?: BaListItem[];
  maxErgebnisse?: number;
  page?: number;
}

interface BaDetail {
  stellenbeschreibung?: string;
  titel?: string;
  beruf?: string;
  arbeitgeber?: string;
  branche?: string;
  arbeitszeitteilzeit?: boolean;
  arbeitszeitvollzeit?: boolean;
  verguetung?: string;
  arbeitsorte?: { ort?: string; region?: string; strasse?: string; plz?: string }[];
  externeUrl?: string;
  fuerFluechtlingeGeeignet?: boolean;
  istBetreut?: boolean;
}

async function call<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { 'X-API-Key': jobSourceApiKey(), Accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!res.ok) {
      throw new SourceNotConnectedError(
        'bundesagentur',
        `the API answered ${res.status} ${res.statusText} for ${url.pathname}`,
      );
    }
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof SourceNotConnectedError) throw err;
    const message = err instanceof Error ? err.message : String(err);
    throw new SourceNotConnectedError(
      'bundesagentur',
      `the request to ${url.host} failed (${message}). If this machine has no internet access to arbeitsagentur.de, the search cannot run here.`,
    );
  }
}

function publicUrl(item: BaListItem): string {
  if (item.externeUrl) return item.externeUrl;
  if (item.refnr) {
    return `https://www.arbeitsagentur.de/jobsuche/jobdetail/${encodeURIComponent(item.refnr)}`;
  }
  return 'https://www.arbeitsagentur.de/jobsuche/';
}

function toRawJob(item: BaListItem, kind: 'job' | 'apprenticeship'): RawJob | null {
  const sourceId = item.refnr ?? item.hashId;
  if (!sourceId) return null;
  const locationParts = [item.arbeitsort?.ort, item.arbeitsort?.region].filter(Boolean);
  return {
    source: 'bundesagentur',
    sourceId,
    url: publicUrl(item),
    title: item.titel || item.beruf || 'Unbenannte Stelle',
    employer: item.arbeitgeber || 'Needs confirmation',
    location: locationParts.join(', ') || undefined,
    state: item.arbeitsort?.region,
    publishedAt: item.aktuelleVeroeffentlichungsdatum,
    kind,
    active: true,
    detailFetched: false,
  };
}

export class BundesagenturSource implements JobSource {
  readonly key = 'bundesagentur';
  readonly name = 'Bundesagentur für Arbeit — Jobsuche';
  readonly homepage = 'https://www.arbeitsagentur.de/jobsuche/';

  async search(query: JobSearchQuery): Promise<JobSearchResult> {
    const kind = query.kind ?? 'job';
    const data = await call<BaListResponse>('/pc/v4/jobs', {
      was: query.what,
      wo: query.where,
      umkreis: query.radiusKm,
      page: query.page ?? 1,
      size: query.size ?? 25,
      angebotsart: kind === 'apprenticeship' ? 4 : 1,
      veroeffentlichtseit: query.publishedWithinDays,
    });
    const jobs = (data.stellenangebote ?? [])
      .map((item) => toRawJob(item, kind))
      .filter((job): job is RawJob => job !== null);
    return { jobs, total: data.maxErgebnisse ?? jobs.length, page: data.page ?? query.page ?? 1 };
  }

  async fetchDetail(sourceId: string): Promise<Partial<RawJob>> {
    const encoded = Buffer.from(sourceId, 'utf8').toString('base64');
    const detail = await call<BaDetail>(`/pc/v2/jobdetails/${encodeURIComponent(encoded)}`);
    const description = detail.stellenbeschreibung?.trim();
    const workingTime =
      detail.arbeitszeitvollzeit && detail.arbeitszeitteilzeit
        ? ('either' as const)
        : detail.arbeitszeitteilzeit
          ? ('part-time' as const)
          : detail.arbeitszeitvollzeit
            ? ('full-time' as const)
            : undefined;
    return {
      description,
      requirements: description,
      employer: detail.arbeitgeber,
      salary: detail.verguetung,
      workingTime,
      languageRequirement: detectLanguageRequirement(description),
      location: detail.arbeitsorte?.[0]
        ? [detail.arbeitsorte[0].ort, detail.arbeitsorte[0].region].filter(Boolean).join(', ')
        : undefined,
      detailFetched: true,
    };
  }

  async checkStillActive(job: { sourceId: string; url: string }): Promise<boolean> {
    try {
      await this.fetchDetail(job.sourceId);
      return true;
    } catch (err) {
      if (err instanceof SourceNotConnectedError && /answered 404/.test(err.message)) return false;
      throw err;
    }
  }
}
