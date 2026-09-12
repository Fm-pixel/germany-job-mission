import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { z } from 'zod';
import { db } from '../db';
import { aiAvailable, askJson } from '../ai/client';

/**
 * rules.md is written by the owner in plain English. Here it becomes a strict
 * JSON policy the agents obey. The Settings page shows the parsed result so it
 * is always visible how a sentence was understood.
 */

export const PolicySchema = z.object({
  autoSendScoreThreshold: z
    .number()
    .describe('Minimum match score (0-100) at which an application may be sent without asking. 101 = never.'),
  reviewFirstNPerPerson: z
    .number()
    .describe('How many applications per new person must be shown for approval before automatic sending starts.'),
  followUpDays: z.number().describe('Days without a reply before a follow-up is prepared.'),
  maxFollowUps: z.number(),
  maxApplicationsPerPersonPerDay: z.number(),
  blockRecruitersAndAgencies: z.boolean(),
  moneyRequiresApproval: z.boolean(),
  notifyAbout: z
    .array(z.enum(['replies', 'interviews', 'offers', 'deadlines', 'money', 'errors', 'everything']))
    .describe('What the owner wants to hear about.'),
  interpretation: z.array(z.string()).describe('One plain sentence per rule saying how it was understood.'),
  unparsedSentences: z.array(z.string()).describe('Sentences that could not be turned into a rule.'),
});

export type Policy = z.infer<typeof PolicySchema>;

/** What the agents get if rules.md cannot be parsed: the cautious version. */
export const CONSERVATIVE_POLICY: Policy = {
  autoSendScoreThreshold: 101,
  reviewFirstNPerPerson: 9999,
  followUpDays: 10,
  maxFollowUps: 1,
  maxApplicationsPerPersonPerDay: 8,
  blockRecruitersAndAgencies: true,
  moneyRequiresApproval: true,
  notifyAbout: ['replies', 'interviews', 'offers', 'deadlines', 'money'],
  interpretation: [
    'rules.md could not be read or parsed, so nothing is sent automatically — every application waits for your approval.',
  ],
  unparsedSentences: [],
};

/**
 * Safety rails. These are applied AFTER parsing and cannot be switched off by
 * any sentence in rules.md.
 */
export function applySafetyRails(policy: Policy): Policy {
  return {
    ...policy,
    autoSendScoreThreshold: Math.max(70, Math.min(101, policy.autoSendScoreThreshold)),
    reviewFirstNPerPerson: Math.max(0, Math.min(999, policy.reviewFirstNPerPerson)),
    followUpDays: Math.max(3, Math.min(90, policy.followUpDays)),
    maxFollowUps: Math.max(0, Math.min(3, policy.maxFollowUps)),
    maxApplicationsPerPersonPerDay: Math.max(0, Math.min(20, policy.maxApplicationsPerPersonPerDay)),
    // Money never moves automatically, whatever the rules say.
    moneyRequiresApproval: true,
  };
}

export function rulesPath(): string {
  return process.env.GJM_RULES_PATH || path.join(process.cwd(), 'rules.md');
}

export function readRulesText(): string {
  try {
    return fs.readFileSync(rulesPath(), 'utf8');
  } catch {
    return '';
  }
}

export function hashRules(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
}

const SYSTEM = `You convert a person's plain-English rules for an application robot into a strict policy object.

- Read only what is written. Do not add rules the text does not contain.
- Where the text says nothing about a field, use the safe default: autoSendScoreThreshold 101 (never send automatically), reviewFirstNPerPerson 9999, followUpDays 10, maxFollowUps 1, maxApplicationsPerPersonPerDay 8, blockRecruitersAndAgencies true, moneyRequiresApproval true.
- "interpretation" contains one short sentence per rule, in the owner's own words, saying how you understood it. This is shown to them, so it must be honest.
- Any sentence you could not convert goes into unparsedSentences, word for word.`;

export async function parsePolicy(rulesText: string): Promise<{ policy: Policy; by: 'ai' | 'fallback' }> {
  const trimmed = rulesText.trim();
  if (trimmed === '') return { policy: CONSERVATIVE_POLICY, by: 'fallback' };
  if (!aiAvailable()) {
    return { policy: { ...fallbackParse(trimmed) }, by: 'fallback' };
  }
  try {
    const parsed = await askJson(PolicySchema, `These are my rules:\n\n${trimmed}`, {
      system: SYSTEM,
      maxTokens: 3000,
    });
    return { policy: applySafetyRails(parsed), by: 'ai' };
  } catch {
    return { policy: fallbackParse(trimmed), by: 'fallback' };
  }
}

/**
 * Works without the AI: reads the numbers that matter out of the text with
 * plain patterns, and stays cautious wherever it is not sure.
 */
export function fallbackParse(text: string): Policy {
  const policy: Policy = { ...CONSERVATIVE_POLICY, interpretation: [], unparsedSentences: [] };
  const lines = text
    .split('\n')
    .map((l) => l.replace(/^[-*#>\s]+/, '').trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));

  for (const line of lines) {
    let understood = false;
    const auto = /automat\w*.*?(\d{1,3})\s?%|(\d{1,3})\s?%.*automat/i.exec(line);
    if (auto) {
      policy.autoSendScoreThreshold = Number(auto[1] ?? auto[2]);
      policy.interpretation.push(`Applications with a match of ${policy.autoSendScoreThreshold}% or more may be sent automatically.`);
      understood = true;
    }
    const firstN = /first\s+(\d{1,3})/i.exec(line);
    if (firstN && /new person|neue|first/i.test(line)) {
      policy.reviewFirstNPerPerson = Number(firstN[1]);
      policy.interpretation.push(`The first ${policy.reviewFirstNPerPerson} applications of a new person are shown to you first.`);
      understood = true;
    }
    const follow = /follow[- ]?up.*?(\d{1,3})\s*days?|(\d{1,3})\s*days?.*follow[- ]?up/i.exec(line);
    if (follow) {
      policy.followUpDays = Number(follow[1] ?? follow[2]);
      policy.maxFollowUps = /once|one time|einmal/i.test(line) ? 1 : policy.maxFollowUps;
      policy.interpretation.push(`Follow up after ${policy.followUpDays} days, at most ${policy.maxFollowUps} time(s).`);
      understood = true;
    }
    const cap = /more than\s+(\d{1,3})\s+applications?/i.exec(line);
    if (cap) {
      policy.maxApplicationsPerPersonPerDay = Number(cap[1]);
      policy.interpretation.push(`At most ${policy.maxApplicationsPerPersonPerDay} applications per person per day.`);
      understood = true;
    }
    if (/recruiter|agency|agentur|vermittler/i.test(line)) {
      policy.blockRecruitersAndAgencies = !/allow|erlaub/i.test(line);
      policy.interpretation.push('Recruiters and agencies are not contacted — only employers directly.');
      understood = true;
    }
    if (/money|cost|kostet|bezahl|pay/i.test(line)) {
      policy.moneyRequiresApproval = true;
      policy.interpretation.push('Anything that costs money waits for your decision.');
      understood = true;
    }
    if (/tell me|notify|inform/i.test(line)) {
      const wants: Policy['notifyAbout'] = [];
      if (/repl/i.test(line)) wants.push('replies');
      if (/interview/i.test(line)) wants.push('interviews');
      if (/offer/i.test(line)) wants.push('offers');
      if (/deadline/i.test(line)) wants.push('deadlines');
      if (/money|cost/i.test(line)) wants.push('money');
      if (wants.length > 0) {
        policy.notifyAbout = wants;
        policy.interpretation.push(`You are told about: ${wants.join(', ')}.`);
        understood = true;
      }
    }
    if (!understood) policy.unparsedSentences.push(line);
  }

  if (policy.interpretation.length === 0) {
    policy.interpretation.push('No rule could be read from rules.md — nothing is sent automatically.');
  }
  return applySafetyRails(policy);
}

const SETTINGS_ID = 'app-settings';

export async function getPolicy(): Promise<Policy> {
  const text = readRulesText();
  const hash = hashRules(text);
  try {
    const stored = await db.get('settings', SETTINGS_ID);
    if (stored?.policy && stored.rulesHash === hash) {
      return applySafetyRails(PolicySchema.parse(stored.policy));
    }
  } catch {
    // The database may not be connected yet — fall through to parsing.
  }
  const { policy, by } = await parsePolicy(text);
  try {
    const stored = await db.get('settings', SETTINGS_ID);
    const payload = {
      rulesText: text,
      rulesHash: hash,
      policy,
      policyParsedAt: new Date().toISOString(),
      policyParsedBy: by,
      followUpDays: policy.followUpDays,
    };
    if (stored) await db.update('settings', SETTINGS_ID, payload);
    else await db.create('settings', payload, SETTINGS_ID);
  } catch {
    // Not being able to cache the policy must never break a page.
  }
  return policy;
}

export async function policyMeta(): Promise<{ parsedBy: 'ai' | 'fallback'; parsedAt?: string; rulesText: string }> {
  const text = readRulesText();
  const stored = await db.get('settings', SETTINGS_ID).catch(() => null);
  return {
    parsedBy: (stored?.policyParsedBy as 'ai' | 'fallback') ?? 'fallback',
    parsedAt: stored?.policyParsedAt,
    rulesText: text,
  };
}

export async function refreshPolicy(): Promise<Policy> {
  const stored = await db.get('settings', SETTINGS_ID).catch(() => null);
  if (stored) await db.update('settings', SETTINGS_ID, { rulesHash: 'stale' });
  return getPolicy();
}
