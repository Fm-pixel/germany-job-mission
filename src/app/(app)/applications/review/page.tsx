import { Card, Empty, NotConnected } from '@/components/ui';
import { db } from '@/services/db';
import { reviewQueue } from '@/services/applications';
import { emailConnected } from '@/services/email';
import { ReviewCard } from './review-card';

export const dynamic = 'force-dynamic';

export default async function ReviewPage() {
  const queue = await reviewQueue();
  const connected = emailConnected();

  const cards = await Promise.all(
    queue.map(async (entry) => ({
      ...entry,
      documents: await db.byCandidate('documents', entry.application.candidateId),
      company: entry.application.companyId ? await db.get('companies', entry.application.companyId) : null,
    })),
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Approve applications</h1>
        <p className="mt-1 text-sm text-slate-500">
          Nothing leaves this tool until you press APPROVE &amp; SEND on a card.
        </p>
      </header>

      {!connected && (
        <NotConnected
          what="Email sending"
          detail='You can still approve. Approved applications are kept as "Approved – waiting for email connection" and are sent as soon as a provider is connected.'
          step="4"
        />
      )}

      {cards.length === 0 ? (
        <Card>
          <Empty>Nothing waiting. Generate applications from a person&apos;s matches.</Empty>
        </Card>
      ) : (
        <div className="space-y-4">
          {cards.map((entry) => (
            <ReviewCard
              key={entry.application.id}
              emailConnected={connected}
              candidateName={entry.candidateName}
              application={{
                id: entry.application.id,
                status: entry.application.status,
                scamFlags: entry.application.scamFlags ?? [],
              }}
              job={
                entry.job
                  ? {
                      title: entry.job.title,
                      employer: entry.job.employer,
                      location: entry.job.location,
                      url: entry.job.url,
                    }
                  : null
              }
              companyEmail={entry.company?.contactEmail}
              message={
                entry.message
                  ? {
                      id: entry.message.id,
                      subject: entry.message.subject,
                      body: entry.message.body,
                      englishSubject: entry.message.englishSubject,
                      englishBody: entry.message.englishBody,
                      coverLetter: entry.message.coverLetter,
                      shortMessage: entry.message.shortMessage,
                      needsInfo: entry.message.needsInfo,
                      attachments: entry.message.attachments,
                    }
                  : null
              }
              documents={entry.documents.map((d) => ({ id: d.id, filename: d.filename, type: d.type }))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
