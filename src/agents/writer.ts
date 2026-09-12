import { db } from '@/services/db';
import { aiAvailable } from '@/services/ai/client';
import { prepareApplicationForMatch } from '@/services/applications';
import { logAudit } from '@/services/tracking/audit';
import { emptyResult, type Agent, type AgentContext, type AgentResult } from './types';

/** Writes drafts for strong matches. Drafting is never sending. */
export const writer: Agent = {
  key: 'writer',
  name: 'Writer',
  description: 'Writes the application for matches recommended as APPLY, and puts them in the review queue.',
  everyHours: 12,

  async run(ctx: AgentContext): Promise<AgentResult> {
    const result = emptyResult('Writer');
    if (!aiAvailable()) {
      result.skipped.push('The Anthropic API is NOT CONNECTED, so nothing can be written.');
      return result;
    }

    const candidates = await db.list('candidates', { where: [{ field: 'status', op: '==', value: 'active' }] });
    for (const candidate of candidates) {
      const [matches, applications] = await Promise.all([
        db.byCandidate('job_matches', candidate.id),
        db.byCandidate('applications', candidate.id),
      ]);
      const alreadyHandled = new Set(applications.map((a) => a.jobId).filter(Boolean) as string[]);
      const drafted = applications.filter((a) => a.status === 'Prepared').length;
      const room = Math.max(0, ctx.policy.maxApplicationsPerPersonPerDay - drafted);
      if (room === 0) {
        result.skipped.push(`${candidate.name}: enough drafts are already waiting for you.`);
        continue;
      }

      const todo = matches
        .filter((m) => !m.dismissed && m.recommendedAction === 'APPLY' && !alreadyHandled.has(m.jobId))
        .sort((a, b) => b.score - a.score)
        .slice(0, room);

      for (const match of todo) {
        try {
          await prepareApplicationForMatch(match.id, { by: 'agent' });
          result.did.push(`${candidate.name}: wrote an application for a ${match.score}% match.`);
        } catch (err) {
          result.errors.push(`${candidate.name}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      if (todo.length === 0) result.skipped.push(`${candidate.name}: no new match recommended for applying.`);
    }

    await logAudit({
      who: 'Writer agent',
      what: 'Wrote application drafts',
      why: `${ctx.trigger} run`,
      outcome: result.errors.length > 0 ? 'error' : 'ok',
      detail: result.did.join(' | ').slice(0, 900),
    });
    return result;
  },
};
