import { db, type LanguageLevel } from '../db';
import { candidateContext, languageOf, levelValue } from '../matching';
import { NO_UNSKILLED_VISA_NOTE, NOT_LEGAL_ADVICE, PATHWAYS } from './pathways';
import { storedRequirements } from './recheck';

/**
 * Track B — the apprenticeship route for people without a vocational
 * qualification (BUILD_PLAN Part G). It never shows a percentage and never
 * offers a "helper job visa", because none exists.
 */

export interface TrackBEligibility {
  applies: boolean;
  headline: string;
  age?: number;
  hasSchoolCertificate: boolean;
  german: LanguageLevel;
  english: LanguageLevel;
  funds: 'own' | 'sponsor' | 'none' | 'unknown';
  blockers: string[];
  bridges: { name: string; note: string; sourceUrl: string; label: 'LIKELY-NEEDS-CONFIRMATION' }[];
  requirements: { text: string; label: string; sourceUrl: string; checkedAt?: string }[];
  disclaimer: string;
}

const BRIDGES = [
  {
    name: 'Au pair (age limits apply)',
    note: 'A year with a German host family. Check the current age limit and conditions on the official page.',
    sourceUrl: 'https://www.make-it-in-germany.com/en/visa-residence/types/au-pair',
  },
  {
    name: 'Voluntary service (FSJ / BFD)',
    note: 'A voluntary social year in Germany. Places are limited and usually organised through a recognised provider.',
    sourceUrl: 'https://www.make-it-in-germany.com/en/visa-residence/types/voluntary-service',
  },
  {
    name: 'Visa to look for a training place (§ 17 AufenthG)',
    note: 'A limited stay to find an apprenticeship. Age, language level and proof of funds apply — read the current values on the official page.',
    sourceUrl: 'https://www.gesetze-im-internet.de/aufenthg_2004/__17.html',
  },
  {
    name: 'Language course visa (§ 16f AufenthG), then apprenticeship',
    note: 'A full-time German course in Germany. It does not allow work, and it must be planned so it leads to a training place.',
    sourceUrl: 'https://www.gesetze-im-internet.de/aufenthg_2004/__16f.html',
  },
] as const;

export async function assessTrackB(candidateId: string): Promise<TrackBEligibility> {
  const ctx = await candidateContext(candidateId);
  const [documents, requirements] = await Promise.all([
    db.byCandidate('documents', candidateId),
    storedRequirements('training'),
  ]);
  const training = PATHWAYS.find((p) => p.key === 'training')!;

  const qualification = ctx.profile?.qualificationLevel ?? 'none';
  const applies = qualification === 'none' || ctx.candidate.track === 'B-apprenticeship';
  const german = (languageOf(ctx.languages, 'German') ?? 'none') as LanguageLevel;
  const english = (languageOf(ctx.languages, 'English') ?? 'none') as LanguageLevel;
  const age = ctx.candidate.birthYear ? new Date().getFullYear() - ctx.candidate.birthYear : undefined;
  const hasSchoolCertificate = documents.some((d) => d.type === 'school certificate' || d.type === 'diploma');

  const blockers: string[] = [];
  if (!hasSchoolCertificate) {
    blockers.push('No school-leaving certificate is uploaded. Companies and the embassy both ask for it.');
  }
  if (levelValue(german) < levelValue('B1')) {
    blockers.push(
      `German is ${german}. Apprenticeships are taught in German — plan the course to the level the company asks for (often around B1) and put the exam date in the plan.`,
    );
  }
  blockers.push(
    'Proof of money for the gap between the training pay and the amount the embassy requires. Read the current amount on the official page before planning.',
  );

  return {
    applies,
    headline: NO_UNSKILLED_VISA_NOTE,
    age,
    hasSchoolCertificate,
    german,
    english,
    funds: 'unknown',
    blockers,
    bridges: BRIDGES.map((bridge) => ({ ...bridge, label: 'LIKELY-NEEDS-CONFIRMATION' as const })),
    requirements: training.requirements.map((requirement) => {
      const stored = requirements.find((r) => r.requirementKey === requirement.key);
      return {
        text: stored?.text ?? requirement.text,
        label: stored?.label ?? 'LIKELY-NEEDS-CONFIRMATION',
        sourceUrl: stored?.sourceUrl ?? requirement.sourceUrl,
        checkedAt: stored?.checkedAt,
      };
    }),
    disclaimer: NOT_LEGAL_ADVICE,
  };
}

export interface GermanPlanStep {
  from: LanguageLevel;
  to: LanguageLevel;
  months: number;
  targetDate: string;
  exam: string;
}

/** A plain plan from the current level to B1, with exam options in their country. */
export function germanPlan(current: LanguageLevel, target: LanguageLevel = 'B1'): GermanPlanStep[] {
  const ladder: LanguageLevel[] = ['none', 'A1', 'A2', 'B1', 'B2', 'C1'];
  const start = Math.max(0, ladder.indexOf(current));
  const end = ladder.indexOf(target);
  const steps: GermanPlanStep[] = [];
  let cursor = new Date();
  for (let i = start; i < end; i += 1) {
    const months = 3;
    cursor = new Date(cursor.getTime() + months * 30 * 86_400_000);
    steps.push({
      from: ladder[i],
      to: ladder[i + 1],
      months,
      targetDate: cursor.toISOString().slice(0, 10),
      exam: 'Goethe-Institut, telc or ÖSD — check which of them examines in the person’s country and city.',
    });
  }
  return steps;
}

export async function createGermanPlanTasks(candidateId: string, target: LanguageLevel = 'B1') {
  const ctx = await candidateContext(candidateId);
  const current = (languageOf(ctx.languages, 'German') ?? 'none') as LanguageLevel;
  const steps = germanPlan(current, target);
  const created = [];
  for (const step of steps) {
    const title = `German ${step.from} → ${step.to} for ${ctx.candidate.name}`;
    const existing = await db.first('tasks', { where: [{ field: 'title', op: '==', value: title }] });
    if (existing) {
      created.push(existing);
      continue;
    }
    created.push(
      await db.create('tasks', {
        title,
        detail: `Target date ${step.targetDate}. Exam options: ${step.exam}`,
        priority: 'orange',
        candidateId,
        owner: 'candidate',
        due: step.targetDate,
        state: 'open',
        source: 'system',
        link: `/people/${candidateId}/track-b`,
      }),
    );
  }
  return created;
}

/** The sponsor gap: training pay against the amount the embassy requires. */
export function sponsorGap(monthlyTrainingPayEur: number, requiredMonthlyEur: number) {
  const gap = Math.max(0, requiredMonthlyEur - monthlyTrainingPayEur);
  return {
    gap,
    note:
      gap === 0
        ? 'The training pay covers the amount currently required — still confirm the figure with the responsible German mission.'
        : `The training pay is about €${gap.toLocaleString('en-GB')} per month short of the required amount. A sponsor can cover this with a Verpflichtungserklärung — which makes the sponsor legally liable for the costs, including any that arise later.`,
    disclaimer:
      'The required amount changes. Read the current figure on the official page before anyone signs anything.',
  };
}
