'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function JobSearchPanel({
  candidates,
}: {
  candidates: { id: string; name: string; profession?: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function search(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch('/api/jobs/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateId: String(form.get('candidateId') ?? '') || undefined,
          what: String(form.get('what') ?? '') || undefined,
          where: String(form.get('where') ?? '') || undefined,
          radiusKm: form.get('radiusKm') ? Number(form.get('radiusKm')) : undefined,
          kind: String(form.get('kind') ?? 'job') as 'job' | 'apprenticeship',
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        data?: { jobs: unknown[]; newCount: number; total: number; sourceConnected: boolean; sourceError?: string };
      };
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'The search failed.');
      if (!data.data!.sourceConnected) {
        setError(`SOURCE NOT CONNECTED — ${data.data!.sourceError}`);
      } else {
        setResult(
          `${data.data!.jobs.length} vacancies stored (${data.data!.newCount} new). The source reports ${data.data!.total} in total.`,
        );
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The search failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={search} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-5">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="candidateId">
            For which person
          </label>
          <select className="input" id="candidateId" name="candidateId" defaultValue="">
            <option value="">— free search —</option>
            {candidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name} {candidate.profession ? `(${candidate.profession})` : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="what">
            Occupation
          </label>
          <input className="input" id="what" name="what" placeholder="Elektriker" />
        </div>
        <div>
          <label className="label" htmlFor="where">
            Place (optional)
          </label>
          <input className="input" id="where" name="where" placeholder="Bayern" />
        </div>
        <div>
          <label className="label" htmlFor="kind">
            Type
          </label>
          <select className="input" id="kind" name="kind" defaultValue="job">
            <option value="job">Jobs</option>
            <option value="apprenticeship">Apprenticeships (Ausbildung)</option>
          </select>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button className="btn-primary" type="submit" disabled={busy}>
          {busy ? 'Searching…' : 'Search the Bundesagentur'}
        </button>
        {result && <span className="text-sm text-emerald-700">{result}</span>}
      </div>
      {error && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">{error}</div>
      )}
    </form>
  );
}
