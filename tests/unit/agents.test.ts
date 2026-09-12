import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { __setDriverForTests, db } from '@/services/db';
import { LocalFileDriver } from '@/services/db/drivers/local-file';
import { mayAutoSend } from '@/agents/safety';
import { AGENTS } from '@/agents';
import { CONSERVATIVE_POLICY, type Policy } from '@/services/policy';
import { computePriorities } from '@/services/tracking';

let dir: string;

const ALLOWING_POLICY: Policy = {
  ...CONSERVATIVE_POLICY,
  autoSendScoreThreshold: 85,
  reviewFirstNPerPerson: 0,
  maxApplicationsPerPersonPerDay: 8,
};

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gjm-agents-'));
  __setDriverForTests(new LocalFileDriver(dir));
});

afterEach(() => {
  __setDriverForTests(null);
  fs.rmSync(dir, { recursive: true, force: true });
});

async function setup(options: {
  score?: number;
  scamFlags?: string[];
  needsInfo?: string[];
  reviewed?: number;
  status?: 'active' | 'paused';
}) {
  const candidate = await db.create('candidates', {
    name: 'Jean',
    country: 'Rwanda',
    track: 'A-skilled',
    status: options.status ?? 'active',
    reviewedApplicationCount: options.reviewed ?? 10,
  });
  const job = await db.create('jobs', {
    source: 'bundesagentur',
    sourceId: 'X',
    url: 'https://www.arbeitsagentur.de/jobsuche/jobdetail/X',
    title: 'Elektriker',
    employer: 'Müller',
    kind: 'job',
    active: true,
    discoveredAt: new Date().toISOString(),
    checkedAt: new Date().toISOString(),
  });
  const match = await db.create('job_matches', {
    candidateId: candidate.id,
    jobId: job.id,
    score: options.score ?? 90,
    breakdown: [],
    explanation: [],
    recommendedAction: 'APPLY',
    actionReason: '',
    aiExplained: false,
    generatedAt: new Date().toISOString(),
  });
  const application = await db.create('applications', {
    candidateId: candidate.id,
    jobId: job.id,
    matchId: match.id,
    status: 'Prepared',
    statusHistory: [],
    followUpCount: 0,
    scamFlags: options.scamFlags ?? [],
  });
  await db.create('application_messages', {
    applicationId: application.id,
    candidateId: candidate.id,
    kind: 'application',
    channel: 'email',
    language: 'de',
    subject: 'Bewerbung als Elektriker',
    body: 'Sehr geehrte Damen und Herren, …',
    attachments: [],
    needsInfo: options.needsInfo ?? [],
  });
  return { candidate, application };
}

describe('safety rails around automatic sending', () => {
  it('allows a strong match when every rail passes', async () => {
    const { application } = await setup({});
    const decision = await mayAutoSend(application.id, ALLOWING_POLICY);
    expect(decision.allowed).toBe(true);
  });

  it('refuses a match below the threshold', async () => {
    const { application } = await setup({ score: 70 });
    const decision = await mayAutoSend(application.id, ALLOWING_POLICY);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('70%');
  });

  it('never sends an advert the scam protection flagged', async () => {
    const { application } = await setup({ scamFlags: ['Payment demanded for a job'] });
    const decision = await mayAutoSend(application.id, ALLOWING_POLICY);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toMatch(/scam/i);
  });

  it('never sends a draft that still has a missing fact', async () => {
    const { application } = await setup({ needsInfo: ['NEEDS INFO: earliest start date'] });
    const decision = await mayAutoSend(application.id, ALLOWING_POLICY);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toMatch(/missing facts/i);
  });

  it('holds back the first applications of a new person', async () => {
    const { application } = await setup({ reviewed: 2 });
    const decision = await mayAutoSend(application.id, { ...ALLOWING_POLICY, reviewFirstNPerPerson: 5 });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('first 5');
  });

  it('respects the daily cap', async () => {
    const { application } = await setup({});
    const decision = await mayAutoSend(application.id, { ...ALLOWING_POLICY, maxApplicationsPerPersonPerDay: 0 });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toMatch(/daily cap/i);
  });

  it('sends nothing for a person who is not active', async () => {
    const { application } = await setup({ status: 'paused' });
    const decision = await mayAutoSend(application.id, ALLOWING_POLICY);
    expect(decision.allowed).toBe(false);
  });

  it('sends nothing at all under the default cautious policy', async () => {
    const { application } = await setup({});
    const decision = await mayAutoSend(application.id, CONSERVATIVE_POLICY);
    expect(decision.allowed).toBe(false);
  });
});

describe('the agent roster', () => {
  it('has one agent per job named in the build plan', () => {
    const keys = AGENTS.map((agent) => agent.key);
    for (const key of ['scout', 'matcher', 'writer', 'sender', 'chaser', 'reader', 'radar', 'immigration', 'coach']) {
      expect(keys).toContain(key);
    }
  });

  it('gives every agent an interval and a description', () => {
    for (const agent of AGENTS) {
      expect(agent.everyHours).toBeGreaterThan(0);
      expect(agent.description.length).toBeGreaterThan(20);
    }
  });
});

describe('today’s priorities', () => {
  it('raises a follow-up once the application has been silent long enough', async () => {
    const candidate = await db.create('candidates', {
      name: 'Aline',
      country: 'Rwanda',
      track: 'A-skilled',
      status: 'active',
    });
    await db.create('applications', {
      candidateId: candidate.id,
      status: 'Applied',
      statusHistory: [],
      followUpCount: 0,
      appliedAt: new Date(Date.now() - 12 * 86_400_000).toISOString(),
    });
    const priorities = await computePriorities(10);
    const followUp = priorities.find((item) => item.key.startsWith('followup-'));
    expect(followUp).toBeDefined();
    expect(followUp?.priority).toBe('red');
  });

  it('asks for a CV when none is uploaded', async () => {
    const candidate = await db.create('candidates', {
      name: 'Aline',
      country: 'Rwanda',
      track: 'A-skilled',
      status: 'active',
    });
    const priorities = await computePriorities(10);
    expect(priorities.some((item) => item.key === `nocv-${candidate.id}`)).toBe(true);
  });
});

describe('the agent runtime', () => {
  it('stops within its time budget and postpones the rest', async () => {
    const { runDueAgents } = await import('@/agents');
    const summary = await runDueAgents({ trigger: 'manual', force: true, budgetMs: 0 });
    expect(summary.ran).toHaveLength(0);
    expect(summary.postponed.length).toBe(9);
    expect(summary.trigger).toBe('manual');
  });

  it('runs only the agents it is asked for', async () => {
    const { runDueAgents } = await import('@/agents');
    const summary = await runDueAgents({ trigger: 'manual', force: true, only: ['matcher'] });
    expect(summary.ran.map((r) => r.agent)).toEqual(['Matcher']);
  });
});
