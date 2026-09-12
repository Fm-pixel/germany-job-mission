import { z } from 'zod';
import { db } from '../db';
import { aiAvailable, askJson } from '../ai/client';
import { fetchOfficialPage } from './official-sources';
import { buildContext } from './assess';
import { NOT_LEGAL_ADVICE } from './pathways';

/**
 * Opportunity Card (Chancenkarte) — SPEC section 15.
 *
 * The points table is NEVER written from memory. It is fetched from
 * make-it-in-germany.com and stored with the date. Until that has happened,
 * the module says so and refuses to calculate a points total.
 */

const OFFICIAL_URL = 'https://www.make-it-in-germany.com/en/visa-residence/opportunity-card';
const CRITERIA_DOC_ID = 'opportunity-card-criteria';

export const CriteriaSchema = z.object({
  baseRequirements: z.array(z.string()).describe('The requirements everybody must meet, in the page\'s own words.'),
  pointsNeeded: z.number().describe('The number of points needed. 0 if the page does not state it.'),
  criteria: z.array(
    z.object({
      key: z.string(),
      description: z.string().describe('The criterion exactly as the page describes it.'),
      points: z.number(),
    }),
  ),
  quote: z.string().describe('A short quote from the page showing where this comes from.'),
});

export type Criteria = z.infer<typeof CriteriaSchema>;

export interface StoredCriteria {
  criteria: Criteria;
  sourceUrl: string;
  checkedAt: string;
}

export async function loadStoredCriteria(): Promise<StoredCriteria | null> {
  const row = await db.get('sources', CRITERIA_DOC_ID).catch(() => null);
  if (!row?.summary) return null;
  try {
    const parsed = CriteriaSchema.parse(JSON.parse(row.summary));
    return { criteria: parsed, sourceUrl: row.url, checkedAt: row.checkedAt };
  } catch {
    return null;
  }
}

export async function fetchCriteria(): Promise<StoredCriteria> {
  if (!aiAvailable()) {
    throw Object.assign(
      new Error(
        'Reading the official points table needs the Anthropic API (NOT CONNECTED). Open the official page yourself: ' +
          OFFICIAL_URL,
      ),
      { code: 'AI_NOT_CONNECTED' },
    );
  }
  const page = await fetchOfficialPage(OFFICIAL_URL);
  const criteria = await askJson(
    CriteriaSchema,
    `This is the official German government page about the Opportunity Card (Chancenkarte).

"""
${page.text.slice(0, 60000)}
"""

Write down the base requirements and the points criteria EXACTLY as this page states them. Do not add criteria or points from your own knowledge. If the page does not state the number of points needed, use 0.`,
    { maxTokens: 4000 },
  );

  const payload = {
    topic: 'Opportunity Card points criteria',
    url: OFFICIAL_URL,
    checkedAt: new Date().toISOString(),
    summary: JSON.stringify(criteria),
  };
  const existing = await db.get('sources', CRITERIA_DOC_ID).catch(() => null);
  if (existing) await db.update('sources', CRITERIA_DOC_ID, payload);
  else await db.create('sources', payload, CRITERIA_DOC_ID);

  return { criteria, sourceUrl: OFFICIAL_URL, checkedAt: payload.checkedAt };
}

export const RESULT_SENTENCE =
  'Your information suggests that you may qualify, but final eligibility must be confirmed by the German authorities.';

export interface ChancenkarteAssessment {
  criteriaLoaded: boolean;
  sourceUrl: string;
  checkedAt?: string;
  baseRequirements: { text: string; met: 'yes' | 'no' | 'needs-evidence'; note: string }[];
  points?: { criterion: string; points: number; met: boolean; note: string }[];
  pointsTotal?: number;
  pointsNeeded?: number;
  result: string;
  disclaimer: string;
}

/**
 * Evaluates the person against the stored criteria. Where the criteria have not
 * been fetched, it says so instead of guessing.
 */
export async function assessChancenkarte(candidateId: string): Promise<ChancenkarteAssessment> {
  const ctx = await buildContext(candidateId);
  const stored = await loadStoredCriteria();

  const base: ChancenkarteAssessment['baseRequirements'] = [
    {
      text: 'A vocational qualification (of the required length) or a university degree, recognised by the state in the country where it was obtained.',
      met: ctx.qualificationLevel === 'none' ? 'no' : 'needs-evidence',
      note:
        ctx.qualificationLevel === 'none'
          ? 'No vocational qualification or degree is recorded for this person.'
          : `Recorded as ${ctx.qualificationLevel}. Proof that it is state-recognised in the home country is needed.`,
    },
    {
      text: 'German at the required minimum level, or English at the required minimum level.',
      met: ctx.german !== 'none' || ctx.english !== 'none' ? 'needs-evidence' : 'no',
      note: `German ${ctx.german}, English ${ctx.english}. A certificate is needed; check the exact level the official page asks for.`,
    },
    {
      text: 'Proof of enough money to live on during the stay.',
      met: 'needs-evidence',
      note: 'No financial proof is recorded. The required amount changes — read it on the official page before planning.',
    },
  ];

  if (!stored) {
    return {
      criteriaLoaded: false,
      sourceUrl: OFFICIAL_URL,
      baseRequirements: base,
      result:
        'The official points table has not been read yet, so no points total is calculated. Press “Re-check sources” (the server needs to reach make-it-in-germany.com), or open the official self-check with the link above.',
      disclaimer: NOT_LEGAL_ADVICE,
    };
  }

  const points = stored.criteria.criteria.map((criterion) => {
    const text = `${criterion.key} ${criterion.description}`.toLowerCase();
    let met = false;
    let note = 'Cannot be decided from the data on file — check this criterion yourself.';

    if (/german|deutsch/.test(text)) {
      const level = /(a1|a2|b1|b2|c1|c2)/.exec(text)?.[1]?.toUpperCase();
      if (level) {
        const order = ['none', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'native'];
        met = order.indexOf(ctx.german) >= order.indexOf(level);
        note = `German on file: ${ctx.german}; this criterion asks for ${level}.`;
      }
    } else if (/english|englisch/.test(text)) {
      const level = /(a1|a2|b1|b2|c1|c2)/.exec(text)?.[1]?.toUpperCase();
      if (level) {
        const order = ['none', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'native'];
        met = order.indexOf(ctx.english) >= order.indexOf(level);
        note = `English on file: ${ctx.english}; this criterion asks for ${level}.`;
      }
    } else if (/experience|berufserfahrung/.test(text)) {
      const years = Number(/(\d+)\s*(years|jahre)/.exec(text)?.[1] ?? 0);
      if (years) {
        met = ctx.yearsExperience >= years;
        note = `${ctx.yearsExperience} years on file; this criterion asks for ${years}.`;
      }
    } else if (/age|alter/.test(text) && ctx.age !== undefined) {
      const limit = Number(/(\d{2})/.exec(text)?.[1] ?? 0);
      if (limit) {
        met = ctx.age <= limit;
        note = `Age about ${ctx.age}; this criterion refers to ${limit}.`;
      }
    }
    return { criterion: criterion.description, points: criterion.points, met, note };
  });

  const total = points.filter((p) => p.met).reduce((sum, p) => sum + p.points, 0);

  return {
    criteriaLoaded: true,
    sourceUrl: stored.sourceUrl,
    checkedAt: stored.checkedAt,
    baseRequirements: base,
    points,
    pointsTotal: total,
    pointsNeeded: stored.criteria.pointsNeeded || undefined,
    result: RESULT_SENTENCE,
    disclaimer: NOT_LEGAL_ADVICE,
  };
}
