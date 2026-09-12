import { db } from '@/services/db';
import { matchCandidateToStoredJobs } from '@/services/matching';
import { logAudit } from '@/services/tracking/audit';
import { emptyResult, type Agent, type AgentContext, type AgentResult } from './types';

export const matcher: Agent = {
  key: 'matcher',
  name: 'Matcher',
  description: 'Scores every stored vacancy against every active person and explains the strongest ones.',
  everyHours: 12,

  async run(ctx: AgentContext): Promise<AgentResult> {
    const result = emptyResult('Matcher');
    const candidates = await db.list('candidates', { where: [{ field: 'status', op: '==', value: 'active' }] });

    for (const candidate of candidates) {
      try {
        const matches = await matchCandidateToStoredJobs(candidate.id, { aiTopN: 5 });
        const strong = matches.filter((m) => m.score >= ctx.policy.autoSendScoreThreshold).length;
        result.did.push(`${candidate.name}: ${matches.length} scored, ${strong} at or above your threshold.`);
      } catch (err) {
        result.errors.push(`${candidate.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    await logAudit({
      who: 'Matcher agent',
      what: 'Recalculated matches',
      why: `${ctx.trigger} run`,
      outcome: result.errors.length > 0 ? 'error' : 'ok',
      detail: result.did.join(' | ').slice(0, 900),
    });
    return result;
  },
};
