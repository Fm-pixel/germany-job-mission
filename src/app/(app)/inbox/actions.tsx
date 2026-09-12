'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export function InboxActions({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function act(path: string) {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string; data?: { sent?: boolean; reason?: string } };
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'That did not work.');
      setNote(data.data?.sent ? 'Sent.' : (data.data?.reason ?? 'Done.'));
      router.refresh();
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'That did not work.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button className="btn-primary text-xs" disabled={busy} onClick={() => act('/api/applications/approve')}>
        Approve
      </button>
      <Link href="/applications/review" className="btn-secondary text-xs">
        Edit
      </Link>
      <button className="btn-danger text-xs" disabled={busy} onClick={() => act('/api/applications/skip')}>
        Skip
      </button>
      {note && <span className="text-xs text-slate-600">{note}</span>}
    </div>
  );
}
