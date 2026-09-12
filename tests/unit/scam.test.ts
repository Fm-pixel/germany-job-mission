import { describe, expect, it } from 'vitest';
import { scanForScamPatterns } from '@/services/applications/scam';

describe('scam protection', () => {
  it('flags payment demanded for a job', () => {
    const flags = scanForScamPatterns('To secure this job placement you must pay a fee of 500 EUR.');
    expect(flags.map((f) => f.label)).toContain('Payment demanded for a job');
  });

  it('flags a guaranteed visa', () => {
    const flags = scanForScamPatterns('We offer a guaranteed visa for Germany, 100% sure.');
    expect(flags.some((f) => f.label.includes('Guaranteed') || f.label.includes('visa guarantee'))).toBe(true);
  });

  it('flags a request to send a passport', () => {
    const flags = scanForScamPatterns('Please send your passport copy to our agent by WhatsApp.');
    expect(flags.map((f) => f.label)).toContain('Passport requested by an unknown party');
  });

  it('flags unusual payment channels', () => {
    const flags = scanForScamPatterns('Send the processing fee via Western Union.');
    expect(flags.map((f) => f.label)).toContain('Unusual payment requested by a recruiter');
  });

  it('flags an unrealistic salary but not a normal one', () => {
    expect(scanForScamPatterns('Wir zahlen 25.000 EUR pro Monat!').map((f) => f.label)).toContain(
      'Unrealistic salary',
    );
    expect(scanForScamPatterns('Wir zahlen 3.200 EUR pro Monat.').map((f) => f.label)).not.toContain(
      'Unrealistic salary',
    );
  });

  it('leaves an ordinary German job advert alone', () => {
    const flags = scanForScamPatterns(
      'Wir suchen einen Elektriker (m/w/d) in Vollzeit. Tarifliche Bezahlung, 30 Tage Urlaub, Deutschkenntnisse B1 erforderlich.',
    );
    expect(flags).toEqual([]);
  });

  it('handles empty input', () => {
    expect(scanForScamPatterns(undefined)).toEqual([]);
    expect(scanForScamPatterns('')).toEqual([]);
  });
});
