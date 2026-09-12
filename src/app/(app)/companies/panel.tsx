'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function CompanyPanel({
  candidates,
  suggestions,
  aiConnected,
}: {
  candidates: { id: string; name: string; profession?: string }[];
  suggestions: string[];
  aiConnected: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [industry, setIndustry] = useState(suggestions[0] ?? '');

  async function discover(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch('/api/companies/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateId: String(form.get('candidateId') ?? '') || undefined,
          profession: String(form.get('profession') ?? ''),
          industry,
          region: String(form.get('region') ?? ''),
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        data?: { companies: unknown[]; sources: { url: string }[] };
      };
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'The search failed.');
      setNote(`${data.data!.companies.length} companies stored from ${data.data!.sources.length} pages read.`);
      router.refresh();
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'The search failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={discover} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-4">
        <div>
          <label className="label" htmlFor="candidateId">
            For whom
          </label>
          <select
            className="input"
            id="candidateId"
            name="candidateId"
            onChange={(e) => {
              const candidate = candidates.find((c) => c.id === e.target.value);
              const input = document.getElementById('profession') as HTMLInputElement | null;
              if (input && candidate?.profession) input.value = candidate.profession;
            }}
          >
            <option value="">—</option>
            {candidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="profession">
            Occupation
          </label>
          <input className="input" id="profession" name="profession" required placeholder="Elektriker" />
        </div>
        <div>
          <label className="label" htmlFor="industry">
            Category
          </label>
          <input className="input" id="industry" value={industry} onChange={(e) => setIndustry(e.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor="region">
            Region
          </label>
          <input className="input" id="region" name="region" required placeholder="Bayern" />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 hover:bg-slate-200"
            onClick={() => setIndustry(suggestion)}
          >
            {suggestion}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button className="btn-primary" type="submit" disabled={busy || !aiConnected}>
          {busy ? 'Researching…' : 'Search this category'}
        </button>
        {note && <span className="text-sm text-slate-600">{note}</span>}
      </div>
      <p className="text-xs text-slate-500">
        Contact addresses are only stored when they are published on the company&apos;s own website, and the page they
        came from is stored with them.
      </p>
    </form>
  );
}
