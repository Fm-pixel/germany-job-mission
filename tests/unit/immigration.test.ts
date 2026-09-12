import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { __setDriverForTests, db } from '@/services/db';
import { LocalFileDriver } from '@/services/db/drivers/local-file';
import { evaluateAllPathways } from '@/services/immigration/assess';
import { fastestRealisticPath } from '@/services/immigration/fastest-path';
import { PATHWAYS, NO_UNSKILLED_VISA_NOTE } from '@/services/immigration/pathways';
import { isOfficialSource } from '@/services/immigration/official-sources';
import { germanPlan, sponsorGap } from '@/services/immigration/track-b';

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gjm-immi-'));
  __setDriverForTests(new LocalFileDriver(dir));
});

afterEach(() => {
  __setDriverForTests(null);
  fs.rmSync(dir, { recursive: true, force: true });
});

async function seedCandidate(patch: {
  qualificationLevel?: 'none' | 'vocational' | 'academic';
  german?: string;
  withOffer?: boolean;
  track?: 'A-skilled' | 'B-apprenticeship' | 'unknown';
}) {
  const candidate = await db.create('candidates', {
    name: 'Jean',
    country: 'Rwanda',
    profession: 'Electrician',
    track: patch.track ?? 'A-skilled',
    status: 'active',
    relocate: true,
  });
  await db.create('candidate_profiles', {
    candidateId: candidate.id,
    skills: [],
    industries: [],
    jobTitles: [],
    yearsExperience: 5,
    qualificationLevel: patch.qualificationLevel ?? 'vocational',
    confirmed: true,
    needsConfirmation: [],
  });
  await db.create('languages', { candidateId: candidate.id, language: 'German', level: (patch.german ?? 'A2') as never });
  if (patch.withOffer) {
    await db.create('applications', {
      candidateId: candidate.id,
      status: 'Offer',
      statusHistory: [],
      followUpCount: 0,
    });
  }
  return candidate;
}

describe('pathway definitions', () => {
  it('covers the routes named in the build plan', () => {
    const keys = PATHWAYS.map((p) => p.key);
    for (const key of [
      'skilled-vocational',
      'skilled-academic',
      'blue-card',
      'experienced-worker',
      'recognition-partnership',
      'opportunity-card',
      'training',
    ]) {
      expect(keys).toContain(key);
    }
  });

  it('gives every requirement an official source', () => {
    for (const pathway of PATHWAYS) {
      expect(isOfficialSource(pathway.sourceUrl)).toBe(true);
      for (const requirement of pathway.requirements) {
        expect(isOfficialSource(requirement.sourceUrl)).toBe(true);
      }
    }
  });

  it('refuses a source that is not an official German site', () => {
    expect(isOfficialSource('https://chancenkarte.com/points')).toBe(false);
    expect(isOfficialSource('https://www.make-it-in-germany.com/en/')).toBe(true);
  });
});

describe('pathway assessment', () => {
  it('blocks every employment route while there is no job offer', async () => {
    const candidate = await seedCandidate({});
    const evaluations = await evaluateAllPathways(candidate.id);
    const skilled = evaluations.find((e) => e.pathway.key === 'skilled-vocational')!;
    expect(skilled.verdict).toBe('NOT CURRENTLY RECOMMENDED');
    expect(skilled.reasoning.some((r) => r.kind === 'blocking' && /job offer/i.test(r.text))).toBe(true);
  });

  it('opens the skilled route once an offer exists', async () => {
    const candidate = await seedCandidate({ withOffer: true });
    const evaluations = await evaluateAllPathways(candidate.id);
    const skilled = evaluations.find((e) => e.pathway.key === 'skilled-vocational')!;
    expect(skilled.verdict).not.toBe('NOT CURRENTLY RECOMMENDED');
  });

  it('does not recommend the Blue Card without a degree', async () => {
    const candidate = await seedCandidate({ withOffer: true, qualificationLevel: 'vocational' });
    const evaluations = await evaluateAllPathways(candidate.id);
    const blueCard = evaluations.find((e) => e.pathway.key === 'blue-card')!;
    expect(blueCard.verdict).toBe('NOT CURRENTLY RECOMMENDED');
  });

  it('labels every requirement until a re-check confirms it', async () => {
    const candidate = await seedCandidate({ withOffer: true });
    const evaluations = await evaluateAllPathways(candidate.id);
    for (const evaluation of evaluations) {
      for (const requirement of evaluation.requirements) {
        expect(['CONFIRMED', 'LIKELY-NEEDS-CONFIRMATION', 'USER-SPECIFIC']).toContain(requirement.label);
      }
    }
    // Nothing has been fetched in this test, so nothing may claim to be confirmed.
    const labels = evaluations.flatMap((e) => e.requirements.map((r) => r.label));
    expect(labels).not.toContain('CONFIRMED');
  });
});

describe('fastest realistic path', () => {
  it('ranks the apprenticeship first for somebody without a qualification, and says so honestly', async () => {
    const candidate = await seedCandidate({ qualificationLevel: 'none', track: 'B-apprenticeship' });
    const result = await fastestRealisticPath(candidate.id);
    expect(result.ranked[0].key).toBe('training');
    expect(result.honestNotes.join(' ')).toContain(NO_UNSKILLED_VISA_NOTE.slice(0, 40));
  });

  it('always warns that a short-stay visa is not a way to stay', async () => {
    const candidate = await seedCandidate({ withOffer: true });
    const result = await fastestRealisticPath(candidate.id);
    expect(result.honestNotes.join(' ')).toMatch(/short-stay/i);
  });

  it('never promises anything', async () => {
    const candidate = await seedCandidate({ withOffer: true });
    const result = await fastestRealisticPath(candidate.id);
    const text = JSON.stringify(result).toLowerCase();
    expect(text).not.toContain('guaranteed');
    expect(result.disclaimer).toMatch(/not legal advice/i);
  });
});

describe('Track B helpers', () => {
  it('builds a German plan up to B1 with target dates', () => {
    const plan = germanPlan('A2', 'B1');
    expect(plan).toHaveLength(1);
    expect(plan[0].to).toBe('B1');
    expect(plan[0].targetDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('has a step for every level from nothing to B1', () => {
    expect(germanPlan('none', 'B1')).toHaveLength(3);
  });

  it('calculates the sponsor gap and explains the liability', () => {
    const result = sponsorGap(900, 1100);
    expect(result.gap).toBe(200);
    expect(result.note).toMatch(/Verpflichtungserkl/);
    expect(result.disclaimer).toMatch(/changes/i);
  });

  it('reports no gap when the training pay is enough', () => {
    expect(sponsorGap(1300, 1100).gap).toBe(0);
  });
});
