'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function RadarPanel({ count, seedCount }: { count: number; seedCount: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        className="btn-primary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setNote(null);
          try {
            const res = await fetch('/api/opportunities', { method: 'POST' });
            const data = (await res.json()) as {
              ok: boolean;
              error?: string;
              data?: { stored: number; withDeadline: number };
            };
            if (!res.ok || !data.ok) throw new Error(data.error ?? 'The refresh failed.');
            setNote(`${data.data!.stored} programmes checked, ${data.data!.withDeadline} with a deadline on file.`);
            router.refresh();
          } catch (err) {
            setNote(err instanceof Error ? err.message : 'The refresh failed.');
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Reading the official pages…' : 'Re-check every programme'}
      </button>
      <span className="text-sm text-slate-500">
        {count} of {seedCount} programmes stored.
      </span>
      {note && <span className="text-sm text-slate-600">{note}</span>}
    </div>
  );
}
