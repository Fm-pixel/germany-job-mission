'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pill } from '@/components/ui';
import { scoreTone } from '@/lib/format';
import type { JobMatch } from '@/services/db/types';

interface Row {
  match: JobMatch;
  job: { id: string; title: string; employer: string; location?: string; url: string; active: boolean } | null;
  alreadyApplied: boolean;
}

export function MatchList({
  candidateId,
  rows,
  aiConnected,
}: {
  candidateId: string;
  rows: Row[];
  aiConnected: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  async function findMatches() {
    setBusy('all');
    setMessage(null);
    try {
      const res = await fetch(`/api/candidates/${candidateId}/matches`, { method: 'POST' });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Matching failed.');
      setMessage('Matches recalculated.');
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Matching failed.');
    } finally {
      setBusy(null);
    }
  }

  async function prepare(matchId: string) {
    setBusy(matchId);
    setMessage(null);
    try {
      const res = await fetch('/api/applications/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Could not write the application.');
      setMessage('Draft written — it is now in the review queue under Applications.');
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not write the application.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button className="btn-primary" onClick={findMatches} disabled={busy !== null}>
          {busy === 'all' ? 'Working…' : 'Find matches'}
        </button>
        <span className="text-xs text-slate-500">
          Scores every stored vacancy for this person{aiConnected ? ' and explains the strongest ten.' : '.'}
        </span>
      </div>
      {message && <p className="text-sm text-slate-600">{message}</p>}

      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">
          No matches yet. Search for vacancies first, then press “Find matches”.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map(({ match, job, alreadyApplied }) => (
            <li key={match.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900">{job?.title ?? 'Vacancy removed'}</div>
                  <div className="text-sm text-slate-500">
                    {job?.employer} · {job?.location ?? 'location per advert'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Pill tone={scoreTone(match.score)}>{match.score}% match</Pill>
                  <Pill tone={match.recommendedAction === 'APPLY' ? 'green' : match.recommendedAction === 'SKIP' ? 'red' : 'yellow'}>
                    {match.recommendedAction}
                  </Pill>
                </div>
              </div>

              <p className="mt-2 text-sm text-slate-600">{match.actionReason}</p>

              <ul className="mt-3 space-y-1 text-sm">
                {match.explanation.map((item, index) => (
                  <li key={index} className={item.kind === 'positive' ? 'text-emerald-700' : 'text-amber-700'}>
                    {item.kind === 'positive' ? '✓' : '⚠'} {item.text}
                  </li>
                ))}
              </ul>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {job && (
                  <a href={job.url} target="_blank" rel="noreferrer" className="btn-secondary text-xs">
                    Original advert
                  </a>
                )}
                <button
                  className="btn-secondary text-xs"
                  onClick={() => setOpen(open === match.id ? null : match.id)}
                >
                  {open === match.id ? 'Hide the score' : 'How the score was built'}
                </button>
                {alreadyApplied ? (
                  <span className="text-xs text-slate-500">An application already exists for this vacancy.</span>
                ) : (
                  <button className="btn-primary text-xs" onClick={() => prepare(match.id)} disabled={busy !== null}>
                    {busy === match.id ? 'Writing…' : 'Write the application'}
                  </button>
                )}
                {!match.aiExplained && (
                  <span className="text-xs text-slate-400">rule-based explanation only</span>
                )}
              </div>

              {open === match.id && (
                <table className="mt-3 w-full text-xs">
                  <tbody className="divide-y divide-slate-100">
                    {match.breakdown.map((item) => (
                      <tr key={item.factor}>
                        <td className="py-1 font-medium text-slate-700">{item.factor}</td>
                        <td className="py-1 text-slate-500">
                          {item.points}/{item.max}
                        </td>
                        <td className="py-1 text-slate-500">{item.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
