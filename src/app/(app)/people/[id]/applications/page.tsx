import Link from 'next/link';
import { Card, Empty, Pill } from '@/components/ui';
import { db } from '@/services/db';
import { candidateStats } from '@/services/tracking';
import { formatDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function PersonApplicationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [applications, stats] = await Promise.all([db.byCandidate('applications', id), candidateStats(id)]);
  const jobs = await Promise.all(applications.map((a) => (a.jobId ? db.get('jobs', a.jobId) : null)));

  return (
    <div className="space-y-6">
      <Card title="Numbers">
        <dl className="grid grid-cols-3 gap-4 sm:grid-cols-6">
          {Object.entries(stats).map(([key, value]) => (
            <div key={key}>
              <dt className="text-[11px] uppercase tracking-wide text-slate-500">{key}</dt>
              <dd className="text-xl font-semibold text-slate-900">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card title="Applications">
        {applications.length === 0 ? (
          <Empty>No applications yet.</Empty>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                <th className="py-2">Employer</th>
                <th className="py-2">Position</th>
                <th className="py-2">Status</th>
                <th className="py-2">Sent</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {applications.map((application, index) => (
                <tr key={application.id}>
                  <td className="py-2">{jobs[index]?.employer ?? 'speculative'}</td>
                  <td className="py-2">{jobs[index]?.title ?? '—'}</td>
                  <td className="py-2">
                    <Pill tone="slate">{application.status}</Pill>
                  </td>
                  <td className="py-2 text-xs text-slate-500">{formatDate(application.appliedAt)}</td>
                  <td className="py-2 text-right">
                    <Link href={`/applications/${application.id}`} className="text-xs text-accent-600 underline">
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
