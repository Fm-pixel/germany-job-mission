'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Confirmation {
  field: string;
  value: string;
  reason: string;
}

export function PortalClient({
  token,
  needsConfirmation,
  tasks,
  documents,
  interviewPacks,
}: {
  token: string;
  name: string;
  needsConfirmation: Confirmation[];
  tasks: { id: string; title: string; detail?: string; due?: string }[];
  documents: { id: string; filename: string; type: string }[];
  interviewPacks: {
    id: string;
    scheduledAt?: string;
    questions: { de: string; en: string; suggestedAnswer: string }[];
    vocabulary: { de: string; en: string }[];
    questionsToAsk: string[];
    howGermanInterviewsWork: string;
  }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  async function confirm(field: string) {
    setBusy(true);
    setNote(null);
    const res = await fetch(`/api/portal/${token}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field, value: answers[field] ?? '' }),
    });
    const data = (await res.json()) as { ok: boolean; error?: string };
    setNote(res.ok && data.ok ? 'Thank you — that is saved.' : (data.error ?? 'That did not work.'));
    setBusy(false);
    router.refresh();
  }

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNote(null);
    const form = new FormData(event.currentTarget);
    const res = await fetch(`/api/portal/${token}/upload`, { method: 'POST', body: form });
    const data = (await res.json()) as { ok: boolean; error?: string };
    setNote(res.ok && data.ok ? 'Uploaded — thank you.' : (data.error ?? 'The upload did not work.'));
    setBusy(false);
    (event.target as HTMLFormElement).reset();
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <section className="card card-pad">
        <h2 className="text-sm font-semibold text-slate-900">Please confirm these</h2>
        {needsConfirmation.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Nothing to confirm right now.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {needsConfirmation.map((item, index) => (
              <li key={index} className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <div className="text-sm font-medium text-amber-900">{item.field}</div>
                <p className="text-xs text-amber-800">{item.reason}</p>
                <div className="mt-2 flex gap-2">
                  <input
                    className="input"
                    placeholder={item.value || 'Your answer'}
                    value={answers[item.field] ?? ''}
                    onChange={(e) => setAnswers({ ...answers, [item.field]: e.target.value })}
                  />
                  <button className="btn-primary text-xs" onClick={() => confirm(item.field)} disabled={busy}>
                    Confirm
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card card-pad">
        <h2 className="text-sm font-semibold text-slate-900">Your to-do list</h2>
        {tasks.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Nothing for you to do right now.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {tasks.map((task) => (
              <li key={task.id} className="rounded-lg border border-slate-200 p-3">
                <div className="font-medium text-slate-900">{task.title}</div>
                {task.detail && <div className="text-slate-500">{task.detail}</div>}
                {task.due && <div className="text-xs text-slate-400">by {task.due}</div>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card card-pad">
        <h2 className="text-sm font-semibold text-slate-900">Send a document</h2>
        <p className="mt-1 text-sm text-slate-500">
          Certificates, diplomas, language certificates. Only send your passport when you are asked for it here.
        </p>
        <form onSubmit={upload} className="mt-3 flex flex-wrap items-end gap-3">
          <div>
            <label className="label" htmlFor="file">
              File
            </label>
            <input className="input" id="file" name="file" type="file" required />
          </div>
          <div>
            <label className="label" htmlFor="type">
              What is it?
            </label>
            <select className="input" id="type" name="type" defaultValue="certificate">
              {['CV', 'certificate', 'diploma', 'reference', 'language certificate', 'school certificate', 'passport', 'other'].map(
                (type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ),
              )}
            </select>
          </div>
          <button className="btn-primary" type="submit" disabled={busy}>
            Upload
          </button>
        </form>
        {documents.length > 0 && (
          <p className="mt-3 text-xs text-slate-500">
            Already received: {documents.map((doc) => doc.filename).join(', ')}
          </p>
        )}
      </section>

      {interviewPacks.map((pack) => (
        <section key={pack.id} className="card card-pad">
          <h2 className="text-sm font-semibold text-slate-900">
            Interview preparation {pack.scheduledAt ? `— ${new Date(pack.scheduledAt).toLocaleString('en-GB')}` : ''}
          </h2>
          <div className="mt-3 space-y-4 text-sm">
            <div>
              <div className="section-title">Questions you will probably be asked</div>
              <ol className="mt-2 space-y-3">
                {pack.questions.map((question, index) => (
                  <li key={index}>
                    <div className="font-medium text-slate-900">{question.de}</div>
                    <div className="text-slate-500">{question.en}</div>
                    <p className="prose-plain mt-1">{question.suggestedAnswer}</p>
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <div className="section-title">Words to know</div>
              <div className="mt-2 grid gap-1 sm:grid-cols-2">
                {pack.vocabulary.map((word, index) => (
                  <div key={index}>
                    <span className="font-medium">{word.de}</span> — {word.en}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="section-title">Ask them this</div>
              <ul className="mt-1 list-disc pl-5">
                {pack.questionsToAsk.map((question, index) => (
                  <li key={index}>{question}</li>
                ))}
              </ul>
            </div>
            <div>
              <div className="section-title">How German interviews work</div>
              <p className="prose-plain mt-1">{pack.howGermanInterviewsWork}</p>
            </div>
          </div>
        </section>
      ))}

      {note && <p className="text-sm text-slate-700">{note}</p>}

      <p className="text-xs text-slate-400">
        Nobody here can promise you a job or a visa. Never pay anyone for a job or a visa, and never send your passport
        to someone you cannot verify.
      </p>
    </div>
  );
}
