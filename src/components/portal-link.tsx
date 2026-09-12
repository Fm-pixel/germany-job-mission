'use client';

import { useState } from 'react';

export function PortalLink({ candidateId, hasToken }: { candidateId: string; hasToken: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-600">
        A private page for this person: they can confirm open questions, upload documents, see their own to-do list and
        read their interview pack. The link is a long random token and you can revoke it at any time.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          className="btn-primary text-xs"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setNote(null);
            const res = await fetch(`/api/candidates/${candidateId}/portal`, { method: 'POST' });
            const data = (await res.json()) as { ok: boolean; data?: { url: string }; error?: string };
            if (res.ok && data.ok) setUrl(data.data!.url);
            else setNote(data.error ?? 'Could not create the link.');
            setBusy(false);
          }}
        >
          {hasToken ? 'Show the link' : 'Create the private link'}
        </button>
        {hasToken && (
          <button
            className="btn-danger text-xs"
            disabled={busy}
            onClick={async () => {
              if (!window.confirm('Revoke the link? The old address stops working immediately.')) return;
              setBusy(true);
              await fetch(`/api/candidates/${candidateId}/portal`, { method: 'DELETE' });
              setUrl(null);
              setNote('The link is revoked.');
              setBusy(false);
            }}
          >
            Revoke
          </button>
        )}
      </div>
      {url && (
        <code className="block break-all rounded-lg bg-slate-50 p-2 text-xs text-slate-700">
          {url.startsWith('http') ? url : `${typeof window !== 'undefined' ? window.location.origin : ''}${url}`}
        </code>
      )}
      {note && <p className="text-xs text-slate-600">{note}</p>}
    </div>
  );
}
