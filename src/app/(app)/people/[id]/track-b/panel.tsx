'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui';

export function TrackBPanel({
  candidateId,
  defaultOccupation,
  germanTasks,
}: {
  candidateId: string;
  defaultOccupation: string;
  germanTasks: { id: string; title: string; due?: string; detail?: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [gap, setGap] = useState<{ gap: number; note: string; disclaimer: string } | null>(null);

  async function call(action: string, body: Record<string, unknown> = {}) {
    setBusy(action);
    setNote(null);
    try {
      const res = await fetch('/api/track-b', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId, action, ...body }),
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
    <div className="space-y-6">
      <Card title="Find apprenticeship places (Ausbildungsstellen)">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const result = (await call('search-apprenticeships', {
              what: String(form.get('what') ?? ''),
              where: String(form.get('where') ?? '') || undefined,
            })) as { jobs?: unknown[]; newCount?: number; sourceConnected?: boolean; sourceError?: string } | null;
            if (result) {
              setNote(
                result.sourceConnected
                  ? `${result.jobs?.length ?? 0} training places stored (${result.newCount ?? 0} new). They are under Jobs.`
                  : `SOURCE NOT CONNECTED — ${result.sourceError}`,
              );
              router.refresh();
            }
          }}
        >
          <div>
            <label className="label">Field</label>
            <input className="input" name="what" defaultValue={defaultOccupation} placeholder="Ausbildung Koch" />
          </div>
          <div>
            <label className="label">Place (optional)</label>
            <input className="input" name="where" />
          </div>
          <button className="btn-primary" type="submit" disabled={busy !== null}>
            {busy === 'search-apprenticeships' ? 'Searching…' : 'Search'}
          </button>
        </form>
        <p className="mt-2 text-xs text-slate-500">
          Searches the Bundesagentur für Arbeit for training vacancies. Shortage fields to try: Bau, Logistik,
          Gastronomie, Pflegehilfe, Handwerk, Berufskraftfahrer, Lebensmittel.
        </p>
      </Card>

      <Card
        title="German plan to B1"
        action={
          <button className="btn-secondary text-xs" disabled={busy !== null} onClick={async () => {
            const result = await call('german-plan');
            if (result) {
              setNote('The German plan is now in Tasks with target dates.');
              router.refresh();
            }
          }}>
            {busy === 'german-plan' ? 'Creating…' : 'Create the plan'}
          </button>
        }
      >
        {germanTasks.length === 0 ? (
          <p className="text-sm text-slate-500">No plan yet. Press “Create the plan”.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {germanTasks.map((task) => (
              <li key={task.id}>
                <strong>{task.title}</strong> — target {task.due}. <span className="text-slate-500">{task.detail}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Sponsor calculator">
        <p className="text-sm text-slate-600">
          Training pay is often below the amount the embassy requires. Enter both figures — read the required amount on
          the official page, this tool does not state it from memory.
        </p>
        <form
          className="mt-3 flex flex-wrap items-end gap-3"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const result = (await call('sponsor-gap', {
              trainingPay: Number(form.get('trainingPay') ?? 0),
              requiredAmount: Number(form.get('requiredAmount') ?? 0),
            })) as { gap: number; note: string; disclaimer: string } | null;
            if (result) setGap(result);
          }}
        >
          <div>
            <label className="label">Training pay € / month</label>
            <input className="input" name="trainingPay" type="number" min={0} required />
          </div>
          <div>
            <label className="label">Required amount € / month</label>
            <input className="input" name="requiredAmount" type="number" min={0} required />
          </div>
          <button className="btn-primary" type="submit" disabled={busy !== null}>
            Calculate the gap
          </button>
        </form>
        {gap && (
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
            <p className="font-medium">Monthly gap: €{gap.gap.toLocaleString('en-GB')}</p>
            <p className="mt-1">{gap.note}</p>
            <p className="mt-1 text-xs text-slate-500">{gap.disclaimer}</p>
          </div>
        )}
      </Card>

      {note && <p className="text-sm text-slate-600">{note}</p>}
    </div>
  );
}
