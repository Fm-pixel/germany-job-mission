'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function DeletePerson({ candidateId, name }: { candidateId: string; name: string }) {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-700">
        This removes {name} completely: profile, education, qualifications, work history, languages,
        matches, applications, messages, emails, interviews, assessments, checklists, tasks and notes — and it
        deletes their files from your Drive folder. It cannot be undone. Do this as soon as they ask you to.
      </p>
      <label className="label" htmlFor="confirm-delete">
        Type the person&apos;s name to confirm
      </label>
      <input
        className="input max-w-sm"
        id="confirm-delete"
        value={confirmation}
        placeholder={name}
        onChange={(e) => setConfirmation(e.target.value)}
      />
      <button
        className="btn-danger"
        disabled={busy || confirmation.trim() !== name}
        onClick={async () => {
          if (!window.confirm(`Delete ${name} and every file? This cannot be undone.`)) return;
          setBusy(true);
          setNote(null);
          try {
            const res = await fetch(`/api/candidates/${candidateId}`, { method: 'DELETE' });
            const data = (await res.json()) as { ok: boolean; error?: string; data?: { deleted: number } };
            if (!res.ok || !data.ok) throw new Error(data.error ?? 'Could not delete.');
            router.push('/people');
            router.refresh();
          } catch (err) {
            setNote(err instanceof Error ? err.message : 'Could not delete.');
            setBusy(false);
          }
        }}
      >
        {busy ? 'Deleting…' : `Delete ${name} and all their data`}
      </button>
      {note && <p className="text-sm text-red-600">{note}</p>}
    </div>
  );
}
