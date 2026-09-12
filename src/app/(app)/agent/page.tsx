import { Card, NotConnected } from '@/components/ui';
import { aiAvailable } from '@/services/ai/client';
import { AgentChat } from './chat';

export const dynamic = 'force-dynamic';

const EXAMPLES = [
  'Find electrician jobs for Jean in Germany',
  'Show me which applications need follow-up',
  'Which people have no applications yet?',
  'Jean got an offer. What should we do next?',
  'Which doors are open for Aline right now?',
];

export default function AgentPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Ask the agent</h1>
        <p className="mt-1 text-sm text-slate-500">
          It reads your data and answers. It never sends anything — anything with a consequence comes back as a
          suggestion you confirm yourself.
        </p>
      </header>

      {!aiAvailable() ? (
        <NotConnected what="The assistant" detail="It needs the Anthropic API key." step="3" />
      ) : (
        <Card>
          <AgentChat examples={EXAMPLES} />
        </Card>
      )}
    </div>
  );
}
