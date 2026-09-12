import { db } from '@/services/db';
import { checkJobStillActive, queryForCandidate, searchAndStore } from '@/services/jobs';
import { logAudit } from '@/services/tracking/audit';
import { emptyResult, type Agent, type AgentContext, type AgentResult } from './types';

/** Finds new vacancies for every active person and re-checks old links. */
export const scout: Agent = {
  key: 'scout',
  name: 'Scout',
  description: 'Searches the job sources for every active person and checks whether stored vacancies are still live.',
  everyHours: 12,

  async run(ctx: AgentContext): Promise<AgentResult> {
    const result = emptyResult('Scout');
    const candidates = await db.list('candidates', { where: [{ field: 'status', op: '==', value: 'active' }] });

    for (const candidate of candidates) {
      const query = queryForCandidate(candidate);
      if (!query.what?.trim()) {
        result.skipped.push(`${candidate.name}: no occupation stored, so there is nothing to search for.`);
        continue;
      }
      try {
        const search = await searchAndStore(query, 'bundesagentur', { withDetail: 5 });
        if (!search.sourceConnected) {
          result.errors.push(`Job source not connected: ${search.sourceError}`);
          break;
        }
        result.did.push(`${candidate.name}: ${search.newCount} new vacancies (${search.jobs.length} seen).`);
      } catch (err) {
        result.errors.push(`${candidate.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Re-check the oldest stored vacancies so dead links do not linger.
    const stale = (await db.list('jobs', { where: [{ field: 'active', op: '==', value: true }], limit: 200 }))
      .sort((a, b) => (a.checkedAt > b.checkedAt ? 1 : -1))
      .slice(0, 10);
    for (const job of stale) {
      try {
        const checked = await checkJobStillActive(job);
        if (!checked.active) result.did.push(`"${job.title}" at ${job.employer} is no longer live.`);
      } catch {
        result.skipped.push(`Could not re-check "${job.title}".`);
      }
    }

    await logAudit({
      who: 'Scout agent',
      what: 'Searched for new vacancies and re-checked stored ones',
      why: `${ctx.trigger} run`,
      outcome: result.errors.length > 0 ? 'error' : 'ok',
      detail: [...result.did, ...result.errors].join(' | ').slice(0, 900),
    });
    return result;
  },
};
