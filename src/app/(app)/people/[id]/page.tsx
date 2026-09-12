import Link from 'next/link';
import { Card, Empty, Field, Pill } from '@/components/ui';
import { PortalLink } from '@/components/portal-link';
import { db } from '@/services/db';
import { candidateStats } from '@/services/tracking';
import { getProfile } from '@/services/candidates';
import { formatDate, scoreTone } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function PersonJourneyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [candidate, profile, stats, matches, applications, documents, checklist] = await Promise.all([
    db.get('candidates', id),
    getProfile(id),
    candidateStats(id),
    db.byCandidate('job_matches', id),
    db.byCandidate('applications', id),
    db.byCandidate('documents', id),
    db.byCandidate('checklist_items', id),
  ]);
  if (!candidate) return null;

  const topMatches = matches.sort((a, b) => b.score - a.score).slice(0, 5);
  const jobs = await Promise.all(topMatches.map((m) => db.get('jobs', m.jobId)));
  const needsConfirmation = profile?.needsConfirmation ?? [];

  const steps = [
    { label: 'Profile', done: Boolean(profile?.confirmed) },
    { label: 'CV uploaded', done: documents.some((d) => d.type === 'CV') },
    { label: 'Matches found', done: matches.length > 0 },
    { label: 'Applied', done: stats.sent > 0 },
    { label: 'Interview', done: stats.interviews > 0 },
    { label: 'Offer / contract', done: stats.offers + stats.contracts > 0 },
    { label: 'Visa pathway', done: checklist.length > 0 },
  ];

  return (
    <div className="space-y-6">
      <Card title="The journey">
        <ol className="flex flex-wrap gap-2">
          {steps.map((step) => (
            <li
              key={step.label}
              className={`rounded-lg border px-3 py-2 text-sm ${
                step.done ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 text-slate-500'
              }`}
            >
              {step.done ? '✓' : '○'} {step.label}
            </li>
          ))}
        </ol>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="At a glance" className="lg:col-span-1">
          <dl className="space-y-3">
            <Field label="Profession">{profile?.profession ?? candidate.profession ?? 'Needs confirmation'}</Field>
            <Field label="Years of experience">{profile?.yearsExperience ?? 'Needs confirmation'}</Field>
            <Field label="Qualification">{profile?.qualificationLevel ?? 'Needs confirmation'}</Field>
            <Field label="Applications">
              {stats.applications} · sent {stats.sent} · replies {stats.replies}
            </Field>
            <Field label="Added">{formatDate(candidate.createdAt)}</Field>
          </dl>
        </Card>

        <Card
          title="Needs confirmation"
          className="lg:col-span-2"
          action={
            <Link href={`/people/${id}/documents`} className="text-xs text-accent-600 underline">
              Review CV extraction
            </Link>
          }
        >
          {needsConfirmation.length === 0 ? (
            <Empty>Nothing open. Everything on file has been confirmed.</Empty>
          ) : (
            <ul className="space-y-2">
              {needsConfirmation.map((item, index) => (
                <li key={index} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
                  <span className="font-medium text-amber-900">{item.field}</span>
                  {item.value && <span className="text-amber-800"> — {item.value}</span>}
                  <div className="text-xs text-amber-700">{item.reason}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card
        title="Strongest matches"
        action={
          <Link href={`/people/${id}/matches`} className="text-xs text-accent-600 underline">
            All matches
          </Link>
        }
      >
        {topMatches.length === 0 ? (
          <Empty>
            No matches yet. Open <Link href="/jobs" className="text-accent-600 underline">Jobs</Link> and run a
            search for this person.
          </Empty>
        ) : (
          <ul className="divide-y divide-slate-100">
            {topMatches.map((match, index) => {
              const job = jobs[index];
              return (
                <li key={match.id} className="flex items-start justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900">{job?.title ?? 'Vacancy removed'}</div>
                    <div className="text-sm text-slate-500">
                      {job?.employer} · {job?.location ?? 'location per advert'}
                    </div>
                  </div>
                  <Pill tone={scoreTone(match.score)}>{match.score}% match</Pill>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card title="Their own private page">
        <PortalLink candidateId={id} hasToken={Boolean(candidate.portalToken)} />
      </Card>

      <Card
        title="Applications"
        action={
          <Link href={`/people/${id}/applications`} className="text-xs text-accent-600 underline">
            Open tracker
          </Link>
        }
      >
        {applications.length === 0 ? (
          <Empty>No applications yet.</Empty>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {applications.slice(0, 6).map((application) => (
              <li key={application.id} className="flex items-center justify-between py-2">
                <Link href={`/applications/${application.id}`} className="text-accent-600 hover:underline">
                  {application.id}
                </Link>
                <Pill tone="slate">{application.status}</Pill>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
