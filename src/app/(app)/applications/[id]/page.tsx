import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, Field, Pill } from '@/components/ui';
import { db, APPLICATION_STATUSES } from '@/services/db';
import { formatDateTime } from '@/lib/format';
import { StatusChanger } from './status-changer';
import { FollowUpButton } from '@/components/followup-button';

export const dynamic = 'force-dynamic';

export default async function ApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const application = await db.get('applications', id);
  if (!application) notFound();
  const [candidate, job, messages, emails] = await Promise.all([
    db.get('candidates', application.candidateId),
    application.jobId ? db.get('jobs', application.jobId) : Promise.resolve(null),
    db.list('application_messages', { where: [{ field: 'applicationId', op: '==', value: id }] }),
    db.list('emails', { where: [{ field: 'applicationId', op: '==', value: id }] }),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <Link href="/applications" className="text-xs text-slate-500 hover:underline">
          ← All applications
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {job?.employer ?? 'Speculative application'}
        </h1>
        <p className="text-sm text-slate-500">
          {job?.title} · for{' '}
          <Link href={`/people/${application.candidateId}`} className="text-accent-600 underline">
            {candidate?.name}
          </Link>
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Status" className="lg:col-span-1">
          <div className="space-y-4">
            <Pill tone="slate">{application.status}</Pill>
            <StatusChanger applicationId={id} current={application.status} statuses={APPLICATION_STATUSES} />
            <dl className="space-y-3 border-t border-slate-100 pt-3">
              <Field label="Applied">{formatDateTime(application.appliedAt)}</Field>
              <Field label="Reply">{formatDateTime(application.replyAt)}</Field>
              <Field label="Follow-ups sent">{application.followUpCount}</Field>
            </dl>
            <div className="border-t border-slate-100 pt-3">
              <FollowUpButton applicationId={id} count={application.followUpCount} />
            </div>
          </div>
        </Card>

        <Card title="Timeline" className="lg:col-span-2">
          <ol className="space-y-3">
            {application.statusHistory.map((entry, index) => (
              <li key={index} className="flex gap-3 text-sm">
                <span className="w-40 shrink-0 text-xs text-slate-500">{formatDateTime(entry.at)}</span>
                <span>
                  <strong>{entry.status}</strong>
                  {entry.note ? ` — ${entry.note}` : ''}
                  <span className="ml-2 text-xs text-slate-400">by {entry.by}</span>
                </span>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      {messages.map((message) => (
        <Card key={message.id} title={`${message.kind} — ${message.sentAt ? 'sent' : 'draft'}`}>
          <div className="text-sm font-medium text-slate-900">{message.subject}</div>
          <p className="prose-plain mt-2">{message.body}</p>
          {message.coverLetter && (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm text-accent-600">Anschreiben</summary>
              <p className="prose-plain mt-2">{message.coverLetter}</p>
            </details>
          )}
        </Card>
      ))}

      {emails.length > 0 && (
        <Card title="Emails">
          <ul className="divide-y divide-slate-100 text-sm">
            {emails.map((email) => (
              <li key={email.id} className="py-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{email.subject}</span>
                  <span className="text-xs text-slate-500">
                    {email.direction} · {email.provider} · {formatDateTime(email.sentAt ?? email.receivedAt)}
                  </span>
                </div>
                <p className="prose-plain mt-1 line-clamp-6">{email.body}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
