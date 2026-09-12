import Link from 'next/link';
import { Card, Empty, Pill } from '@/components/ui';
import { db, APPLICATION_STATUSES } from '@/services/db';
import { formatDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; candidate?: string }>;
}) {
  const filters = await searchParams;
  const [applications, candidates, jobs] = await Promise.all([
    db.list('applications', { limit: 500 }),
    db.list('candidates'),
    db.list('jobs', { limit: 500 }),
  ]);
  const nameOf = new Map(candidates.map((c) => [c.id, c.name]));
  const jobOf = new Map(jobs.map((j) => [j.id, j]));

  const filtered = applications.filter(
    (a) =>
      (!filters.status || a.status === filters.status) &&
      (!filters.candidate || a.candidateId === filters.candidate),
  );
  const waiting = applications.filter((a) => a.status === 'Prepared').length;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Applications</h1>
          <p className="mt-1 text-sm text-slate-500">Every application, with its full history.</p>
        </div>
        <Link href="/applications/review" className="btn-primary">
          Review queue{waiting > 0 ? ` (${waiting})` : ''}
        </Link>
      </header>

      <Card>
        <div className="mb-4 flex flex-wrap gap-2 text-xs">
          <Link href="/applications" className={`rounded-full px-3 py-1 ${!filters.status ? 'bg-accent-50 text-accent-700' : 'bg-slate-100 text-slate-600'}`}>
            All
          </Link>
          {APPLICATION_STATUSES.map((status) => (
            <Link
              key={status}
              href={`/applications?status=${encodeURIComponent(status)}`}
              className={`rounded-full px-3 py-1 ${filters.status === status ? 'bg-accent-50 text-accent-700' : 'bg-slate-100 text-slate-600'}`}
            >
              {status}
            </Link>
          ))}
        </div>

        {filtered.length === 0 ? (
          <Empty>No applications with this filter.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                  <th className="py-2 pr-3">Person</th>
                  <th className="py-2 pr-3">Employer</th>
                  <th className="py-2 pr-3">Position</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Sent</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((application) => {
                  const job = application.jobId ? jobOf.get(application.jobId) : undefined;
                  return (
                    <tr key={application.id}>
                      <td className="py-2 pr-3">{nameOf.get(application.candidateId) ?? '—'}</td>
                      <td className="py-2 pr-3">{job?.employer ?? 'speculative'}</td>
                      <td className="py-2 pr-3">{job?.title ?? '—'}</td>
                      <td className="py-2 pr-3">
                        <Pill
                          tone={
                            ['Offer', 'Contract'].includes(application.status)
                              ? 'green'
                              : ['Rejected', 'No response'].includes(application.status)
                                ? 'red'
                                : 'slate'
                          }
                        >
                          {application.status}
                        </Pill>
                      </td>
                      <td className="py-2 pr-3 text-xs text-slate-500">{formatDate(application.appliedAt)}</td>
                      <td className="py-2 text-right">
                        <Link href={`/applications/${application.id}`} className="text-xs text-accent-600 underline">
                          Open
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
