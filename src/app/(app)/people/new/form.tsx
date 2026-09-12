'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function NewPersonForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get('name') ?? '').trim(),
      country: String(form.get('country') ?? '').trim(),
      city: String(form.get('city') ?? '').trim() || undefined,
      profession: String(form.get('profession') ?? '').trim() || undefined,
      email: String(form.get('email') ?? '').trim() || undefined,
      phone: String(form.get('phone') ?? '').trim() || undefined,
      birthYear: form.get('birthYear') ? Number(form.get('birthYear')) : undefined,
      relocate: form.get('relocate') === 'on',
      consentConfirmed: form.get('consent') === 'on',
    };
    try {
      const res = await fetch('/api/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { ok: boolean; data?: { id: string }; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Could not save.');
      router.push(`/people/${data.data!.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="name">
            Name *
          </label>
          <input className="input" id="name" name="name" required />
        </div>
        <div>
          <label className="label" htmlFor="country">
            Country *
          </label>
          <input className="input" id="country" name="country" required placeholder="Rwanda" />
        </div>
        <div>
          <label className="label" htmlFor="city">
            City
          </label>
          <input className="input" id="city" name="city" />
        </div>
        <div>
          <label className="label" htmlFor="profession">
            Profession
          </label>
          <input className="input" id="profession" name="profession" placeholder="Electrician" />
        </div>
        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input className="input" id="email" name="email" type="email" />
        </div>
        <div>
          <label className="label" htmlFor="phone">
            Phone
          </label>
          <input className="input" id="phone" name="phone" />
        </div>
        <div>
          <label className="label" htmlFor="birthYear">
            Year of birth
          </label>
          <input className="input" id="birthYear" name="birthYear" type="number" min={1940} max={2015} />
          <p className="mt-1 text-xs text-slate-500">Only the year — no date of birth, no passport number.</p>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="relocate" defaultChecked /> Willing to relocate anywhere in Germany
      </label>
      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input type="checkbox" name="consent" required className="mt-1" />
        <span>This person knows I am helping them and agreed that I store their data here.</span>
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button className="btn-primary" type="submit" disabled={busy}>
        {busy ? 'Saving…' : 'Create profile'}
      </button>
    </form>
  );
}
