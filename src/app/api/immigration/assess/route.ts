import { guard } from '@/lib/api';
import { evaluateAllPathways, saveAssessment } from '@/services/immigration';

export async function POST(request: Request) {
  return guard(async () => {
    const { candidateId } = (await request.json()) as { candidateId?: string };
    if (!candidateId) throw new Error('No person given.');
    const evaluations = await evaluateAllPathways(candidateId);
    for (const evaluation of evaluations) await saveAssessment(candidateId, evaluation);
    return evaluations.map((e) => ({
      key: e.pathway.key,
      name: e.pathway.name,
      lawRef: e.pathway.lawRef,
      verdict: e.verdict,
      score: e.score,
      reasoning: e.reasoning,
      documents: e.documents,
      nextSteps: e.nextSteps,
      requirements: e.requirements,
      sourceUrl: e.pathway.sourceUrl,
      lawUrl: e.pathway.lawUrl,
    }));
  });
}
