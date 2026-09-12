import { z } from 'zod';
import { db, type Opportunity } from '../db';
import { aiAvailable, askJson } from '../ai/client';
import { researchWeb } from '../ai/websearch';
import { candidateContext, languageOf, levelValue } from '../matching';
import { logAudit } from '../tracking/audit';
import { SEED_OPPORTUNITIES, type SeedEntry } from './seed-list';

export { SEED_OPPORTUNITIES };

const DetailSchema = z.object({
  found: z.boolean().describe('False if the official page could not be read or says nothing useful.'),
  summary: z.string(),
  targetCountries: z.array(z.string()).describe('Empty if the page does not name any.'),
  requirements: z.array(z.string()).describe('Only requirements the page actually states.'),
  minAge: z.number().describe('0 if the page does not state one.'),
  maxAge: z.number().describe('0 if the page does not state one.'),
  requiredGerman: z.enum(['none', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'unstated']),
  requiredEnglish: z.enum(['none', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'unstated']),
  requiredEducation: z.enum(['none', 'school', 'vocational', 'academic', 'unstated']),
  windowOpens: z.string().describe('ISO date or "".'),
  windowCloses: z.string().describe('ISO date or "".'),
  nextDeadline: z.string().describe('ISO date or "".'),
  status: z.enum(['open', 'closed', 'watching']),
  quote: z.string(),
});

const SYSTEM = `You research official programmes that could legally bring somebody to Germany.

- Report only what the programme's own official page says. Never fill in a deadline, an age limit or a requirement from memory.
- If the page does not state something, leave it empty / "unstated" / 0.
- If you cannot read the page, set found = false.
- Short-stay visitor visas are never described as a way to stay in Germany.`;

function levelOrUndefined(value: string) {
  return value === 'unstated' || value === 'none' ? undefined : (value as Opportunity['requiredGerman']);
}

export async function researchOpportunity(seed: SeedEntry): Promise<Opportunity> {
  const existing = await db.first('opportunities', { where: [{ field: 'url', op: '==', value: seed.url }] });

  if (!aiAvailable()) {
    const payload = {
      name: seed.name,
      type: seed.type,
      organiser: seed.organiser,
      url: seed.url,
      targetCountries: existing?.targetCountries ?? [],
      requirements: existing?.requirements ?? [],
      checkedAt: existing?.checkedAt ?? new Date().toISOString(),
      status: existing?.status ?? ('watching' as const),
      label: 'LIKELY-NEEDS-CONFIRMATION' as const,
      honestNote: seed.honestNote,
    };
    return existing ? db.update('opportunities', existing.id, payload) : db.create('opportunities', payload);
  }

  const research = await researchWeb(
    `Read the official page ${seed.url} for the programme "${seed.name}" (${seed.organiser}). What does it say about who can apply, which countries it covers, age limits, language and education requirements, the application window and the next deadline? Quote the page.`,
    { system: SYSTEM, maxUses: 4 },
  );

  const detail = await askJson(
    DetailSchema,
    `Programme: ${seed.name} (${seed.organiser})
Official page: ${seed.url}

RESEARCH
${research.text}

Turn this into structured data. Leave anything the page does not state empty.`,
    { system: SYSTEM, maxTokens: 3000 },
  );

  const payload = {
    name: seed.name,
    type: seed.type,
    organiser: seed.organiser,
    url: seed.url,
    targetCountries: detail.targetCountries,
    requirements: detail.found ? detail.requirements : [],
    minAge: detail.minAge || undefined,
    maxAge: detail.maxAge || undefined,
    requiredGerman: levelOrUndefined(detail.requiredGerman),
    requiredEnglish: levelOrUndefined(detail.requiredEnglish),
    requiredEducation: detail.requiredEducation === 'unstated' ? undefined : detail.requiredEducation,
    windowOpens: detail.windowOpens || undefined,
    windowCloses: detail.windowCloses || undefined,
    nextDeadline: detail.nextDeadline || undefined,
    checkedAt: new Date().toISOString(),
    status: detail.found ? detail.status : ('watching' as const),
    label: 'LIKELY-NEEDS-CONFIRMATION' as const,
    honestNote:
      seed.honestNote ??
      (detail.found ? undefined : 'The official page could not be read this time — nothing here is confirmed.'),
  };

  return existing ? db.update('opportunities', existing.id, payload) : db.create('opportunities', payload);
}

export async function seedRadar(): Promise<{ stored: number; withDeadline: number }> {
  let stored = 0;
  let withDeadline = 0;
  for (const seed of SEED_OPPORTUNITIES) {
    const opportunity = await researchOpportunity(seed);
    stored += 1;
    if (opportunity.nextDeadline) withDeadline += 1;
  }
  await logAudit({
    who: 'Radar agent',
    what: 'Refreshed the Opportunity Radar',
    why: 'Seed and re-check the official programme pages',
    detail: `${stored} programmes stored, ${withDeadline} with a deadline`,
  });
  return { stored, withDeadline };
}

export interface OpportunityFit {
  opportunity: Opportunity;
  fits: boolean;
  missing: string[];
}

/** Which doors are open for this person, and what is missing for the others. */
export async function fitsForCandidate(candidateId: string): Promise<OpportunityFit[]> {
  const ctx = await candidateContext(candidateId);
  const opportunities = await db.list('opportunities', { limit: 200 });
  const german = languageOf(ctx.languages, 'German') ?? 'none';
  const english = languageOf(ctx.languages, 'English') ?? 'none';
  const age = ctx.candidate.birthYear ? new Date().getFullYear() - ctx.candidate.birthYear : undefined;
  const education = ctx.profile?.qualificationLevel ?? 'none';

  return opportunities
    .map((opportunity) => {
      const missing: string[] = [];
      if (opportunity.maxAge && age !== undefined && age > opportunity.maxAge) {
        missing.push(`age limit ${opportunity.maxAge} (this person is about ${age})`);
      }
      if (opportunity.minAge && age !== undefined && age < opportunity.minAge) {
        missing.push(`minimum age ${opportunity.minAge}`);
      }
      if (opportunity.requiredGerman && levelValue(german) < levelValue(opportunity.requiredGerman)) {
        missing.push(`needs German ${opportunity.requiredGerman} (has ${german})`);
      }
      if (opportunity.requiredEnglish && levelValue(english) < levelValue(opportunity.requiredEnglish)) {
        missing.push(`needs English ${opportunity.requiredEnglish} (has ${english})`);
      }
      if (opportunity.requiredEducation === 'academic' && education !== 'academic') {
        missing.push('requires a university degree');
      }
      if (opportunity.requiredEducation === 'vocational' && education === 'none') {
        missing.push('requires a vocational qualification');
      }
      if (
        opportunity.targetCountries.length > 0 &&
        !opportunity.targetCountries.some((c) => c.toLowerCase().includes(ctx.candidate.country.toLowerCase()))
      ) {
        missing.push(`the programme names other countries (${opportunity.targetCountries.slice(0, 4).join(', ')})`);
      }
      return { opportunity, fits: missing.length === 0, missing };
    })
    .sort((a, b) => Number(b.fits) - Number(a.fits));
}
