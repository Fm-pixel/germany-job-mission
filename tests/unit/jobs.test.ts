import { describe, expect, it } from 'vitest';
import { detectLanguageRequirement } from '@/services/jobs/source';
import { BundesagenturSource } from '@/services/jobs/sources/bundesagentur';
import { SourceNotConnectedError } from '@/services/jobs/source';

describe('language requirement detection', () => {
  it('reads the level when the advert names one next to German', () => {
    expect(detectLanguageRequirement('Gute Deutschkenntnisse (mindestens B1) erforderlich.')).toBe('B1');
  });

  it('takes the highest level when several are named', () => {
    expect(detectLanguageRequirement('Deutsch A2, besser Deutsch B2 von Vorteil.')).toBe('B2');
  });

  it('ignores a level that belongs to another language', () => {
    expect(detectLanguageRequirement('Englisch B2 erforderlich.')).toBeUndefined();
  });

  it('maps "verhandlungssicher" to C1', () => {
    expect(detectLanguageRequirement('Verhandlungssicheres Deutsch wird vorausgesetzt.')).toBe('C1');
  });

  it('returns nothing when the advert says nothing', () => {
    expect(detectLanguageRequirement('Wir suchen einen Elektriker in Vollzeit.')).toBeUndefined();
    expect(detectLanguageRequirement(undefined)).toBeUndefined();
  });
});

describe('the Bundesagentur source', () => {
  it('never invents results when the API cannot be reached', async () => {
    const source = new BundesagenturSource();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new Error('network blocked');
    }) as typeof fetch;
    try {
      await expect(source.search({ what: 'Elektriker' })).rejects.toBeInstanceOf(SourceNotConnectedError);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('turns a real API answer into stored vacancies with a working link', async () => {
    const source = new BundesagenturSource();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          maxErgebnisse: 1,
          page: 1,
          stellenangebote: [
            {
              titel: 'Elektriker (m/w/d)',
              beruf: 'Elektriker',
              refnr: '10000-1234567890-S',
              arbeitgeber: 'Müller Elektrotechnik GmbH',
              arbeitsort: { ort: 'München', region: 'Bayern' },
              aktuelleVeroeffentlichungsdatum: '2026-09-01',
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )) as typeof fetch;
    try {
      const result = await source.search({ what: 'Elektriker' });
      expect(result.jobs).toHaveLength(1);
      expect(result.jobs[0].employer).toBe('Müller Elektrotechnik GmbH');
      expect(result.jobs[0].url).toContain('arbeitsagentur.de/jobsuche/jobdetail/');
      expect(result.jobs[0].source).toBe('bundesagentur');
      expect(result.jobs[0].active).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('reports a bad HTTP answer as SOURCE NOT CONNECTED', async () => {
    const source = new BundesagenturSource();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response('nope', { status: 500 })) as typeof fetch;
    try {
      await expect(source.search({ what: 'Elektriker' })).rejects.toThrow(/SOURCE NOT CONNECTED/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
