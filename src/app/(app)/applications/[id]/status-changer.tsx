'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function StatusChanger({
  applicationId,
  current,
  statuses,
}: {
  applicationId: string;
  current: string;
  statuses: readonly string[];
}) {
  const router = useRouter();
  const [status, setStatus] = useState(current);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    await fetch(`/api/applications/${applicationId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, note: note || undefined }),
    });
    setBusy(false);
    setNote('');
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <label className="label">Change status</label>
      <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
        {statuses.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <input className="input" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      <button className="btn-primary w-full text-xs" onClick={save} disabled={busy || status === current}>
        Save status
      </button>
    </div>
  );
}
