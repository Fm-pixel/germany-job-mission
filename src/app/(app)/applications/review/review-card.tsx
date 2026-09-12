'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Banner, Pill } from '@/components/ui';
import { SCAM_ADVICE } from '@/services/applications/scam';

interface Props {
  candidateName: string;
  emailConnected: boolean;
  application: { id: string; status: string; scamFlags: string[] };
  job: { title: string; employer: string; location?: string; url: string } | null;
  companyEmail?: string;
  message: {
    id: string;
    subject: string;
    body: string;
    englishSubject?: string;
    englishBody?: string;
    coverLetter?: string;
    shortMessage?: string;
    needsInfo: string[];
    attachments: string[];
  } | null;
  documents: { id: string; filename: string; type: string }[];
}

export function ReviewCard(props: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<'de' | 'en' | 'letter' | 'short'>('de');
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState(props.message?.subject ?? '');
  const [body, setBody] = useState(props.message?.body ?? '');
  const [attachments, setAttachments] = useState<string[]>(props.message?.attachments ?? []);
  const [to, setTo] = useState(props.companyEmail ?? '');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function saveEdit() {
    setBusy(true);
    await fetch('/api/applications/message', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId: props.message?.id, subject, text: body, attachments }),
    });
    setBusy(false);
    setEditing(false);
    router.refresh();
  }

  async function approve() {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch('/api/applications/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId: props.application.id, to: to || undefined }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        data?: { sent: boolean; reason?: string; to?: string };
      };
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Could not approve.');
      setNote(data.data!.sent ? `Sent to ${data.data!.to}.` : (data.data!.reason ?? 'Approved.'));
      router.refresh();
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Could not approve.');
    } finally {
      setBusy(false);
    }
  }

  async function skip() {
    setBusy(true);
    await fetch('/api/applications/skip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applicationId: props.application.id }),
    });
    setBusy(false);
    router.refresh();
  }

  const shown =
    tab === 'de'
      ? { subject: props.message?.subject ?? '', text: props.message?.body ?? '' }
      : tab === 'en'
        ? { subject: props.message?.englishSubject ?? '', text: props.message?.englishBody ?? '' }
        : tab === 'letter'
          ? { subject: 'Anschreiben', text: props.message?.coverLetter ?? '' }
          : { subject: 'Short message', text: props.message?.shortMessage ?? '' };

  return (
    <article className="card card-pad space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">{props.candidateName}</div>
          <h2 className="text-lg font-semibold text-slate-900">{props.job?.employer ?? 'Speculative application'}</h2>
          <p className="text-sm text-slate-500">
            {props.job?.title} {props.job?.location ? `· ${props.job.location}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Pill tone={props.application.status === 'Approved' ? 'green' : 'yellow'}>{props.application.status}</Pill>
          {props.job && (
            <a href={props.job.url} target="_blank" rel="noreferrer" className="btn-secondary text-xs">
              The advert
            </a>
          )}
        </div>
      </header>

      {props.application.scamFlags.length > 0 && (
        <Banner tone="red" title="Scam protection flagged this advert">
          <p>{props.application.scamFlags.join('; ')}</p>
          <p className="mt-1">{SCAM_ADVICE}</p>
          <p className="mt-1 font-medium">Sending is blocked until you have checked it yourself.</p>
        </Banner>
      )}

      {props.message?.needsInfo && props.message.needsInfo.length > 0 && (
        <Banner tone="amber" title="Missing facts — nothing was invented">
          <ul className="list-disc pl-5">
            {props.message.needsInfo.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
          <p className="mt-1">Fill these in before sending, or the employer will read [NEEDS INFO: …] in the text.</p>
        </Banner>
      )}

      <div className="flex flex-wrap gap-1 text-xs">
        {(['de', 'en', 'letter', 'short'] as const).map((key) => (
          <button
            key={key}
            className={`rounded-full px-3 py-1 ${tab === key ? 'bg-accent-50 text-accent-700' : 'bg-slate-100 text-slate-600'}`}
            onClick={() => setTab(key)}
          >
            {key === 'de' ? 'German email' : key === 'en' ? 'English email' : key === 'letter' ? 'Anschreiben' : 'Short message'}
          </button>
        ))}
      </div>

      {editing && tab === 'de' ? (
        <div className="space-y-2">
          <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} />
          <textarea className="input h-64 font-mono text-xs" value={body} onChange={(e) => setBody(e.target.value)} />
          <div className="flex gap-2">
            <button className="btn-primary text-xs" onClick={saveEdit} disabled={busy}>
              Save
            </button>
            <button className="btn-secondary text-xs" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="text-sm font-medium text-slate-900">{shown.subject}</div>
          <p className="prose-plain mt-2">{shown.text || 'Not generated.'}</p>
        </div>
      )}

      <div>
        <div className="section-title mb-2">Attachments</div>
        <div className="flex flex-wrap gap-2">
          {props.documents.length === 0 && <span className="text-sm text-slate-500">No documents uploaded.</span>}
          {props.documents.map((doc) => (
            <label key={doc.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-1 text-xs">
              <input
                type="checkbox"
                checked={attachments.includes(doc.id)}
                onChange={(e) =>
                  setAttachments(
                    e.target.checked ? [...attachments, doc.id] : attachments.filter((id) => id !== doc.id),
                  )
                }
              />
              {doc.filename} <span className="text-slate-400">({doc.type})</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 border-t border-slate-100 pt-3">
        <div className="min-w-[240px] flex-1">
          <label className="label">Employer email address</label>
          <input
            className="input"
            value={to}
            placeholder={props.emailConnected ? 'name@company.de' : 'no provider connected'}
            onChange={(e) => setTo(e.target.value)}
          />
          <p className="mt-1 text-xs text-slate-500">
            Only fill this in with an address you found on the employer&apos;s own website or in the advert.
          </p>
        </div>
        <button className="btn-primary" onClick={approve} disabled={busy}>
          APPROVE &amp; SEND
        </button>
        <button className="btn-secondary" onClick={() => setEditing(true)} disabled={busy || tab !== 'de'}>
          EDIT
        </button>
        <button className="btn-danger" onClick={skip} disabled={busy}>
          SKIP
        </button>
      </div>

      {note && <p className="text-sm text-slate-600">{note}</p>}
    </article>
  );
}
