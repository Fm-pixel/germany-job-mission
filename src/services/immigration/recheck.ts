import crypto from 'node:crypto';
import { z } from 'zod';
import { db, type SourceLabel, type VisaRequirement } from '../db';
import { aiAvailable, askJson } from '../ai/client';
import { fetchOfficialPage, SourceUnreachableError } from './official-sources';
import { PATHWAYS } from './pathways';

/**
 * "Re-check sources": reads the official pages and stores what they actually
 * say, with the date. A requirement is only labelled CONFIRMED when the page
 * that was read supports it. Numbers (salary thresholds, blocked-account
 * amount) are only ever stored from a page that was really fetched.
 */

const CheckSchema = z.object({
  supported: z
    .boolean()
    .describe('True only if the page text clearly supports the statement. Missing information means false.'),
  quote: z.string().describe('The sentence from the page that supports it, or "" if there is none.'),
  currentValue: z
    .string()
    .describe('The current value the page states for this requirement (amount, level, number of years), or "".'),
  note: z.string().describe('One sentence for the owner: what the page says or why it could not be confirmed.'),
});

export interface RecheckOutcome {
  pathwayKey: string;
  requirementKey: string;
  label: SourceLabel;
  text: string;
  sourceUrl: string;
  checkedAt: string;
  value?: string;
  note: string;
  changed: boolean;
}

async function storeSourcePage(topic: string, url: string, text: string): Promise<boolean> {
  const hash = crypto.createHash('sha256').update(text).digest('hex').slice(0, 32);
  const existing = await db.first('sources', { where: [{ field: 'url', op: '==', value: url }] });
  const changed = Boolean(existing && existing.contentHash && existing.contentHash !== hash);
  const payload = {
    topic,
    url,
    checkedAt: new Date().toISOString(),
    contentHash: hash,
    changed,
    summary: text.slice(0, 400),
  };
  if (existing) await db.update('sources', existing.id, payload);
  else await db.create('sources', payload);
  return changed;
}

async function upsertRequirement(
  pathwayKey: string,
  requirementKey: string,
  data: Omit<VisaRequirement, 'id' | 'createdAt' | 'updatedAt'> & { requirementKey?: string },
) {
  const existing = await db.first('visa_requirements', {
    where: [
      { field: 'pathwayKey', op: '==', value: pathwayKey },
      { field: 'requirementKey', op: '==', value: requirementKey },
    ],
  });
  const payload = { ...data, requirementKey };
  if (existing) return db.update('visa_requirements', existing.id, payload);
  return db.create('visa_requirements', payload as never);
}

export async function recheckPathway(pathwayKey: string): Promise<RecheckOutcome[]> {
  const pathway = PATHWAYS.find((p) => p.key === pathwayKey);
  if (!pathway) throw new Error(`Unknown pathway "${pathwayKey}".`);

  await db
    .first('visa_pathways', { where: [{ field: 'key', op: '==', value: pathway.key }] })
    .then(async (existing) => {
      const payload = {
        key: pathway.key,
        name: pathway.name,
        lawRef: pathway.lawRef,
        summary: pathway.summary,
        sourceUrl: pathway.sourceUrl,
        checkedAt: new Date().toISOString(),
      };
      if (existing) await db.update('visa_pathways', existing.id, payload);
      else await db.create('visa_pathways', payload);
    });

  const pages = new Map<string, { text: string; changed: boolean } | { error: string }>();
  const outcomes: RecheckOutcome[] = [];

  for (const requirement of pathway.requirements) {
    const url = requirement.sourceUrl;
    if (!pages.has(url)) {
      try {
        const page = await fetchOfficialPage(url);
        const changed = await storeSourcePage(`${pathway.name} — ${pathway.lawRef}`, url, page.text);
        pages.set(url, { text: page.text, changed });
      } catch (err) {
        pages.set(url, {
          error: err instanceof SourceUnreachableError ? err.message : String(err),
        });
      }
    }
    const page = pages.get(url)!;
    const checkedAt = new Date().toISOString();

    if ('error' in page) {
      const outcome: RecheckOutcome = {
        pathwayKey: pathway.key,
        requirementKey: requirement.key,
        label: 'LIKELY-NEEDS-CONFIRMATION',
        text: requirement.text,
        sourceUrl: url,
        checkedAt,
        note: `The official page could not be read from this server (${page.error}). The requirement stays marked as needing confirmation.`,
        changed: false,
      };
      outcomes.push(outcome);
      await upsertRequirement(pathway.key, requirement.key, {
        pathwayKey: pathway.key,
        text: requirement.text,
        label: 'LIKELY-NEEDS-CONFIRMATION',
        sourceUrl: url,
        checkedAt,
      });
      continue;
    }

    if (!aiAvailable()) {
      outcomes.push({
        pathwayKey: pathway.key,
        requirementKey: requirement.key,
        label: 'LIKELY-NEEDS-CONFIRMATION',
        text: requirement.text,
        sourceUrl: url,
        checkedAt,
        note: 'The page was fetched, but reading it needs the Anthropic API (NOT CONNECTED). Open the link and check it yourself.',
        changed: page.changed,
      });
      continue;
    }

    let result;
    try {
      result = await askJson(
        CheckSchema,
        `Here is the text of an official German government page.

PAGE: ${url}
"""
${page.text.slice(0, 40000)}
"""

STATEMENT TO CHECK: "${requirement.text}"

Does this page clearly support the statement? Quote the supporting sentence. If the requirement has a current value (an amount of money, a language level, a number of years, an age limit), write exactly the value the page states. If the page does not say it, leave the value empty and set supported to false. Never fill in a number from your own knowledge.`,
        { maxTokens: 1500 },
      );
    } catch (err) {
      outcomes.push({
        pathwayKey: pathway.key,
        requirementKey: requirement.key,
        label: 'LIKELY-NEEDS-CONFIRMATION',
        text: requirement.text,
        sourceUrl: url,
        checkedAt,
        note: `The page was fetched but could not be analysed: ${err instanceof Error ? err.message : String(err)}`,
        changed: page.changed,
      });
      continue;
    }

    const label: SourceLabel = result.supported ? 'CONFIRMED' : 'LIKELY-NEEDS-CONFIRMATION';
    const text = result.currentValue
      ? `${requirement.text} Current value according to the page: ${result.currentValue}.`
      : requirement.text;

    await upsertRequirement(pathway.key, requirement.key, {
      pathwayKey: pathway.key,
      text,
      label,
      sourceUrl: url,
      checkedAt,
    });

    outcomes.push({
      pathwayKey: pathway.key,
      requirementKey: requirement.key,
      label,
      text,
      sourceUrl: url,
      checkedAt,
      value: result.currentValue || undefined,
      note: result.note,
      changed: page.changed,
    });
  }

  return outcomes;
}

export async function recheckAll(): Promise<RecheckOutcome[]> {
  const out: RecheckOutcome[] = [];
  for (const pathway of PATHWAYS) {
    out.push(...(await recheckPathway(pathway.key)));
  }
  return out;
}

export async function storedRequirements(pathwayKey: string) {
  return db.list('visa_requirements', { where: [{ field: 'pathwayKey', op: '==', value: pathwayKey }] });
}
