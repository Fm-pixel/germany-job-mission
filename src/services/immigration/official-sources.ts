/**
 * Only these hosts may be quoted as a source for an immigration statement
 * (CLAUDE.md rule 4). Anything else is refused — private "visa" sites are never
 * cited by this tool.
 */
export const ALLOWED_HOSTS = [
  'make-it-in-germany.com',
  'www.make-it-in-germany.com',
  'auswaertiges-amt.de',
  'www.auswaertiges-amt.de',
  'kigali.diplo.de',
  'gesetze-im-internet.de',
  'www.gesetze-im-internet.de',
  'anerkennung-in-deutschland.de',
  'www.anerkennung-in-deutschland.de',
  'anabin.kmk.org',
  'www.bamf.de',
  'bamf.de',
  'arbeitsagentur.de',
  'www.arbeitsagentur.de',
  'bmi.bund.de',
  'www.bmi.bund.de',
];

export function isOfficialSource(url: string): boolean {
  try {
    return ALLOWED_HOSTS.includes(new URL(url).host);
  } catch {
    return false;
  }
}

export class UnofficialSourceError extends Error {
  constructor(url: string) {
    super(`${url} is not an official German source, so it cannot be used here.`);
    this.name = 'UnofficialSourceError';
  }
}

export class SourceUnreachableError extends Error {
  readonly code = 'SOURCE_NOT_CONNECTED';
  constructor(url: string, reason: string) {
    super(`Could not read the official page ${url}: ${reason}`);
    this.name = 'SourceUnreachableError';
  }
}

export interface FetchedPage {
  url: string;
  text: string;
  fetchedAt: string;
}

/** Fetches an official page as plain text. Never falls back to anything else. */
export async function fetchOfficialPage(url: string, timeoutMs = 20000): Promise<FetchedPage> {
  if (!isOfficialSource(url)) throw new UnofficialSourceError(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'germany-job-mission/1.0 (private personal tool)' },
      cache: 'no-store',
    });
    if (!res.ok) throw new SourceUnreachableError(url, `the server answered ${res.status}`);
    const html = await res.text();
    return { url, text: htmlToText(html), fetchedAt: new Date().toISOString() };
  } catch (err) {
    if (err instanceof SourceUnreachableError) throw err;
    throw new SourceUnreachableError(url, err instanceof Error ? err.message : String(err));
  } finally {
    clearTimeout(timer);
  }
}

export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
