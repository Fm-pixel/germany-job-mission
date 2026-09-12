import Link from 'next/link';
import { Banner, Card, Empty, Pill } from '@/components/ui';
import { needsMe } from '@/services/notify';
import { InboxActions } from './actions';

export const dynamic = 'force-dynamic';

export default async function InboxPage() {
  const { priorities, applications, policy } = await needsMe();
  const decisions = priorities.filter((item) => item.priority === 'red');

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Needs you</h1>
        <p className="mt-1 text-sm text-slate-500">
          Only the things your own rules say you must decide. Everything else the agents handle.
        </p>
      </header>

      <Banner tone="blue" title="How your rules are being applied right now">
        {policy.autoSendScoreThreshold > 100
          ? 'Nothing is sent automatically — every application waits here for you.'
          : `Applications with a match of ${policy.autoSendScoreThreshold}% or more may be sent automatically, after the first ${policy.reviewFirstNPerPerson} of a new person have been approved by you. Daily cap: ${policy.maxApplicationsPerPersonPerDay} per person.`}
      </Banner>

      <Card title={`Applications waiting for your decision (${applications.length})`}>
        {applications.length === 0 ? (
          <Empty>Nothing waiting.</Empty>
        ) : (
          <div className="space-y-3">
            {applications.map((entry) => (
              <div key={entry.applicationId} className="rounded-lg border border-slate-200 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      {entry.employer} — {entry.title}
                    </div>
                    <div className="text-xs text-slate-500">
                      for {entry.candidateName} · waiting {entry.waitingDays} day(s)
                    </div>
                    <div className="mt-1 text-sm text-slate-700">{entry.subject}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {entry.scamFlags.length > 0 && <Pill tone="red">⚠ scam check</Pill>}
                    {entry.needsInfo.length > 0 && <Pill tone="yellow">{entry.needsInfo.length} missing facts</Pill>}
                  </div>
                </div>
                <InboxActions applicationId={entry.applicationId} />
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title={`Urgent (${decisions.length})`}>
        {decisions.length === 0 ? (
          <Empty>Nothing urgent.</Empty>
        ) : (
          <ul className="divide-y divide-slate-100">
            {decisions.map((item) => (
              <li key={item.key} className="flex items-start justify-between gap-3 py-3">
                <div>
                  <div className="text-sm font-medium text-slate-900">🔴 {item.title}</div>
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
    </div>
  );
}
