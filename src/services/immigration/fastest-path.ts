import { db } from '../db';
import { buildContext, evaluateAllPathways, type PathwayEvaluation } from './assess';
import { NO_UNSKILLED_VISA_NOTE, NOT_LEGAL_ADVICE } from './pathways';

export interface FastestPathResult {
  ranked: {
    name: string;
    key: string;
    lawRef: string;
    verdict: PathwayEvaluation['verdict'];
    reason: string;
    nextAction: string;
    sourceUrl: string;
    speed: 'fast' | 'medium' | 'slow';
  }[];
  honestNotes: string[];
  disclaimer: string;
}

/** How long each route realistically takes — employment first, legal always. */
const SPEED: Record<string, 'fast' | 'medium' | 'slow'> = {
  'blue-card': 'fast',
  'skilled-academic': 'fast',
  'experienced-worker': 'fast',
  'skilled-vocational': 'medium',
  'recognition-partnership': 'medium',
  'opportunity-card': 'medium',
  training: 'slow',
  'job-seeker-training': 'slow',
};

export async function fastestRealisticPath(candidateId: string): Promise<FastestPathResult> {
  const [evaluations, ctx, candidate] = await Promise.all([
    evaluateAllPathways(candidateId),
    buildContext(candidateId),
    db.get('candidates', candidateId),
  ]);

  const trackB = ctx.qualificationLevel === 'none' || candidate?.track === 'B-apprenticeship';

  const ranked = evaluations
    .map((evaluation) => ({
      name: evaluation.pathway.name,
      key: evaluation.pathway.key,
      lawRef: evaluation.pathway.lawRef,
      verdict: evaluation.verdict,
      reason:
        evaluation.reasoning.find((r) => r.kind === 'blocking')?.text ??
        evaluation.reasoning.find((r) => r.kind === 'positive')?.text ??
        evaluation.pathway.summary,
      nextAction: evaluation.nextSteps[0] ?? 'Read the official page and confirm the current requirements.',
      sourceUrl: evaluation.pathway.sourceUrl,
      speed: SPEED[evaluation.pathway.key] ?? 'medium',
    }))
    .sort((a, b) => {
      // For Track B the apprenticeship route is ranked first, as BUILD_PLAN Part G requires.
      if (trackB) {
        if (a.key === 'training') return -1;
        if (b.key === 'training') return 1;
      }
      const order = { 'BEST OPTION': 0, POSSIBLE: 1, 'NOT CURRENTLY RECOMMENDED': 2 } as const;
      if (order[a.verdict] !== order[b.verdict]) return order[a.verdict] - order[b.verdict];
      const speedOrder = { fast: 0, medium: 1, slow: 2 } as const;
      return speedOrder[a.speed] - speedOrder[b.speed];
    });

  const honestNotes: string[] = [];
  if (trackB) honestNotes.push(NO_UNSKILLED_VISA_NOTE);
  if (!ctx.hasOffer) {
    honestNotes.push(
      'No job offer exists yet. Every employment route starts with a real employer, so the fastest thing you can do today is send more good applications — not paperwork.',
    );
  }
  honestNotes.push(
    'Short-stay visitor visas (conferences, fairs, family visits) are networking chances only. They never become a residence permit for work.',
  );

  return { ranked, honestNotes, disclaimer: NOT_LEGAL_ADVICE };
}
