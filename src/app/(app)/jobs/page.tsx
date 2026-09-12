import Link from 'next/link';
import { Card, Empty, Pill } from '@/components/ui';
import { db } from '@/services/db';
import { formatDate, relativeDays } from '@/lib/format';
import { JobSearchPanel } from './search-panel';

export const dynamic = 'force-dynamic';

export default async function JobsPage() {
  const [jobs, candidates, sources] = await Promise.all([
    db.list('jobs', { limit: 500 }),
    db.list('candidates'),
    db.list('job_sources'),
  ]);
  const sorted = [...jobs].sort((a, b) => (a.discoveredAt < b.discoveredAt ? 1 : -1)).slice(0, 100);
  const source = sources.find((s) => s.key === 'bundesagentur');

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Jobs</h1>
        <p className="mt-1 text-sm text-slate-500">
          Real vacancies from the Bundesagentur für Arbeit. Every one keeps its source link and the date it was last
          checked.
        </p>
      </header>

      {source?.status === 'error' && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <div className="font-semibold">SOURCE NOT CONNECTED — Bundesagentur für Arbeit</div>
          <p className="mt-1">{source.lastError}</p>
          <p className="mt-1">
            Nothing is invented to fill the gap. Once this server can reach <code>rest.arbeitsagentur.de</code>, press
            search again.
          </p>
        </div>
      )}

      <Card title="Search">
        <JobSearchPanel candidates={candidates.map((c) => ({ id: c.id, name: c.name, profession: c.profession }))} />
      </Card>

      <Card title={`Stored vacancies (${jobs.length})`}>
        {sorted.length === 0 ? (
          <Empty>No vacancies stored yet. Run a search above.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                  <th className="py-2 pr-3">Position</th>
                  <th className="py-2 pr-3">Employer</th>
                  <th className="py-2 pr-3">Location</th>
                  <th className="py-2 pr-3">Found</th>
                  <th className="py-2 pr-3">Checked</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sorted.map((job) => (
                  <tr key={job.id}>
                    <td className="py-2 pr-3">
                      <Link href={`/jobs/${job.id}`} className="font-medium text-accent-600 hover:underline">
                        {job.title}
                      </Link>
                      {job.kind === 'apprenticeship' && <Pill tone="yellow">Ausbildung</Pill>}
                      {!job.active && <Pill tone="red">not active</Pill>}
                      {job.scamFlags && job.scamFlags.length > 0 && <Pill tone="red">⚠ check</Pill>}
                    </td>
                    <td className="py-2 pr-3">{job.employer}</td>
                    <td className="py-2 pr-3">{job.location ?? '—'}</td>
                    <td className="py-2 pr-3 text-xs text-slate-500">{formatDate(job.discoveredAt)}</td>
                    <td className="py-2 pr-3 text-xs text-slate-500">{relativeDays(job.checkedAt)}</td>
                    <td className="py-2 text-right">
                      <a href={job.url} target="_blank" rel="noreferrer" className="text-xs text-accent-600 underline">
                        Original advert
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
