import { db, type Application } from '../db';
import { aiAvailable } from '../ai/client';
import { draftApplication } from '../ai/application';
import { candidateContext, candidateProfileText, languageOf } from '../matching';
import { logAudit } from '../tracking/audit';
import { upsertMessage } from './index';

/**
 * Follow-up system (SPEC section 9 / BUILD_PLAN prompt 10).
 * Creates the draft and the 🔴 task. It never sends — the same approval rule
 * applies as for a first application.
 */

export interface FollowUpCandidate {
  application: Application;
  days: number;
  employer: string;
  candidateName: string;
}

export async function dueFollowUps(followUpDays: number, maxFollowUps = 1): Promise<FollowUpCandidate[]> {
  const applications = await db.list('applications', {
    where: [{ field: 'status', op: '==', value: 'Applied' }],
  });
  const out: FollowUpCandidate[] = [];
  for (const application of applications) {
    if (application.replyAt) continue;
    if (application.followUpCount >= maxFollowUps) continue;
    if (!application.appliedAt) continue;
    const days = Math.floor((Date.now() - new Date(application.appliedAt).getTime()) / 86_400_000);
    if (days < followUpDays) continue;
    const [job, candidate] = await Promise.all([
      application.jobId ? db.get('jobs', application.jobId) : Promise.resolve(null),
      db.get('candidates', application.candidateId),
    ]);
    out.push({
      application,
      days,
      employer: job?.employer ?? 'the employer',
      candidateName: candidate?.name ?? 'this person',
    });
  }
  return out;
}

export async function prepareFollowUp(
  applicationId: string,
  options: { by?: 'me' | 'agent' } = {},
): Promise<{ messageId: string; taskId: string }> {
  if (!aiAvailable()) {
    throw Object.assign(
      new Error('Writing a follow-up needs the Anthropic API (NOT CONNECTED — SETUP_FOR_ME.md step 3).'),
      { code: 'AI_NOT_CONNECTED' },
    );
  }
  const application = await db.get('applications', applicationId);
  if (!application) throw new Error('Application not found.');
  const job = application.jobId ? await db.get('jobs', application.jobId) : null;
  const company = application.companyId ? await db.get('companies', application.companyId) : null;
  const ctx = await candidateContext(application.candidateId);
  const days = application.appliedAt
    ? Math.floor((Date.now() - new Date(application.appliedAt).getTime()) / 86_400_000)
    : 10;

  const draft = await draftApplication({
    profileText: candidateProfileText(ctx),
    candidateName: ctx.candidate.name,
    candidateCountry: ctx.candidate.country,
    profession: ctx.profile?.profession ?? ctx.candidate.profession ?? '',
    jobTitle: job?.title ?? 'the advertised position',
    employer: job?.employer ?? company?.name ?? 'the employer',
    jobUrl: job?.url ?? company?.website ?? '',
    jobLocation: job?.location,
    jobText: job?.description,
    matchReasons: [],
    warnings: [],
    kind: 'follow-up',
    germanLevel: languageOf(ctx.languages, 'German') ?? 'none',
    daysSinceApplied: days,
  });

  const message = await upsertMessage(applicationId, application.candidateId, draft, 'follow-up');
  await db.update('applications', applicationId, { followUpCount: application.followUpCount + 1 });

  const title = `Follow up with ${job?.employer ?? company?.name ?? 'the employer'}`;
  const existingTask = await db.first('tasks', {
    where: [
      { field: 'applicationId', op: '==', value: applicationId },
      { field: 'title', op: '==', value: title },
    ],
  });
  const task =
    existingTask ??
    (await db.create('tasks', {
      title,
      detail: `Application sent ${days} days ago with no reply. Suggested action: SEND FOLLOW-UP. The draft is in the review queue.`,
      priority: 'red',
      candidateId: application.candidateId,
      applicationId,
      owner: 'me',
      state: 'open',
      source: options.by === 'agent' ? 'agent' : 'me',
      link: '/applications/review',
    }));

  await db.update('applications', applicationId, { status: 'Prepared' });
  await logAudit({
    who: options.by === 'agent' ? 'Chaser agent' : 'me',
    what: `Prepared a follow-up to ${job?.employer ?? company?.name ?? 'the employer'}`,
    why: `${days} days without a reply`,
    candidateId: application.candidateId,
    applicationId,
  });

  return { messageId: message.id, taskId: task.id };
}
