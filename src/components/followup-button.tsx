'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function FollowUpButton({ applicationId, count }: { applicationId: string; count: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <button
        className="btn-secondary w-full text-xs"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setNote(null);
          try {
            const res = await fetch('/api/applications/follow-up', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ applicationId }),
            });
            const data = (await res.json()) as { ok: boolean; error?: string };
            if (!res.ok || !data.ok) throw new Error(data.error ?? 'Could not write the follow-up.');
            setNote('Written — it is in the review queue. Nothing has been sent.');
            router.refresh();
          } catch (err) {
            setNote(err instanceof Error ? err.message : 'Could not write the follow-up.');
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Writing…' : count > 0 ? 'Write another follow-up' : 'Write a follow-up'}
      </button>
      {note && <p className="text-xs text-slate-600">{note}</p>}
    </div>
  );
}
