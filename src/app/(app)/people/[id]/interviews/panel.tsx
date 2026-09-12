'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui';
import type { InterviewPrepPack } from '@/services/db/types';

interface InterviewRow {
  id: string;
  applicationId: string;
  scheduledAt?: string;
  mode?: string;
  prepPack: InterviewPrepPack | null;
}

export function InterviewPanel({
  candidateId,
  applications,
  interviews,
  documents,
}: {
  candidateId: string;
  applications: { id: string; status: string; employer: string; title: string }[];
  interviews: InterviewRow[];
  documents: { id: string; filename: string; type: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function createPack(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch('/api/interviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId: String(form.get('applicationId') ?? ''),
          scheduledAt: String(form.get('scheduledAt') ?? '') || undefined,
          mode: String(form.get('mode') ?? '') || undefined,
        }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string; data?: { note?: string } };
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Could not build the pack.');
      setNote(data.data?.note ?? 'Interview pack ready.');
      router.refresh();
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Could not build the pack.');
    } finally {
      setBusy(false);
    }
  }

  async function readContract(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch('/api/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateId,
          documentId: String(form.get('documentId') ?? ''),
          applicationId: String(form.get('applicationId') ?? '') || undefined,
          kind: String(form.get('kind') ?? 'contract'),
        }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Could not read the document.');
      setNote('Document read. The points to verify are below.');
      router.refresh();
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Could not read the document.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card title="Interview preparation">
        <form onSubmit={createPack} className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px]">
            <label className="label">Application</label>
            <select className="input" name="applicationId" required>
              {applications.map((application) => (
                <option key={application.id} value={application.id}>
                  {application.employer} — {application.title || application.status}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Date and time</label>
            <input className="input" type="datetime-local" name="scheduledAt" />
          </div>
          <div>
            <label className="label">Mode</label>
            <select className="input" name="mode" defaultValue="video">
              <option value="video">video</option>
              <option value="phone">phone</option>
              <option value="onsite">onsite</option>
            </select>
          </div>
          <button className="btn-primary" type="submit" disabled={busy || applications.length === 0}>
            Build the interview pack
          </button>
        </form>
        {note && <p className="mt-3 text-sm text-slate-600">{note}</p>}
      </Card>

      {interviews.map((interview) => (
        <Card
          key={interview.id}
          title={`Pack — ${applications.find((a) => a.id === interview.applicationId)?.employer ?? ''}`}
          action={
            <button className="btn-secondary text-xs" onClick={() => window.print()}>
              Print / save as PDF
            </button>
          }
        >
          {!interview.prepPack ? (
            <p className="text-sm text-slate-500">No pack generated yet.</p>
          ) : (
            <div className="space-y-4 text-sm">
              <div>
                <div className="section-title">Likely questions</div>
                <ol className="mt-2 space-y-3">
                  {interview.prepPack.questions.map((question, index) => (
                    <li key={index}>
                      <div className="font-medium text-slate-900">{question.de}</div>
                      <div className="text-slate-500">{question.en}</div>
                      <p className="prose-plain mt-1">{question.suggestedAnswer}</p>
                    </li>
                  ))}
                </ol>
              </div>
              <div>
                <div className="section-title">Vocabulary</div>
                <div className="mt-2 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                  {interview.prepPack.vocabulary.map((word, index) => (
                    <div key={index}>
                      <span className="font-medium">{word.de}</span> — {word.en}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="section-title">Questions to ask the employer</div>
                <ul className="mt-1 list-disc pl-5">
                  {interview.prepPack.questionsToAsk.map((question, index) => (
                    <li key={index}>{question}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="section-title">How German interviews work</div>
                <p className="prose-plain mt-1">{interview.prepPack.howGermanInterviewsWork}</p>
              </div>
            </div>
          )}
        </Card>
      ))}

      <Card title="Offer or contract">
        <p className="text-sm text-slate-600">
          Upload the document under “Documents &amp; CV” first, then read it here. This lists what the document says —
          it is not legal advice and says nothing about whether the contract is valid.
        </p>
        <form onSubmit={readContract} className="mt-3 flex flex-wrap items-end gap-3">
          <div className="min-w-[220px]">
            <label className="label">Document</label>
            <select className="input" name="documentId" required>
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.filename} ({doc.type})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Type</label>
            <select className="input" name="kind" defaultValue="contract">
              <option value="offer">job offer</option>
              <option value="contract">employment contract</option>
            </select>
          </div>
          <div className="min-w-[220px]">
            <label className="label">Belongs to application</label>
            <select className="input" name="applicationId" defaultValue="">
              <option value="">—</option>
              {applications.map((application) => (
                <option key={application.id} value={application.id}>
                  {application.employer}
                </option>
              ))}
            </select>
          </div>
          <button className="btn-primary" type="submit" disabled={busy || documents.length === 0}>
            Read the document
          </button>
        </form>
      </Card>
    </div>
  );
}
