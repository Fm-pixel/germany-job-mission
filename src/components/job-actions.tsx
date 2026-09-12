'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function JobActions({ jobId, active }: { jobId: string; active: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function call(url: string, key: string, describe: (data: { active?: boolean }) => string) {
    setBusy(key);
    setNote(null);
    try {
      const res = await fetch(url, { method: 'POST' });
      const data = (await res.json()) as { ok: boolean; error?: string; data?: { active?: boolean } };
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'That did not work.');
      setNote(describe(data.data ?? {}));
      router.refresh();
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'That did not work.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        className="btn-secondary text-xs"
        disabled={busy !== null}
        onClick={() =>
          call(`/api/jobs/${jobId}/check`, 'check', (data) =>
            data.active
              ? 'The source still has this vacancy — checked just now.'
              : 'The source no longer has this vacancy. It is marked as not active.',
          )
        }
      >
        {busy === 'check' ? 'Checking…' : 'Check if still active'}
      </button>
      <button
        className="btn-secondary text-xs"
        disabled={busy !== null}
        onClick={() => call(`/api/jobs/${jobId}/check?detail=1`, 'detail', () => 'The full advert text was fetched.')}
      >
        {busy === 'detail' ? 'Fetching…' : 'Fetch the full advert text'}
      </button>
      {!active && <span className="text-xs text-red-600">This vacancy is marked as not active.</span>}
      {note && <span className="text-xs text-slate-600">{note}</span>}
    </div>
  );
}
