import { db } from '@/services/db';
import { dueFollowUps, prepareFollowUp } from '@/services/applications/followup';
import { aiAvailable } from '@/services/ai/client';
import { emailConnected, sendEmail } from '@/services/email';
import { logAudit } from '@/services/tracking/audit';
import { emptyResult, type Agent, type AgentContext, type AgentResult } from './types';

/** Chases employers (through a draft I approve) and reminds the candidate. */
export const chaser: Agent = {
  key: 'chaser',
  name: 'Chaser',
  description: 'Prepares follow-ups for silent employers and reminds the person about their own overdue to-dos.',
  everyHours: 24,

  async run(ctx: AgentContext): Promise<AgentResult> {
    const result = emptyResult('Chaser');
    const due = await dueFollowUps(ctx.policy.followUpDays, ctx.policy.maxFollowUps);

    for (const entry of due) {
      if (!aiAvailable()) {
        result.skipped.push(
          `${entry.candidateName}: a follow-up to ${entry.employer} is due after ${entry.days} days, but writing needs the Anthropic API.`,
        );
        continue;
      }
      try {
        await prepareFollowUp(entry.application.id, { by: 'agent' });
        result.did.push(`Prepared a follow-up to ${entry.employer} for ${entry.candidateName} (${entry.days} days).`);
      } catch (err) {
        result.errors.push(err instanceof Error ? err.message : String(err));
      }
    }

    // Overdue to-dos that belong to the person themselves.
    const tasks = await db.list('tasks', { where: [{ field: 'state', op: '==', value: 'open' }] });
    const today = new Date().toISOString().slice(0, 10);
    const remindedToday = new Set<string>();
    for (const task of tasks) {
      if (task.owner !== 'candidate' || !task.due || task.due >= today) continue;
      const candidate = task.candidateId ? await db.get('candidates', task.candidateId) : null;
      if (!candidate) continue;
      result.did.push(`${candidate.name} has an overdue to-do: ${task.title}.`);
      if (task.priority !== 'red') await db.update('tasks', task.id, { priority: 'red' });

      // One reminder per person per run — the agent runs daily, so at most one a day.
      if (remindedToday.has(candidate.id)) continue;
      remindedToday.add(candidate.id);
      if (!candidate.email) {
        result.skipped.push(`${candidate.name} has no email address, so they cannot be reminded.`);
        continue;
      }
      if (!emailConnected()) {
        result.skipped.push(`No email provider is connected, so ${candidate.name} was not reminded.`);
        continue;
      }
      const theirTasks = tasks.filter(
        (t) => t.candidateId === candidate.id && t.owner === 'candidate' && t.state === 'open',
      );
      const portal = candidate.portalToken
        ? `${(process.env.APP_URL ?? '').replace(/\/$/, '')}/portal/${candidate.portalToken}`
        : null;
      try {
        await sendEmail(
          {
            to: candidate.email,
            subject: 'A reminder about your Germany plan',
            body: [
              `Hello ${candidate.name},`,
              '',
              'These things are waiting for you:',
              ...theirTasks.map((t) => `  · ${t.title}${t.due ? ` (was due ${t.due})` : ''}`),
              '',
              portal ? `Your page: ${portal}` : 'Ask for your private page link if you need it.',
              '',
              'Nobody can promise you a job or a visa. Never pay anyone for either, and never send your passport to somebody you cannot verify.',
            ].join('\n'),
          },
          { candidateId: candidate.id },
        );
        result.did.push(`Reminded ${candidate.name} about ${theirTasks.length} overdue to-do(s).`);
      } catch (err) {
        result.errors.push(`Could not remind ${candidate.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    await logAudit({
      who: 'Chaser agent',
      what: 'Checked follow-ups and overdue to-dos',
      why: `${ctx.trigger} run`,
      outcome: result.errors.length > 0 ? 'error' : 'ok',
      detail: `${result.did.length} actions, ${result.skipped.length} skipped`,
    });
    return result;
  },
};
