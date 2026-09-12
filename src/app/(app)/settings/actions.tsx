'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function SettingsActions() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<{ level: string; text: string }[]>([]);

  async function post(url: string, body: unknown, key: string) {
    setBusy(key);
    setNote(null);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { ok: boolean; error?: string; data?: unknown };
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'That did not work.');
      return data.data;
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'That did not work.');
      return null;
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <button
        className="btn-secondary text-xs"
        disabled={busy !== null}
        onClick={async () => {
          const result = (await post('/api/settings', { action: 'test-drive' }, 'drive')) as
            | { ok: boolean; message: string; warnings?: { level: string; text: string }[] }
            | null;
          if (result) {
            setNote(result.message);
            setWarnings(result.warnings ?? []);
          }
        }}
      >
        {busy === 'drive' ? 'Testing…' : 'Test the Drive connection'}
      </button>
      <button
        className="btn-secondary text-xs"
        disabled={busy !== null}
        onClick={async () => {
          const result = await post('/api/settings', {}, 'rules');
          if (result) {
            setNote('rules.md was read again.');
            router.refresh();
          }
        }}
      >
        {busy === 'rules' ? 'Reading…' : 'Re-read rules.md'}
      </button>
      <button
        className="btn-secondary text-xs"
        disabled={busy !== null}
        onClick={async () => {
          const result = (await post('/api/agents/run', { force: true }, 'agents')) as
            | { ran: { agent: string; did: string[]; skipped: string[]; errors: string[] }[] }
            | null;
          if (result) {
            const did = result.ran.reduce((sum, r) => sum + r.did.length, 0);
            const errors = result.ran.reduce((sum, r) => sum + r.errors.length, 0);
            setNote(`Agents finished: ${did} actions, ${errors} errors. The audit log below has the detail.`);
            router.refresh();
          }
        }}
      >
        {busy === 'agents' ? 'Running the agents…' : 'Run all agents now'}
      </button>
      {note && <span className="text-xs text-slate-600">{note}</span>}
      {warnings.length > 0 && (
        <ul className="mt-2 w-full space-y-2">
          {warnings.map((warning, index) => (
            <li
              key={index}
              className={`rounded-lg border px-3 py-2 text-sm ${
                warning.level === 'danger'
                  ? 'border-red-300 bg-red-50 text-red-800'
                  : 'border-amber-300 bg-amber-50 text-amber-900'
              }`}
            >
              {warning.level === 'danger' ? '⚠ ' : ''}
              {warning.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
