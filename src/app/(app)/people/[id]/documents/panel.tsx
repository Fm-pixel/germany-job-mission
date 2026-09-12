'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { StoredDocument } from '@/services/db/types';
import type { PendingExtraction } from '@/services/candidates';
import { formatDate } from '@/lib/format';

const TYPES = [
  'CV',
  'certificate',
  'diploma',
  'reference',
  'language certificate',
  'passport',
  'school certificate',
  'contract',
  'other',
];

export function DocumentsPanel({
  candidateId,
  documents,
  aiConnected,
}: {
  candidateId: string;
  documents: StoredDocument[];
  aiConnected: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<{ documentId: string; pending: PendingExtraction } | null>(null);

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/candidates/${candidateId}/documents`, { method: 'POST', body: form });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Upload failed.');
      setMessage('Uploaded.');
      (event.target as HTMLFormElement).reset();
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setBusy(false);
    }
  }

  async function analyse(documentId: string) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/candidates/${candidateId}/extract-cv`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        data?: { documentId: string; pending: PendingExtraction };
      };
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'The CV could not be read.');
      setPending(data.data!);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'The CV could not be read.');
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!pending) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/candidates/${candidateId}/extract-cv`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pending),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Could not save.');
      setPending(null);
      setMessage('Confirmed — the profile is updated.');
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(documentId: string) {
    if (!window.confirm('Delete this document? The file is removed from Drive as well.')) return;
    setBusy(true);
    await fetch(`/api/documents/${documentId}`, { method: 'DELETE' });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={upload} className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="file">
            File (PDF or DOCX)
          </label>
          <input className="input" id="file" name="file" type="file" required />
        </div>
        <div>
          <label className="label" htmlFor="type">
            Type
          </label>
          <select className="input" id="type" name="type" defaultValue="CV">
            {TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
        <button className="btn-primary" type="submit" disabled={busy}>
          Upload
        </button>
      </form>

      {message && <p className="text-sm text-slate-600">{message}</p>}

      {documents.length === 0 ? (
        <p className="text-sm text-slate-500">No documents yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
              <th className="py-2">File</th>
              <th className="py-2">Type</th>
              <th className="py-2">Stored</th>
              <th className="py-2">Uploaded</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {documents.map((doc) => (
              <tr key={doc.id}>
                <td className="py-2">
                  <a href={`/api/documents/${doc.id}`} target="_blank" rel="noreferrer" className="text-accent-600 underline">
                    {doc.filename}
                  </a>
                </td>
                <td className="py-2">{doc.type}</td>
                <td className="py-2 text-xs text-slate-500">
                  {doc.storage === 'drive' ? 'Private Drive folder' : 'Local test file'}
                </td>
                <td className="py-2 text-xs text-slate-500">{formatDate(doc.createdAt)}</td>
                <td className="py-2 text-right">
                  {doc.type === 'CV' && aiConnected && (
                    <button className="btn-secondary mr-2 text-xs" onClick={() => analyse(doc.id)} disabled={busy}>
                      Read this CV
                    </button>
                  )}
                  <button className="btn-danger text-xs" onClick={() => remove(doc.id)} disabled={busy}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {pending && <ExtractionReview pending={pending.pending} onConfirm={confirm} onCancel={() => setPending(null)} busy={busy} />}
    </div>
  );
}

function ExtractionReview({
  pending,
  onConfirm,
  onCancel,
  busy,
}: {
  pending: PendingExtraction;
  onConfirm: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  return (
    <div className="rounded-xl border border-accent-200 bg-accent-50/40 p-4">
      <h3 className="text-sm font-semibold text-slate-900">What the CV says</h3>
      <p className="mt-1 text-sm text-slate-600">
        Nothing is saved until you press confirm. Anything in yellow was not clearly stated in the CV — check it with
        the person before relying on it.
      </p>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <Item label="Profession" value={pending.profile.profession ?? '—'} />
        <Item label="Years of experience" value={String(pending.profile.yearsExperience ?? '—')} />
        <Item label="Qualification level" value={pending.profile.qualificationLevel ?? '—'} />
        <Item label="Skills" value={(pending.profile.skills ?? []).join(', ') || '—'} />
        <Item label="Industries" value={(pending.profile.industries ?? []).join(', ') || '—'} />
        <Item label="Job titles" value={(pending.profile.jobTitles ?? []).join(', ') || '—'} />
      </dl>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Block title="Languages">
          {pending.languages.map((l, i) => (
            <li key={i}>
              {l.language}: {l.level ?? `${l.raw} (needs confirmation)`}
            </li>
          ))}
        </Block>
        <Block title="Education">
          {pending.education.map((e, i) => (
            <li key={i}>
              {[e.degree, e.school, e.graduationYear].filter(Boolean).join(' · ')}
            </li>
          ))}
        </Block>
        <Block title="Work experience">
          {pending.workExperience.map((w, i) => (
            <li key={i}>
              {w.title} — {w.employer} ({w.from || '?'}–{w.to || '?'})
            </li>
          ))}
        </Block>
      </div>

      {pending.needsConfirmation.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3">
          <div className="text-sm font-semibold text-amber-900">Needs confirmation</div>
          <ul className="mt-2 space-y-1 text-sm text-amber-800">
            {pending.needsConfirmation.map((item, i) => (
              <li key={i}>
                <strong>{item.field}</strong>
                {item.value ? `: ${item.value}` : ''} — {item.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <button className="btn-primary" onClick={onConfirm} disabled={busy}>
          Confirm and save to the profile
        </button>
        <button className="btn-secondary" onClick={onCancel} disabled={busy}>
          Discard
        </button>
      </div>
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="text-sm text-slate-900">{value}</dd>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{title}</div>
      <ul className="mt-1 space-y-0.5 text-sm text-slate-800">{children}</ul>
    </div>
  );
}
