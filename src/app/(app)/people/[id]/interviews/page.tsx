import { Card, NotConnected } from '@/components/ui';
import { db } from '@/services/db';
import { aiAvailable } from '@/services/ai/client';
import { CONTRACT_DISCLAIMER } from '@/services/ai/contract';
import { InterviewPanel } from './panel';

export const dynamic = 'force-dynamic';

export default async function InterviewsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [applications, interviews, documents, offers, contracts] = await Promise.all([
    db.byCandidate('applications', id),
    db.byCandidate('interviews', id),
    db.byCandidate('documents', id),
    db.byCandidate('offers', id),
    db.byCandidate('contracts', id),
  ]);
  const jobs = await Promise.all(applications.map((a) => (a.jobId ? db.get('jobs', a.jobId) : null)));

  return (
    <div className="space-y-6">
      {!aiAvailable() && <NotConnected what="Interview packs and contract reading" step="3" />}

      <InterviewPanel
        candidateId={id}
        applications={applications.map((application, index) => ({
          id: application.id,
          status: application.status,
          employer: jobs[index]?.employer ?? 'speculative',
          title: jobs[index]?.title ?? '',
        }))}
        interviews={interviews.map((interview) => ({
          id: interview.id,
          applicationId: interview.applicationId,
          scheduledAt: interview.scheduledAt,
          mode: interview.mode,
          prepPack: interview.prepPack ?? null,
        }))}
        documents={documents.map((doc) => ({ id: doc.id, filename: doc.filename, type: doc.type }))}
      />

      {[...offers, ...contracts].length > 0 && (
        <Card title="Offers and contracts">
          <div className="space-y-4">
            {[...offers, ...contracts].map((record) => (
              <div key={record.id} className="rounded-lg border border-slate-200 p-3">
                <div className="text-sm font-semibold text-slate-900">
                  {record.employer ?? 'Employer not named'} — {record.jobTitle ?? 'position not named'}
                </div>
                <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-xs uppercase text-slate-500">Gross salary</dt>
                    <dd>{record.grossSalary ?? 'not stated'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase text-slate-500">Hours per week</dt>
                    <dd>{record.hoursPerWeek ?? 'not stated'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase text-slate-500">Start</dt>
                    <dd>{record.startDate ?? 'not stated'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase text-slate-500">Duration</dt>
                    <dd>{record.duration ?? 'not stated'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase text-slate-500">Probation</dt>
                    <dd>{record.probation ?? 'not stated'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase text-slate-500">Notice period</dt>
                    <dd>{record.noticePeriod ?? 'not stated'}</dd>
                  </div>
                </dl>
                <div className="mt-3">
                  <div className="section-title">Important points to verify</div>
                  <ul className="mt-1 list-disc pl-5 text-sm text-slate-700">
                    {record.pointsToVerify.map((point, index) => (
                      <li key={index}>{point}</li>
                    ))}
                  </ul>
                </div>
                <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                  {CONTRACT_DISCLAIMER}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
