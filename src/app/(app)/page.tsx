import Link from 'next/link';
import { Card, Empty, PriorityDot, Stat } from '@/components/ui';
import { db } from '@/services/db';
import { candidateStats, computePriorities, dashboardStats } from '@/services/tracking';
import { getPolicy } from '@/services/policy';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const policy = await getPolicy();
  const [stats, priorities, candidates] = await Promise.all([
    dashboardStats(),
    computePriorities(policy.followUpDays),
    db.list('candidates'),
  ]);

  const people = await Promise.all(
    candidates
      .filter((c) => c.status !== 'archived')
      .map(async (candidate) => ({ candidate, stats: await candidateStats(candidate.id) })),
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">My Germany Job Mission</h1>
        <p className="mt-1 text-sm text-slate-500">
          Everything below is computed from your own data. Nothing is sent without your approval.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="People" value={stats.people} href="/people" />
        <Stat label="Active applications" value={stats.activeApplications} href="/applications" />
        <Stat label="Interviews" value={stats.interviews} href="/applications?status=Interview" />
        <Stat label="Offers" value={stats.offers} href="/applications?status=Offer" />
        <Stat label="Contracts" value={stats.contracts} href="/applications?status=Contract" />
      </div>

      <Card
        title="Today's priorities"
        action={
          <Link href="/tasks" className="text-xs text-accent-600 underline">
            All tasks
          </Link>
        }
      >
        {priorities.length === 0 ? (
          <Empty>Nothing needs you right now. Add a person or run a job search.</Empty>
        ) : (
          <ul className="divide-y divide-slate-100">
            {priorities.slice(0, 12).map((item) => (
              <li key={item.key} className="flex items-start gap-3 py-3">
                <PriorityDot priority={item.priority} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-900">{item.title}</div>
                  <div className="text-sm text-slate-500">{item.detail}</div>
                </div>
                {item.link && (
                  <Link href={item.link} className="btn-secondary shrink-0 text-xs">
                    Open
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card
        title="People I'm helping"
        action={
          <Link href="/people/new" className="btn-primary text-xs">
            Add a person
          </Link>
        }
      >
        {people.length === 0 ? (
          <Empty>No people yet. Press “Add a person” to start.</Empty>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {people.map(({ candidate, stats: s }) => (
              <Link
                key={candidate.id}
                href={`/people/${candidate.id}`}
                className="rounded-xl border border-slate-200 p-4 transition hover:border-accent-300 hover:shadow-card"
              >
                <div className="text-base font-semibold text-slate-900">{candidate.name}</div>
                <div className="text-sm text-slate-500">
                  {[candidate.profession, candidate.country].filter(Boolean).join(' · ') || 'Profile not filled in yet'}
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <dt className="text-[11px] uppercase text-slate-400">Apps</dt>
                    <dd className="text-lg font-semibold text-slate-900">{s.applications}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase text-slate-400">Interviews</dt>
                    <dd className="text-lg font-semibold text-slate-900">{s.interviews}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase text-slate-400">Offers</dt>
                    <dd className="text-lg font-semibold text-slate-900">{s.offers}</dd>
                  </div>
                </dl>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
