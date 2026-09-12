import { notFound } from 'next/navigation';
import { db } from '@/services/db';
import { findByPortalToken } from '@/services/candidates';
import { PortalClient } from './client';

export const dynamic = 'force-dynamic';

export default async function PortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const candidate = await findByPortalToken(token);
  if (!candidate) notFound();

  const [profile, tasks, interviews, documents] = await Promise.all([
    db.first('candidate_profiles', { where: [{ field: 'candidateId', op: '==', value: candidate.id }] }),
    db.byCandidate('tasks', candidate.id),
    db.byCandidate('interviews', candidate.id),
    db.byCandidate('documents', candidate.id),
  ]);

  const myTasks = tasks.filter((task) => task.owner === 'candidate' && task.state !== 'done');

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <header className="mb-6">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent-600">Your page</div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Hello {candidate.name}</h1>
        <p className="mt-1 text-sm text-slate-500">
          This link is private to you. Nothing here is a promise about a job or a visa — it is the work in progress.
        </p>
      </header>

      <PortalClient
        token={token}
        name={candidate.name}
        needsConfirmation={profile?.needsConfirmation ?? []}
        tasks={myTasks.map((task) => ({ id: task.id, title: task.title, detail: task.detail, due: task.due }))}
        documents={documents.map((doc) => ({ id: doc.id, filename: doc.filename, type: doc.type }))}
        interviewPacks={interviews
          .filter((interview) => interview.prepPack)
          .map((interview) => ({
            id: interview.id,
            scheduledAt: interview.scheduledAt,
            questions: interview.prepPack!.questions,
            vocabulary: interview.prepPack!.vocabulary,
            questionsToAsk: interview.prepPack!.questionsToAsk,
            howGermanInterviewsWork: interview.prepPack!.howGermanInterviewsWork,
          }))}
      />
    </div>
  );
}
