import { guard } from '@/lib/api';
import { runDueAgents } from '@/agents';

/** Lets me run the agents by hand from the Settings page. */
export async function POST(request: Request) {
  return guard(async () => {
    const body = (await request.json().catch(() => ({}))) as { only?: string[]; force?: boolean };
    return runDueAgents({ trigger: 'manual', only: body.only, force: body.force ?? true });
  });
}
