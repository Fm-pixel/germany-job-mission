import { guard } from '@/lib/api';
import { aiAvailable } from '@/services/ai/client';
import { askAgent } from '@/services/ai/agent-chat';
import { logAudit } from '@/services/tracking/audit';

export async function POST(request: Request) {
  return guard(async () => {
    const { question, history } = (await request.json()) as {
      question?: string;
      history?: { role: 'user' | 'assistant'; text: string }[];
    };
    if (!question?.trim()) throw new Error('Ask something first.');
    if (!aiAvailable()) {
      throw Object.assign(new Error('The assistant needs the Anthropic API (NOT CONNECTED — SETUP_FOR_ME.md step 3).'), {
        code: 'AI_NOT_CONNECTED',
      });
    }
    const answer = await askAgent(question, history ?? []);
    await logAudit({
      who: 'me',
      what: 'Asked the assistant a question',
      why: question.slice(0, 160),
      detail: answer.proposedAction.kind !== 'none' ? `Proposed: ${answer.proposedAction.description}` : undefined,
    });
    return answer;
  });
}
