import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Banner, Card, Field, Pill } from '@/components/ui';
import { db } from '@/services/db';
import { scanForScamPatterns, SCAM_ADVICE } from '@/services/applications/scam';
import { formatDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await db.get('jobs', id);
  if (!job) notFound();
  const flags = scanForScamPatterns(
    [job.title, job.employer, job.description, job.salary].filter(Boolean).join('\n'),
  );

  return (
    <div className="space-y-6">
      <header>
        <Link href="/jobs" className="text-xs text-slate-500 hover:underline">
          ← All jobs
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{job.title}</h1>
        <p className="text-sm text-slate-500">
          {job.employer} · {job.location ?? 'location per advert'}
        </p>
      </header>

      {flags.length > 0 && (
        <Banner tone="red" title="Check this advert before using it">
          <ul className="mt-1 list-disc pl-5">
            {flags.map((flag) => (
              <li key={flag.label}>
                <strong>{flag.label}.</strong> {flag.explanation} Found: “{flag.evidence}”
              </li>
            ))}
          </ul>
          <p className="mt-2">{SCAM_ADVICE}</p>
        </Banner>
      )}

      <Card title="Facts">
        <dl className="grid gap-4 sm:grid-cols-3">
          <Field label="Source">{job.source}</Field>
          <Field label="Original advert">
            <a href={job.url} target="_blank" rel="noreferrer" className="text-accent-600 underline">
              Open on arbeitsagentur.de
            </a>
          </Field>
          <Field label="Status">
            <Pill tone={job.active ? 'green' : 'red'}>{job.active ? 'active' : 'not active'}</Pill>
          </Field>
          <Field label="Discovered">{formatDate(job.discoveredAt)}</Field>
          <Field label="Last checked">{formatDate(job.checkedAt)}</Field>
          <Field label="Published">{formatDate(job.publishedAt)}</Field>
          <Field label="Salary as advertised">{job.salary ?? 'not stated'}</Field>
          <Field label="German level in the advert">{job.languageRequirement ?? 'not stated'}</Field>
          <Field label="Working time">{job.workingTime ?? 'not stated'}</Field>
        </dl>
      </Card>

      <Card title="Advert text">
        {job.description ? (
          <p className="prose-plain">{job.description}</p>
        ) : (
          <p className="text-sm text-slate-500">
            The full text has not been fetched yet. Open the original advert with the link above.
          </p>
        )}
      </Card>
    </div>
  );
}
