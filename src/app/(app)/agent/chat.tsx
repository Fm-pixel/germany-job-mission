'use client';

import Link from 'next/link';
import { useState } from 'react';

interface Turn {
  role: 'user' | 'assistant';
  text: string;
  facts?: string[];
  action?: { kind: string; description: string; target: string; needsConfirmation: boolean };
}

export function AgentChat({ examples }: { examples: string[] }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);

  async function ask(text: string) {
    if (!text.trim()) return;
    setBusy(true);
    const history = turns.map((turn) => ({ role: turn.role, text: turn.text }));
    setTurns((current) => [...current, { role: 'user', text }]);
    setQuestion('');
    try {
      const res = await fetch('/api/agent-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text, history }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        data?: {
          answer: string;
          usedFacts: string[];
          proposedAction: { kind: string; description: string; target: string; needsConfirmation: boolean };
        };
      };
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'No answer.');
      setTurns((current) => [
        ...current,
        {
          role: 'assistant',
          text: data.data!.answer,
          facts: data.data!.usedFacts,
          action: data.data!.proposedAction.kind === 'none' ? undefined : data.data!.proposedAction,
        },
      ]);
    } catch (err) {
      setTurns((current) => [
        ...current,
        { role: 'assistant', text: err instanceof Error ? err.message : 'No answer.' },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {turns.length === 0 && (
        <div className="flex flex-wrap gap-2">
          {examples.map((example) => (
            <button
              key={example}
              className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 hover:bg-slate-200"
              onClick={() => ask(example)}
            >
              {example}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {turns.map((turn, index) => (
          <div
            key={index}
            className={`rounded-lg p-3 text-sm ${
              turn.role === 'user' ? 'bg-accent-50 text-accent-700' : 'border border-slate-200 bg-white'
            }`}
          >
            <p className="prose-plain">{turn.text}</p>
            {turn.facts && turn.facts.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-slate-500">Which facts this used</summary>
                <ul className="mt-1 list-disc pl-5 text-xs text-slate-500">
                  {turn.facts.map((fact, i) => (
                    <li key={i}>{fact}</li>
                  ))}
                </ul>
              </details>
            )}
            {turn.action && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <div className="font-medium">Suggested next step — you decide</div>
                <p>{turn.action.description}</p>
                <div className="mt-2 flex gap-2">
                  {turn.action.target.startsWith('/') ? (
                    <Link href={turn.action.target} className="btn-secondary text-xs">
                      Open the page
                    </Link>
                  ) : (
                    <Link href="/inbox" className="btn-secondary text-xs">
                      Open “Needs you”
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          ask(question);
        }}
      >
        <input
          className="input flex-1"
          value={question}
          placeholder="Ask about your people, applications or next steps…"
          onChange={(e) => setQuestion(e.target.value)}
          disabled={busy}
        />
        <button className="btn-primary" type="submit" disabled={busy}>
          {busy ? 'Thinking…' : 'Ask'}
        </button>
      </form>
    </div>
  );
}
