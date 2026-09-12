import type { Policy } from '@/services/policy';

export interface AgentContext {
  policy: Policy;
  now: Date;
  trigger: 'cron' | 'manual';
}

export interface AgentResult {
  agent: string;
  did: string[];
  skipped: string[];
  errors: string[];
}

export interface Agent {
  key: string;
  name: string;
  description: string;
  /** How often it is due, in hours. */
  everyHours: number;
  run(ctx: AgentContext): Promise<AgentResult>;
}

export function emptyResult(agent: string): AgentResult {
  return { agent, did: [], skipped: [], errors: [] };
}
