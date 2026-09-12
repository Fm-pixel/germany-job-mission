import { db } from '@/services/db';
import { getPolicy } from '@/services/policy';
import { logAudit } from '@/services/tracking/audit';
import { syncTasks } from '@/services/tracking';
import { scout } from './scout';
import { matcher } from './matcher';
import { writer } from './writer';
import { sender } from './sender';
import { chaser } from './chaser';
import { reader } from './reader';
import { radar } from './radar';
import { immigrationAgent } from './immigration-agent';
import { coach } from './coach';
import type { Agent, AgentResult } from './types';

export * from './types';
export { mayAutoSend } from './safety';

export const AGENTS: Agent[] = [
  scout,
  matcher,
  writer,
  sender,
  chaser,
  reader,
  radar,
  immigrationAgent,
  coach,
];

export function agentByKey(key: string): Agent | undefined {
  return AGENTS.find((agent) => agent.key === key);
}

/** An agent is due when it has not run successfully inside its own interval. */
export async function isDue(agent: Agent, now: Date): Promise<boolean> {
  const logs = await db.list('audit_logs', {
    where: [{ field: 'who', op: '==', value: `${agent.name} agent` }],
  });
  const last = logs
    .filter((log) => log.outcome !== 'error')
    .map((log) => log.at)
    .sort()
    .pop();
  if (!last) return true;
  return now.getTime() - new Date(last).getTime() >= agent.everyHours * 3600_000;
}

export interface RunSummary {
  startedAt: string;
  finishedAt: string;
  trigger: 'cron' | 'manual';
  ran: AgentResult[];
  notDue: string[];
}

export async function runDueAgents(options: {
  trigger: 'cron' | 'manual';
  only?: string[];
  force?: boolean;
}): Promise<RunSummary> {
  const startedAt = new Date().toISOString();
  const now = new Date();
  const policy = await getPolicy();
  const ran: AgentResult[] = [];
  const notDue: string[] = [];

  for (const agent of AGENTS) {
    if (options.only && !options.only.includes(agent.key)) continue;
    if (!options.force && !(await isDue(agent, now))) {
      notDue.push(agent.name);
      continue;
    }
    try {
      ran.push(await agent.run({ policy, now, trigger: options.trigger }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      ran.push({ agent: agent.name, did: [], skipped: [], errors: [message] });
      await logAudit({
        who: `${agent.name} agent`,
        what: 'Run failed',
        why: `${options.trigger} run`,
        outcome: 'error',
        detail: message,
      });
    }
  }

  await syncTasks(policy.followUpDays);

  return { startedAt, finishedAt: new Date().toISOString(), trigger: options.trigger, ran, notDue };
}
