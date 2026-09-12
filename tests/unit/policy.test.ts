import { describe, expect, it } from 'vitest';
import { applySafetyRails, CONSERVATIVE_POLICY, fallbackParse, hashRules } from '@/services/policy';

const RULES = `Send applications automatically when the match is 85% or higher.
For a new person, show me the first 5 applications before sending, then go automatic.
Follow up after 10 days, once.
Never send to recruiters or agencies, only directly to employers.
Never send more than 8 applications per person per day.
Anything that costs money waits for me.
Tell me only about replies, interviews, offers, deadlines, and things that need money.`;

describe('fallbackParse', () => {
  const policy = fallbackParse(RULES);

  it('reads the automatic threshold', () => {
    expect(policy.autoSendScoreThreshold).toBe(85);
  });

  it('reads the review-first count', () => {
    expect(policy.reviewFirstNPerPerson).toBe(5);
  });

  it('reads the follow-up rule', () => {
    expect(policy.followUpDays).toBe(10);
    expect(policy.maxFollowUps).toBe(1);
  });

  it('reads the daily cap', () => {
    expect(policy.maxApplicationsPerPersonPerDay).toBe(8);
  });

  it('blocks recruiters', () => {
    expect(policy.blockRecruitersAndAgencies).toBe(true);
  });

  it('explains every rule back in plain words', () => {
    expect(policy.interpretation.length).toBeGreaterThanOrEqual(5);
    expect(policy.interpretation.join(' ')).toContain('85');
  });

  it('falls back to "never send automatically" for an empty file', () => {
    expect(fallbackParse('').autoSendScoreThreshold).toBe(CONSERVATIVE_POLICY.autoSendScoreThreshold);
  });
});

describe('safety rails', () => {
  it('never lets a rule lower the automatic threshold below 70', () => {
    const policy = applySafetyRails({ ...CONSERVATIVE_POLICY, autoSendScoreThreshold: 10 });
    expect(policy.autoSendScoreThreshold).toBe(70);
  });

  it('never lets a rule raise the daily cap above 20', () => {
    const policy = applySafetyRails({ ...CONSERVATIVE_POLICY, maxApplicationsPerPersonPerDay: 500 });
    expect(policy.maxApplicationsPerPersonPerDay).toBe(20);
  });

  it('keeps money approval on whatever the rules say', () => {
    const policy = applySafetyRails({ ...CONSERVATIVE_POLICY, moneyRequiresApproval: false });
    expect(policy.moneyRequiresApproval).toBe(true);
  });

  it('keeps follow-ups inside a sane range', () => {
    expect(applySafetyRails({ ...CONSERVATIVE_POLICY, followUpDays: 0 }).followUpDays).toBe(3);
    expect(applySafetyRails({ ...CONSERVATIVE_POLICY, maxFollowUps: 99 }).maxFollowUps).toBe(3);
  });
});

describe('hashRules', () => {
  it('changes when the text changes', () => {
    expect(hashRules('a')).not.toBe(hashRules('b'));
    expect(hashRules(RULES)).toBe(hashRules(RULES));
  });
});
