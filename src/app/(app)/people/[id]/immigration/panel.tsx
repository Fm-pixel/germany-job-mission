'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Pill } from '@/components/ui';

interface Evaluation {
  key: string;
  name: string;
  lawRef: string;
  verdict: 'BEST OPTION' | 'POSSIBLE' | 'NOT CURRENTLY RECOMMENDED';
  score: number;
  reasoning: { text: string; kind: 'positive' | 'warning' | 'blocking'; label: string }[];
  documents: string[];
  nextSteps: string[];
  requirements: { text: string; label: string; sourceUrl: string; checkedAt?: string }[];
  sourceUrl: string;
  lawUrl: string;
}

interface FastestPath {
  ranked: {
    name: string;
    key: string;
    lawRef: string;
    verdict: string;
    reason: string;
    nextAction: string;
    sourceUrl: string;
    speed: string;
  }[];
  honestNotes: string[];
  disclaimer: string;
}

interface Chancenkarte {
  criteriaLoaded: boolean;
  sourceUrl: string;
  checkedAt?: string;
  baseRequirements: { text: string; met: string; note: string }[];
  points?: { criterion: string; points: number; met: boolean; note: string }[];
  pointsTotal?: number;
  pointsNeeded?: number;
  result: string;
  disclaimer: string;
}

interface Recognition {
  regulated: string;
  regulatedNote: string;
  likelyAuthority: string;
  documents: string[];
  procedure: string;
  quotes: string[];
  sourceUrl: string;
  checkedAt: string;
  disclaimer: string;
}

interface ChecklistRow {
  id: string;
  title: string;
  status: string;
  owner: string;
  deadline?: string;
  label: string;
  sourceUrl?: string;
  pathwayKey: string;
}

function LabelPill({ label }: { label: string }) {
  return (
    <Pill tone={label === 'CONFIRMED' ? 'green' : label === 'USER-SPECIFIC' ? 'blue' : 'yellow'}>{label}</Pill>
  );
}

export function ImmigrationPanel({
  candidateId,
  country,
  profession,
  qualificationTitle,
  checklist,
}: {
  candidateId: string;
  candidateName: string;
  country: string;
  profession: string;
  qualificationTitle: string;
  checklist: ChecklistRow[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [evaluations, setEvaluations] = useState<Evaluation[] | null>(null);
  const [fastest, setFastest] = useState<FastestPath | null>(null);
  const [chancenkarte, setChancenkarte] = useState<Chancenkarte | null>(null);
  const [recognition, setRecognition] = useState<Recognition | null>(null);
  const [recheckNote, setRecheckNote] = useState<string | null>(null);

  async function call<T>(url: string, body: unknown, key: string): Promise<T | null> {
    setBusy(key);
    setError(null);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { ok: boolean; error?: string; data?: T };
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'That did not work.');
      return data.data ?? null;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work.');
      return null;
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">{error}</div>
      )}

      <Card title="Find the fastest realistic path">
        <div className="flex flex-wrap gap-2">
          <button
            className="btn-primary"
            disabled={busy !== null}
            onClick={async () => {
              const result = await call<FastestPath>('/api/immigration/fastest-path', { candidateId }, 'fastest');
              if (result) setFastest(result);
            }}
          >
            {busy === 'fastest' ? 'Working…' : 'FIND MY FASTEST REALISTIC PATH TO GERMANY'}
          </button>
          <button
            className="btn-secondary"
            disabled={busy !== null}
            onClick={async () => {
              const result = await call<Evaluation[]>('/api/immigration/assess', { candidateId }, 'assess');
              if (result) setEvaluations(result);
            }}
          >
            {busy === 'assess' ? 'Working…' : 'Assess every pathway'}
          </button>
          <button
            className="btn-secondary"
            disabled={busy !== null}
            onClick={async () => {
              const result = await call<{ confirmed: number; outcomes: unknown[]; changedPages: string[] }>(
                '/api/immigration/recheck',
                {},
                'recheck',
              );
              if (result) {
                setRecheckNote(
                  `${result.confirmed} of ${result.outcomes.length} requirements were confirmed against the official pages. ${
                    result.changedPages.length > 0
                      ? `These pages changed since the last check: ${result.changedPages.join(', ')}`
                      : 'No page changed since the last check.'
                  }`,
                );
                router.refresh();
              }
            }}
          >
            {busy === 'recheck' ? 'Reading the official pages…' : 'Re-check sources'}
          </button>
        </div>
        {recheckNote && <p className="mt-3 text-sm text-slate-600">{recheckNote}</p>}

        {fastest && (
          <div className="mt-4 space-y-3">
            <ol className="space-y-2">
              {fastest.ranked.map((row, index) => (
                <li key={row.key} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-900">
                      {index + 1}. {row.name}{' '}
                      <span className="font-normal text-slate-500">({row.lawRef})</span>
                    </span>
                    <Pill
                      tone={
                        row.verdict === 'BEST OPTION'
                          ? 'green'
                          : row.verdict === 'POSSIBLE'
                            ? 'yellow'
                            : 'red'
                      }
                    >
                      {row.verdict}
                    </Pill>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{row.reason}</p>
                  <p className="mt-1 text-sm text-slate-900">Next action: {row.nextAction}</p>
                  <a href={row.sourceUrl} target="_blank" rel="noreferrer" className="text-xs text-accent-600 underline">
                    Official source
                  </a>
                </li>
              ))}
            </ol>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <ul className="list-disc space-y-1 pl-5">
                {fastest.honestNotes.map((note, index) => (
                  <li key={index}>{note}</li>
                ))}
              </ul>
            </div>
            <p className="text-xs text-slate-500">{fastest.disclaimer}</p>
          </div>
        )}
      </Card>

      {evaluations && (
        <Card title="Pathways in detail">
          <div className="space-y-4">
            {evaluations.map((evaluation) => (
              <details key={evaluation.key} className="rounded-lg border border-slate-200 p-3" open={evaluation.verdict === 'BEST OPTION'}>
                <summary className="cursor-pointer text-sm font-semibold text-slate-900">
                  {evaluation.name} ({evaluation.lawRef}) — {evaluation.verdict}
                </summary>
                <ul className="mt-3 space-y-1 text-sm">
                  {evaluation.reasoning.map((item, index) => (
                    <li
                      key={index}
                      className={
                        item.kind === 'positive'
                          ? 'text-emerald-700'
                          : item.kind === 'blocking'
                            ? 'text-red-700'
                            : 'text-amber-700'
                      }
                    >
                      {item.kind === 'positive' ? '✓' : item.kind === 'blocking' ? '✕' : '⚠'} {item.text}{' '}
                      <LabelPill label={item.label} />
                    </li>
                  ))}
                </ul>

                <div className="mt-3">
                  <div className="section-title">Requirements</div>
                  <ul className="mt-1 space-y-1 text-sm text-slate-700">
                    {evaluation.requirements.map((req, index) => (
                      <li key={index}>
                        {req.text} <LabelPill label={req.label} />{' '}
                        <a href={req.sourceUrl} target="_blank" rel="noreferrer" className="text-xs text-accent-600 underline">
                          source
                        </a>
                        {req.checkedAt && (
                          <span className="text-xs text-slate-400"> · checked {req.checkedAt.slice(0, 10)}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <div className="section-title">Documents required</div>
                    <ul className="mt-1 list-disc pl-5 text-sm text-slate-700">
                      {evaluation.documents.map((doc) => (
                        <li key={doc}>{doc}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="section-title">Next steps</div>
                    <ul className="mt-1 list-disc pl-5 text-sm text-slate-700">
                      {evaluation.nextSteps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  <button
                    className="btn-secondary text-xs"
                    disabled={busy !== null}
                    onClick={async () => {
                      await call('/api/immigration/checklist', { candidateId, pathwayKey: evaluation.key }, 'checklist');
                      router.refresh();
                    }}
                  >
                    Build the visa checklist for this route
                  </button>
                  <a href={evaluation.lawUrl} target="_blank" rel="noreferrer" className="btn-secondary text-xs">
                    The law text
                  </a>
                </div>
              </details>
            ))}
          </div>
        </Card>
      )}

      <Card title="Visa checklist">
        {checklist.length === 0 ? (
          <p className="text-sm text-slate-500">
            No checklist yet. Assess the pathways above, then press “Build the visa checklist” on the route you choose.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                <th className="py-2">Item</th>
                <th className="py-2">Owner</th>
                <th className="py-2">Status</th>
                <th className="py-2">Deadline</th>
                <th className="py-2">Label</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {checklist.map((item) => (
                <tr key={item.id}>
                  <td className="py-2">
                    {item.title}
                    {item.sourceUrl && (
                      <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="ml-2 text-xs text-accent-600 underline">
                        source
                      </a>
                    )}
                  </td>
                  <td className="py-2">{item.owner}</td>
                  <td className="py-2">
                    <select
                      className="input py-1 text-xs"
                      defaultValue={item.status}
                      onChange={async (e) => {
                        await fetch('/api/immigration/checklist', {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ id: item.id, status: e.target.value }),
                        });
                        router.refresh();
                      }}
                    >
                      {['open', 'in-progress', 'done', 'not-applicable'].map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2">
                    <input
                      type="date"
                      className="input py-1 text-xs"
                      defaultValue={item.deadline?.slice(0, 10) ?? ''}
                      onChange={async (e) => {
                        await fetch('/api/immigration/checklist', {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ id: item.id, deadline: e.target.value || undefined }),
                        });
                        router.refresh();
                      }}
                    />
                  </td>
                  <td className="py-2">
                    <LabelPill label={item.label} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="Opportunity Card (Chancenkarte) assessment">
        <button
          className="btn-secondary"
          disabled={busy !== null}
          onClick={async () => {
            const result = await call<Chancenkarte>(
              '/api/immigration/chancenkarte',
              { candidateId, refresh: true },
              'chancenkarte',
            );
            if (result) setChancenkarte(result);
          }}
        >
          {busy === 'chancenkarte' ? 'Reading the official criteria…' : 'Run the assessment'}
        </button>

        {chancenkarte && (
          <div className="mt-4 space-y-3 text-sm">
            <div>
              <div className="section-title">Base requirements</div>
              <ul className="mt-1 space-y-1">
                {chancenkarte.baseRequirements.map((req, index) => (
                  <li key={index}>
                    {req.met === 'yes' ? '✓' : req.met === 'no' ? '✕' : '⚠'} {req.text}{' '}
                    <span className="text-slate-500">— {req.note}</span>
                  </li>
                ))}
              </ul>
            </div>
            {chancenkarte.criteriaLoaded ? (
              <div>
                <div className="section-title">
                  Points (official table read on {chancenkarte.checkedAt?.slice(0, 10)})
                </div>
                <ul className="mt-1 space-y-1">
                  {chancenkarte.points?.map((point, index) => (
                    <li key={index}>
                      {point.met ? '✓' : '⚠'} {point.criterion} — {point.points} points.{' '}
                      <span className="text-slate-500">{point.note}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 font-medium">
                  Points that can be shown from the data on file: {chancenkarte.pointsTotal}
                  {chancenkarte.pointsNeeded ? ` of ${chancenkarte.pointsNeeded} needed` : ''}.
                </p>
              </div>
            ) : (
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">{chancenkarte.result}</p>
            )}
            {chancenkarte.criteriaLoaded && <p className="font-medium text-slate-900">{chancenkarte.result}</p>}
            <p className="text-xs text-slate-500">
              {chancenkarte.disclaimer}{' '}
              <a href={chancenkarte.sourceUrl} target="_blank" rel="noreferrer" className="underline">
                Official page
              </a>
            </p>
          </div>
        )}
      </Card>

      <Card title="Recognition assistant">
        <p className="text-sm text-slate-600">
          Checks the official recognition portal for this profession and qualification. Everything it returns is marked
          LIKELY until the competent authority confirms it.
        </p>
        <button
          className="btn-secondary mt-3"
          disabled={busy !== null}
          onClick={async () => {
            const result = await call<Recognition>(
              '/api/immigration/recognition',
              {
                candidateId,
                profession,
                qualification: qualificationTitle || profession,
                issuingCountry: country,
              },
              'recognition',
            );
            if (result) setRecognition(result);
          }}
        >
          {busy === 'recognition' ? 'Reading the portal…' : 'Check recognition'}
        </button>

        {recognition && (
          <div className="mt-4 space-y-2 text-sm">
            <p>
              <strong>Regulated profession:</strong> {recognition.regulated} — {recognition.regulatedNote}
            </p>
            <p>
              <strong>Likely competent authority:</strong>{' '}
              {recognition.likelyAuthority || 'the page does not name one — use the Anerkennungs-Finder'}
            </p>
            <p>
              <strong>Procedure:</strong> {recognition.procedure}
            </p>
            {recognition.documents.length > 0 && (
              <div>
                <strong>Documents named on the page:</strong>
                <ul className="list-disc pl-5">
                  {recognition.documents.map((doc) => (
                    <li key={doc}>{doc}</li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-xs text-slate-500">
              {recognition.disclaimer}{' '}
              <a href={recognition.sourceUrl} target="_blank" rel="noreferrer" className="underline">
                Official portal
              </a>{' '}
              · checked {recognition.checkedAt.slice(0, 10)}
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
