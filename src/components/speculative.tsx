'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function SpeculativeApplication({
  companies,
  candidates,
}: {
  companies: { id: string; name: string; isAgency?: boolean }[];
  candidates: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setBusy(true);
        setNote(null);
        try {
          const res = await fetch('/api/companies/speculative', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              candidateId: String(form.get('candidateId') ?? ''),
              companyId: String(form.get('companyId') ?? ''),
            }),
          });
          const data = (await res.json()) as { ok: boolean; error?: string };
          if (!res.ok || !data.ok) throw new Error(data.error ?? 'Could not write it.');
          setNote('Written. It is in the review queue under Applications — nothing has been sent.');
          router.refresh();
        } catch (err) {
          setNote(err instanceof Error ? err.message : 'Could not write it.');
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="min-w-[180px]">
        <label className="label">Person</label>
        <select className="input" name="candidateId" required>
          {candidates.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.name}
            </option>
          ))}
        </select>
      </div>
      <div className="min-w-[220px]">
        <label className="label">Company</label>
        <select className="input" name="companyId" required>
          {companies
            .filter((company) => !company.isAgency)
            .map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
        </select>
      </div>
      <button className="btn-primary" type="submit" disabled={busy || companies.length === 0 || candidates.length === 0}>
        {busy ? 'Writing…' : 'Write a speculative application'}
      </button>
      {note && <span className="text-sm text-slate-600">{note}</span>}
    </form>
  );
}
