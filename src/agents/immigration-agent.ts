import { db } from '@/services/db';
import { buildChecklist, evaluateAllPathways, saveAssessment } from '@/services/immigration';
import { logAudit } from '@/services/tracking/audit';
import { emptyResult, type Agent, type AgentContext, type AgentResult } from './types';

/** Starts the visa file the moment a real offer exists — not a day earlier. */
export const immigrationAgent: Agent = {
  key: 'immigration',
  name: 'Immigration',
  description: 'As soon as an offer or contract exists, works out the pathway and builds the checklist.',
  everyHours: 24,

  async run(ctx: AgentContext): Promise<AgentResult> {
    const result = emptyResult('Immigration');
    const applications = await db.list('applications', {
      where: [{ field: 'status', op: 'in', value: ['Offer', 'Contract'] }],
    });
    const candidateIds = [...new Set(applications.map((a) => a.candidateId))];

    for (const candidateId of candidateIds) {
      const candidate = await db.get('candidates', candidateId);
      if (!candidate) continue;
      try {
        const evaluations = await evaluateAllPathways(candidateId);
        for (const evaluation of evaluations) await saveAssessment(candidateId, evaluation);
        const best = evaluations.find((e) => e.verdict === 'BEST OPTION');
        if (!best) {
          result.skipped.push(`${candidate.name}: no route is currently recommended — look at it yourself.`);
          continue;
        }
        const existing = await db.byCandidate('checklist_items', candidateId);
        if (existing.some((item) => item.pathwayKey === best.pathway.key)) {
          result.skipped.push(`${candidate.name}: the checklist for ${best.pathway.name} already exists.`);
          continue;
        }
        const checklist = await buildChecklist(candidateId, best.pathway.key);
        result.did.push(
          `${candidate.name}: ${best.pathway.name} (${best.pathway.lawRef}) looks like the route — ${checklist.length} checklist items created.`,
        );
      } catch (err) {
        result.errors.push(`${candidate.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    await logAudit({
      who: 'Immigration agent',
      what: 'Worked out pathways for people with an offer',
      why: `${ctx.trigger} run`,
      outcome: result.errors.length > 0 ? 'error' : 'ok',
      detail: result.did.join(' | ').slice(0, 900),
    });
    return result;
  },
};
