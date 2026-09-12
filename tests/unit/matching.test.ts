import { describe, expect, it } from 'vitest';
import { levelAtLeast, professionOverlap, recommendedActionFromScore, scoreMatch } from '@/services/matching/score';
import type { Candidate, CandidateProfile, Job, LanguageSkill } from '@/services/db/types';

function candidate(patch: Partial<Candidate> = {}): Candidate {
  return {
    id: 'c1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    name: 'Jean',
    country: 'Rwanda',
    profession: 'Electrician',
    track: 'A-skilled',
    status: 'active',
    relocate: true,
    ...patch,
  };
}

function profile(patch: Partial<CandidateProfile> = {}): CandidateProfile {
  return {
    id: 'p1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    candidateId: 'c1',
    skills: ['Kabel', 'Installation'],
    industries: ['Elektro'],
    jobTitles: ['Elektriker'],
    yearsExperience: 5,
    qualificationLevel: 'vocational',
    confirmed: true,
    needsConfirmation: [],
    profession: 'Elektriker',
    ...patch,
  };
}

function job(patch: Partial<Job> = {}): Job {
  return {
    id: 'j1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    source: 'bundesagentur',
    sourceId: 'X1',
    url: 'https://www.arbeitsagentur.de/jobsuche/jobdetail/X1',
    title: 'Elektriker (m/w/d)',
    employer: 'Müller Elektrotechnik',
    location: 'München, Bayern',
    kind: 'job',
    active: true,
    discoveredAt: '2026-01-01T00:00:00.000Z',
    checkedAt: '2026-01-01T00:00:00.000Z',
    ...patch,
  };
}

function languages(german: string, english = 'B2'): LanguageSkill[] {
  return [
    {
      id: 'l1',
      createdAt: '',
      updatedAt: '',
      candidateId: 'c1',
      language: 'German',
      level: german as LanguageSkill['level'],
    },
    {
      id: 'l2',
      createdAt: '',
      updatedAt: '',
      candidateId: 'c1',
      language: 'English',
      level: english as LanguageSkill['level'],
    },
  ];
}

describe('scoreMatch', () => {
  it('scores a strong, honest match highly', () => {
    const result = scoreMatch({
      candidate: candidate(),
      profile: profile(),
      languages: languages('B2'),
      job: job({ languageRequirement: 'B1' }),
    });
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.germanGap).toBeUndefined();
    expect(result.ruleExplanation.some((item) => item.kind === 'positive')).toBe(true);
  });

  it('always warns when the advert asks for more German than the person has', () => {
    const result = scoreMatch({
      candidate: candidate(),
      profile: profile(),
      languages: languages('A2'),
      job: job({ languageRequirement: 'B1' }),
    });
    expect(result.germanGap).toEqual({ required: 'B1', has: 'A2' });
    const warning = result.ruleExplanation.find((item) => item.kind === 'warning' && item.text.includes('B1'));
    expect(warning).toBeDefined();
    expect(warning?.text).toContain('A2');
  });

  it('never hides the German gap even when everything else is perfect', () => {
    const perfect = scoreMatch({
      candidate: candidate(),
      profile: profile({ yearsExperience: 20 }),
      languages: languages('A1'),
      job: job({ languageRequirement: 'C1' }),
    });
    expect(perfect.ruleExplanation.filter((item) => item.kind === 'warning').length).toBeGreaterThan(0);
    expect(perfect.score).toBeLessThan(100);
  });

  it('marks a missing qualification as a warning', () => {
    const result = scoreMatch({
      candidate: candidate(),
      profile: profile({ qualificationLevel: 'none' }),
      languages: languages('B1'),
      job: job(),
    });
    expect(result.ruleExplanation.some((item) => item.text.includes('No recognised vocational qualification'))).toBe(
      true,
    );
  });

  it('penalises a vacancy outside the stated preference when relocation is refused', () => {
    const away = scoreMatch({
      candidate: candidate({ relocate: false, preferredCities: ['Hamburg'] }),
      profile: profile(),
      languages: languages('B1'),
      job: job({ location: 'München, Bayern' }),
    });
    const near = scoreMatch({
      candidate: candidate({ relocate: false, preferredCities: ['München'] }),
      profile: profile(),
      languages: languages('B1'),
      job: job({ location: 'München, Bayern' }),
    });
    expect(near.score).toBeGreaterThan(away.score);
  });

  it('keeps the score inside 0..100', () => {
    const result = scoreMatch({
      candidate: candidate({ relocate: false, preferredCities: ['Kigali'] }),
      profile: profile({ qualificationLevel: 'none', yearsExperience: 0, jobTitles: [], profession: undefined }),
      languages: languages('none', 'none'),
      job: job({ title: 'Softwarearchitekt', languageRequirement: 'C2' }),
    });
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});

describe('recommendedActionFromScore', () => {
  it('recommends APPLY for a strong match', () => {
    expect(recommendedActionFromScore(88).action).toBe('APPLY');
  });

  it('mentions the German gap in the reason when there is one', () => {
    const result = recommendedActionFromScore(85, { required: 'B1', has: 'A2' });
    expect(result.action).toBe('APPLY');
    expect(result.reason).toContain('A2');
    expect(result.reason).toContain('B1');
  });

  it('recommends PREPARE FIRST in the middle and SKIP at the bottom', () => {
    expect(recommendedActionFromScore(60).action).toBe('PREPARE FIRST');
    expect(recommendedActionFromScore(20).action).toBe('SKIP');
  });
});

describe('helpers', () => {
  it('compares language levels in the right order', () => {
    expect(levelAtLeast('B2', 'B1')).toBe(true);
    expect(levelAtLeast('A2', 'B1')).toBe(false);
    expect(levelAtLeast('native', 'C2')).toBe(true);
    expect(levelAtLeast(undefined, 'A1')).toBe(false);
  });

  it('recognises the occupation inside a German job title', () => {
    expect(professionOverlap(['Elektriker'], job())).toBeGreaterThan(0);
    expect(professionOverlap(['Krankenpfleger'], job())).toBe(0);
  });
});
