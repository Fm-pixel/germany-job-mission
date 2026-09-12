import { z } from 'zod';
import { db } from '../db';
import { askJson } from './client';
import { computePriorities } from '../tracking';
import { getPolicy } from '../policy';

/**
 * The "Germany Job Agent" (SPEC section 19).
 * It reads my data and answers. Anything with a consequence (sending, deleting,
 * spending) is returned as a proposed action that I must confirm — the chat
 * itself never performs one.
 */

export const AgentAnswerSchema = z.object({
  answer: z.string().describe('The answer in plain language, for a non-technical reader.'),
  proposedAction: z
    .object({
      kind: z.enum([
        'none',
        'search-jobs',
        'find-matches',
        'write-applications',
        'send-application',
        'prepare-follow-up',
        'open-page',
      ]),
      description: z.string(),
      candidateId: z.string(),
      target: z.string().describe('An id or a page path, or "".'),
      needsConfirmation: z.boolean(),
    })
    .describe('kind "none" when the question only needed an answer.'),
  usedFacts: z.array(z.string()).describe('The facts from the data you used, so I can check them.'),
});

export type AgentAnswer = z.infer<typeof AgentAnswerSchema>;

const SYSTEM = `You are the assistant inside a private tool that helps specific people find a real job in Germany.

- Answer only from the data given to you below. If the data does not contain the answer, say so plainly.
- Never invent a person, an employer, a vacancy, a number or a date.
- You never send anything and never change anything. If the request would have a consequence (sending an email, applying, deleting), describe it as a proposed action with needsConfirmation = true and let the owner press the button.
- Be short, concrete and honest. Never promise a job or a visa.`;

export async function buildDataContext(): Promise<string> {
  const [candidates, applications, jobs, matches, tasks, opportunities, policy] = await Promise.all([
    db.list('candidates'),
    db.list('applications', { limit: 300 }),
    db.list('jobs', { limit: 200 }),
    db.list('job_matches', { limit: 300 }),
    db.list('tasks', { limit: 200 }),
    db.list('opportunities', { limit: 100 }),
    getPolicy(),
  ]);
  const priorities = await computePriorities(policy.followUpDays);
  const jobById = new Map(jobs.map((job) => [job.id, job]));

  const lines: string[] = ['PEOPLE'];
  for (const candidate of candidates) {
    const theirs = applications.filter((a) => a.candidateId === candidate.id);
    const best = matches
      .filter((m) => m.candidateId === candidate.id)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    lines.push(
      `- ${candidate.name} (id ${candidate.id}), ${candidate.profession ?? 'profession unknown'}, ${candidate.country}, track ${candidate.track}, status ${candidate.status}. Applications: ${theirs.length}, sent ${theirs.filter((a) => a.appliedAt).length}, replies ${theirs.filter((a) => a.replyAt).length}.`,
    );
    for (const match of best) {
      const job = jobById.get(match.jobId);
      lines.push(`    match ${match.score}% — ${job?.title ?? '?'} at ${job?.employer ?? '?'} (${match.recommendedAction})`);
    }
    for (const application of theirs.slice(0, 8)) {
      const job = application.jobId ? jobById.get(application.jobId) : undefined;
      lines.push(
        `    application ${application.id}: ${job?.employer ?? 'speculative'} — status ${application.status}${application.appliedAt ? `, sent ${application.appliedAt.slice(0, 10)}` : ''}`,
      );
    }
  }

  lines.push('', 'TODAY’S PRIORITIES');
  for (const item of priorities.slice(0, 15)) lines.push(`- [${item.priority}] ${item.title}: ${item.detail}`);

  lines.push('', 'OPEN TASKS');
  for (const task of tasks.filter((t) => t.state === 'open').slice(0, 20)) {
    lines.push(`- ${task.title}${task.due ? ` (due ${task.due})` : ''}`);
  }

  lines.push('', 'OPPORTUNITY RADAR');
  for (const opportunity of opportunities.slice(0, 20)) {
    lines.push(
      `- ${opportunity.name} (${opportunity.type}, ${opportunity.status}${opportunity.nextDeadline ? `, deadline ${opportunity.nextDeadline}` : ''}) — ${opportunity.url}`,
    );
  }

  lines.push('', 'MY RULES AS THE AGENTS APPLY THEM');
  for (const line of policy.interpretation) lines.push(`- ${line}`);

  return lines.join('\n');
}

export async function askAgent(question: string, history: { role: 'user' | 'assistant'; text: string }[] = []) {
  const context = await buildDataContext();
  const conversation = history
    .slice(-6)
    .map((turn) => `${turn.role === 'user' ? 'Owner' : 'Assistant'}: ${turn.text}`)
    .join('\n');

  return askJson(
    AgentAnswerSchema,
    `MY DATA
"""
${context}
"""

${conversation ? `EARLIER IN THIS CONVERSATION\n${conversation}\n` : ''}
QUESTION: ${question}`,
    { system: SYSTEM, maxTokens: 4000 },
  );
}
