import { db } from '@/services/db';
import { fitsForCandidate, seedRadar } from '@/services/opportunities';
import { logAudit } from '@/services/tracking/audit';
import { emptyResult, type Agent, type AgentContext, type AgentResult } from './types';

/** Re-checks the official programme pages and raises deadlines as priorities. */
export const radar: Agent = {
  key: 'radar',
  name: 'Radar',
  description: 'Re-checks the official programme pages weekly and raises open calls with their deadline.',
  everyHours: 24 * 7,

  async run(ctx: AgentContext): Promise<AgentResult> {
    const result = emptyResult('Radar');
    try {
      const { stored } = await seedRadar();
      result.did.push(`${stored} programmes re-checked.`);
    } catch (err) {
      result.errors.push(err instanceof Error ? err.message : String(err));
    }

    const [opportunities, candidates] = await Promise.all([
      db.list('opportunities', { limit: 200 }),
      db.list('candidates', { where: [{ field: 'status', op: '==', value: 'active' }] }),
    ]);
    const fitsByCandidate = new Map<string, string[]>();
    for (const candidate of candidates) {
      const fits = await fitsForCandidate(candidate.id);
      for (const fit of fits.filter((f) => f.fits)) {
        const list = fitsByCandidate.get(fit.opportunity.id) ?? [];
        list.push(candidate.name);
        fitsByCandidate.set(fit.opportunity.id, list);
      }
    }

    const today = new Date().toISOString().slice(0, 10);
    for (const opportunity of opportunities) {
      if (!opportunity.nextDeadline || opportunity.nextDeadline < today) continue;
      const names = fitsByCandidate.get(opportunity.id) ?? [];
      const title = `Open call: ${opportunity.name} – deadline ${opportunity.nextDeadline} – fits: ${
        names.length > 0 ? names.join(', ') : 'nobody on file yet'
      }`;
      const existing = await db.first('tasks', { where: [{ field: 'title', op: '==', value: title }] });
      if (existing) continue;
      await db.create('tasks', {
        title,
        detail: `${opportunity.organiser}. Official page: ${opportunity.url}. Checked ${opportunity.checkedAt.slice(0, 10)}.`,
        priority: 'orange',
        owner: 'me',
        due: opportunity.nextDeadline,
        state: 'open',
        source: 'agent',
        link: '/opportunities',
      });
      result.did.push(title);
    }

    await logAudit({
      who: 'Radar agent',
      what: 'Re-checked the Opportunity Radar',
      why: `${ctx.trigger} run`,
      outcome: result.errors.length > 0 ? 'error' : 'ok',
      detail: `${result.did.length} items`,
    });
    return result;
  },
};
