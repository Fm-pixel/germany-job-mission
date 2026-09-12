import { db, type SourceLabel, type VisaAssessment } from '../db';
import { candidateContext, languageOf, levelAtLeast } from '../matching';
import { NOT_LEGAL_ADVICE, PATHWAYS, type PathwayDefinition } from './pathways';
import { storedRequirements } from './recheck';

export interface PathwayEvaluation {
  pathway: PathwayDefinition;
  verdict: 'BEST OPTION' | 'POSSIBLE' | 'NOT CURRENTLY RECOMMENDED';
  score: number;
  reasoning: { text: string; kind: 'positive' | 'warning' | 'blocking'; label: SourceLabel }[];
  documents: string[];
  nextSteps: string[];
  requirements: { text: string; label: SourceLabel; sourceUrl: string; checkedAt?: string }[];
}

export interface AssessmentContext {
  hasOffer: boolean;
  hasContract: boolean;
  qualificationLevel: 'none' | 'vocational' | 'academic' | 'other';
  recognised: boolean;
  german: string;
  english: string;
  yearsExperience: number;
  age?: number;
  grossSalaryPerYearEur?: number;
}

export async function buildContext(candidateId: string): Promise<AssessmentContext> {
  const ctx = await candidateContext(candidateId);
  const [offers, contracts, qualifications] = await Promise.all([
    db.byCandidate('offers', candidateId),
    db.byCandidate('contracts', candidateId),
    db.byCandidate('qualifications', candidateId),
  ]);
  const applications = await db.byCandidate('applications', candidateId);
  const salary =
    [...contracts, ...offers].map((c) => c.grossSalaryPerYearEur).find((v) => typeof v === 'number') ?? undefined;

  return {
    hasOffer:
      offers.length > 0 ||
      contracts.length > 0 ||
      applications.some((a) => a.status === 'Offer' || a.status === 'Contract'),
    hasContract: contracts.length > 0 || applications.some((a) => a.status === 'Contract'),
    qualificationLevel: ctx.profile?.qualificationLevel ?? 'none',
    recognised: qualifications.some((q) => q.recognitionStatus === 'recognised'),
    german: languageOf(ctx.languages, 'German') ?? 'none',
    english: languageOf(ctx.languages, 'English') ?? 'none',
    yearsExperience: ctx.profile?.yearsExperience ?? 0,
    age: ctx.candidate.birthYear ? new Date().getFullYear() - ctx.candidate.birthYear : undefined,
    grossSalaryPerYearEur: salary,
  };
}

function evaluate(pathway: PathwayDefinition, ctx: AssessmentContext): Omit<PathwayEvaluation, 'pathway' | 'requirements'> {
  const reasoning: PathwayEvaluation['reasoning'] = [];
  let score = 50;
  let blocking = false;

  if (pathway.needsJobOffer) {
    if (ctx.hasOffer) {
      reasoning.push({
        text: 'A real job offer or contract exists — this route is built on that.',
        kind: 'positive',
        label: 'USER-SPECIFIC',
      });
      score += 25;
    } else {
      reasoning.push({
        text: 'No job offer yet. This route only becomes possible once an employer has made a concrete offer.',
        kind: 'blocking',
        label: 'USER-SPECIFIC',
      });
      blocking = true;
      score -= 30;
    }
  } else {
    reasoning.push({
      text: 'No job offer is needed for this route.',
      kind: 'positive',
      label: 'LIKELY-NEEDS-CONFIRMATION',
    });
    score += 5;
  }

  const q = ctx.qualificationLevel;
  if (pathway.needsQualification === 'academic' && q !== 'academic') {
    reasoning.push({
      text: 'This route is for university degrees, and no degree is recorded for this person.',
      kind: 'blocking',
      label: 'USER-SPECIFIC',
    });
    blocking = true;
    score -= 30;
  } else if (pathway.needsQualification === 'vocational' && q !== 'vocational' && q !== 'academic') {
    reasoning.push({
      text: 'This route needs a completed vocational qualification, which is not recorded for this person.',
      kind: 'blocking',
      label: 'USER-SPECIFIC',
    });
    blocking = true;
    score -= 30;
  } else if (pathway.needsQualification === 'none' && q === 'none') {
    reasoning.push({
      text: 'No vocational qualification is needed for this route — that fits this person.',
      kind: 'positive',
      label: 'USER-SPECIFIC',
    });
    score += 20;
  } else if (q !== 'none') {
    reasoning.push({
      text: `Recorded qualification level (${q}) fits what this route asks for.`,
      kind: 'positive',
      label: 'USER-SPECIFIC',
    });
    score += 15;
  }

  if (pathway.needsRecognition) {
    if (ctx.recognised) {
      reasoning.push({
        text: 'The qualification is recorded as recognised in Germany.',
        kind: 'positive',
        label: 'USER-SPECIFIC',
      });
      score += 15;
    } else {
      reasoning.push({
        text: 'Recognition of the qualification is not recorded yet — this is normally the longest step and must be started early.',
        kind: 'warning',
        label: 'USER-SPECIFIC',
      });
      score -= 10;
    }
  }

  if (pathway.minGerman) {
    if (levelAtLeast(ctx.german as never, pathway.minGerman)) {
      reasoning.push({
        text: `German ${ctx.german} meets the level normally expected here (${pathway.minGerman}).`,
        kind: 'positive',
        label: 'LIKELY-NEEDS-CONFIRMATION',
      });
      score += 10;
    } else {
      reasoning.push({
        text: `German is ${ctx.german}; this route normally expects around ${pathway.minGerman}. Confirm the current level on the official page.`,
        kind: 'warning',
        label: 'LIKELY-NEEDS-CONFIRMATION',
      });
      score -= 10;
    }
  }

  if (pathway.key === 'blue-card' || pathway.key === 'experienced-worker') {
    reasoning.push({
      text: ctx.grossSalaryPerYearEur
        ? `The offer states about €${ctx.grossSalaryPerYearEur.toLocaleString('en-GB')} gross per year. Compare it with the threshold on the official page — this tool does not state the threshold from memory.`
        : 'This route has a salary threshold. No gross annual salary is recorded yet, and the threshold must be read from the official page.',
      kind: 'warning',
      label: 'LIKELY-NEEDS-CONFIRMATION',
    });
  }

  if (pathway.key === 'experienced-worker' && ctx.yearsExperience > 0) {
    reasoning.push({
      text: `${ctx.yearsExperience} years of experience are recorded. Check the number of years the current rule asks for.`,
      kind: 'warning',
      label: 'LIKELY-NEEDS-CONFIRMATION',
    });
    score += Math.min(10, ctx.yearsExperience * 2);
  }

  if (pathway.key === 'job-seeker-training' && ctx.age !== undefined) {
    reasoning.push({
      text: `Age is about ${ctx.age}. This route has an age limit — read the current limit on the official page.`,
      kind: 'warning',
      label: 'LIKELY-NEEDS-CONFIRMATION',
    });
  }

  const verdict: PathwayEvaluation['verdict'] = blocking
    ? 'NOT CURRENTLY RECOMMENDED'
    : score >= 80
      ? 'BEST OPTION'
      : 'POSSIBLE';

  return {
    verdict,
    score: Math.max(0, Math.min(100, score)),
    reasoning,
    documents: pathway.documents,
    nextSteps: pathway.nextSteps,
  };
}

export async function evaluateAllPathways(candidateId: string): Promise<PathwayEvaluation[]> {
  const ctx = await buildContext(candidateId);
  const results: PathwayEvaluation[] = [];
  for (const pathway of PATHWAYS) {
    const stored = await storedRequirements(pathway.key);
    const requirements = pathway.requirements.map((requirement) => {
      const match = stored.find((s) => s.requirementKey === requirement.key);
      return {
        text: match?.text ?? requirement.text,
        label: match?.label ?? ('LIKELY-NEEDS-CONFIRMATION' as SourceLabel),
        sourceUrl: match?.sourceUrl ?? requirement.sourceUrl,
        checkedAt: match?.checkedAt,
      };
    });
    results.push({ pathway, requirements, ...evaluate(pathway, ctx) });
  }
  const best = results.filter((r) => r.verdict !== 'NOT CURRENTLY RECOMMENDED').sort((a, b) => b.score - a.score);
  if (best.length > 0) {
    for (const result of results) {
      if (result !== best[0] && result.verdict === 'BEST OPTION') result.verdict = 'POSSIBLE';
    }
    best[0].verdict = 'BEST OPTION';
  }
  return results.sort((a, b) => b.score - a.score);
}

export async function saveAssessment(
  candidateId: string,
  evaluation: PathwayEvaluation,
): Promise<VisaAssessment> {
  const payload = {
    candidateId,
    pathwayKey: evaluation.pathway.key,
    eligible:
      evaluation.verdict === 'BEST OPTION'
        ? ('likely' as const)
        : evaluation.verdict === 'POSSIBLE'
          ? ('possible' as const)
          : ('not-currently' as const),
    reasoning: evaluation.reasoning,
    documents: evaluation.documents,
    nextSteps: evaluation.nextSteps,
    disclaimer: NOT_LEGAL_ADVICE,
    generatedAt: new Date().toISOString(),
  };
  const existing = await db.first('visa_assessments', {
    where: [
      { field: 'candidateId', op: '==', value: candidateId },
      { field: 'pathwayKey', op: '==', value: evaluation.pathway.key },
    ],
  });
  if (existing) return db.update('visa_assessments', existing.id, payload);
  return db.create('visa_assessments', payload);
}
