import Link from 'next/link';
import type { ReactNode } from 'react';

export function Card({
  title,
  action,
  children,
  className = '',
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {action}
        </header>
      )}
      <div className="card-pad">{children}</div>
    </section>
  );
}

export function Stat({ label, value, href }: { label: string; value: number | string; href?: string }) {
  const inner = (
    <div className="card card-pad">
      <div className="text-3xl font-semibold tracking-tight text-slate-900">{value}</div>
      <div className="mt-1 text-sm text-slate-500">{label}</div>
    </div>
  );
  return href ? (
    <Link href={href} className="block transition hover:-translate-y-0.5">
      {inner}
    </Link>
  ) : (
    inner
  );
}

const PILL_TONES: Record<string, string> = {
  green: 'bg-emerald-50 text-emerald-700',
  yellow: 'bg-amber-50 text-amber-800',
  red: 'bg-red-50 text-red-700',
  blue: 'bg-accent-50 text-accent-700',
  slate: 'bg-slate-100 text-slate-700',
};

export function Pill({ tone = 'slate', children }: { tone?: keyof typeof PILL_TONES; children: ReactNode }) {
  return <span className={`pill ${PILL_TONES[tone] ?? PILL_TONES.slate}`}>{children}</span>;
}

export function NotConnected({
  what,
  detail,
  step,
}: {
  what: string;
  detail?: string;
  step?: string;
}) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <div className="font-semibold">{what} — NOT CONNECTED</div>
      {detail && <p className="mt-1">{detail}</p>}
      {step && step !== '-' && (
        <p className="mt-1">
          What to do: open <code className="rounded bg-amber-100 px-1">SETUP_FOR_ME.md</code> and follow step {step}.
        </p>
      )}
    </div>
  );
}

export function Banner({
  tone = 'blue',
  title,
  children,
}: {
  tone?: 'blue' | 'red' | 'amber' | 'green';
  title: string;
  children?: ReactNode;
}) {
  const tones = {
    blue: 'border-accent-300 bg-accent-50 text-accent-700',
    red: 'border-red-200 bg-red-50 text-red-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  } as const;
  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${tones[tone]}`}>
      <div className="font-semibold">{title}</div>
      {children && <div className="mt-1">{children}</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-slate-500">{children}</p>;
}

export function PriorityDot({ priority }: { priority: 'red' | 'orange' | 'green' }) {
  const map = { red: '🔴', orange: '🟠', green: '🟢' } as const;
  return <span aria-label={priority}>{map[priority]}</span>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-900">{children}</dd>
    </div>
  );
}

export const DISCLAIMER =
  'This tool never guarantees a job or a visa. Every immigration statement must be confirmed with the responsible German authority, and legal questions belong to a lawyer.';
