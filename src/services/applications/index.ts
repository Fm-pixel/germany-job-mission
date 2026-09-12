import { db, type Application, type ApplicationMessage, type ApplicationStatus, type Job } from '../db';
import { aiAvailable } from '../ai/client';
import { draftApplication } from '../ai/application';
import { candidateContext, candidateProfileText, languageOf } from '../matching';
import { scanForScamPatterns } from './scam';
import { logAudit } from '../tracking/audit';

export * from './scam';

export class AiRequiredError extends Error {
  readonly code = 'AI_NOT_CONNECTED';
  constructor() {
    super('Writing an application needs the Anthropic API. It is NOT CONNECTED — see SETUP_FOR_ME.md step 3.');
    this.name = 'AiRequiredError';
  }
}

export async function setStatus(
  applicationId: string,
  status: ApplicationStatus,
  options: { note?: string; by?: 'me' | 'agent' | 'system' } = {},
): Promise<Application> {
  const application = await db.get('applications', applicationId);
  if (!application) throw new Error('Application not found.');
  const entry = {
    status,
    at: new Date().toISOString(),
    note: options.note,
    by: options.by ?? ('me' as const),
  };
  const patch: Partial<Application> = {
    status,
    statusHistory: [...application.statusHistory, entry],
  };
  if (status === 'Applied') patch.appliedAt = entry.at;
  if (status === 'Reply received') patch.replyAt = entry.at;
  if (status === 'Applied' || status === 'Reply received') patch.lastContactAt = entry.at;
  return db.update('applications', applicationId, patch);
}

export interface PreparedApplication {
  application: Application;
  message: ApplicationMessage;
  scamFlags: { label: string; explanation: string; evidence: string }[];
}

/**
 * Creates (or refreshes) the draft for a match and puts it in the review queue.
 * Nothing is ever sent here.
 */
export async function prepareApplicationForMatch(
  matchId: string,
  options: { by?: 'me' | 'agent' } = {},
): Promise<PreparedApplication> {
  if (!aiAvailable()) throw new AiRequiredError();
  const match = await db.get('job_matches', matchId);
  if (!match) throw new Error('Match not found.');
  const job = await db.get('jobs', match.jobId);
  if (!job) throw new Error('The vacancy behind this match is gone.');
  const ctx = await candidateContext(match.candidateId);

  const scamFlags = scanForScamPatterns(
    [job.title, job.employer, job.description, job.salary].filter(Boolean).join('\n'),
  );

  const draft = await draftApplication({
    profileText: candidateProfileText(ctx),
    candidateName: ctx.candidate.name,
    candidateCountry: ctx.candidate.country,
    profession: ctx.profile?.profession ?? ctx.candidate.profession ?? '',
    jobTitle: job.title,
    employer: job.employer,
    jobUrl: job.url,
    jobLocation: job.location,
    jobText: job.description,
    matchReasons: match.explanation.filter((e) => e.kind === 'positive').map((e) => e.text),
    warnings: match.explanation.filter((e) => e.kind === 'warning').map((e) => e.text),
    kind: 'application',
    germanLevel: languageOf(ctx.languages, 'German') ?? 'none',
  });

  const existing = await db.first('applications', {
    where: [
      { field: 'candidateId', op: '==', value: match.candidateId },
      { field: 'jobId', op: '==', value: job.id },
    ],
  });

  const application =
    existing ??
    (await db.create('applications', {
      candidateId: match.candidateId,
      jobId: job.id,
      matchId: match.id,
      status: 'Prepared',
      statusHistory: [
        { status: 'Potential', at: new Date().toISOString(), by: options.by ?? 'me' },
        { status: 'Prepared', at: new Date().toISOString(), by: options.by ?? 'me' },
      ],
      followUpCount: 0,
      scamFlags: scamFlags.map((f) => f.label),
    }));

  if (existing && existing.status === 'Potential') {
    await setStatus(existing.id, 'Prepared', { by: options.by ?? 'me', note: 'Draft written.' });
  }

  const message = await upsertMessage(application.id, match.candidateId, draft, 'application');

  await logAudit({
    who: options.by === 'agent' ? 'Writer agent' : 'me',
    what: `Prepared an application for ${ctx.candidate.name} → ${job.employer} (${job.title})`,
    why: `Match score ${match.score}, recommended action ${match.recommendedAction}`,
    candidateId: match.candidateId,
    applicationId: application.id,
    outcome: 'ok',
  });

  return { application, message, scamFlags };
}

export async function upsertMessage(
  applicationId: string,
  candidateId: string,
  draft: {
    subjectDe: string;
    emailDe: string;
    subjectEn: string;
    emailEn: string;
    coverLetterDe: string;
    shortMessage: string;
    needsInfo: string[];
  },
  kind: ApplicationMessage['kind'],
): Promise<ApplicationMessage> {
  const existing = await db.first('application_messages', {
    where: [
      { field: 'applicationId', op: '==', value: applicationId },
      { field: 'kind', op: '==', value: kind },
    ],
  });
  const payload = {
    applicationId,
    candidateId,
    kind,
    channel: 'email' as const,
    language: 'de' as const,
    subject: draft.subjectDe,
    body: draft.emailDe,
    coverLetter: draft.coverLetterDe,
    shortMessage: draft.shortMessage,
    attachments: existing?.attachments ?? [],
    needsInfo: draft.needsInfo,
    englishSubject: draft.subjectEn,
    englishBody: draft.emailEn,
  } satisfies Omit<ApplicationMessage, 'id' | 'createdAt' | 'updatedAt'>;

  if (existing && !existing.sentAt) return db.update('application_messages', existing.id, payload);
  return db.create('application_messages', payload);
}

export async function reviewQueue(): Promise<
  { application: Application; message: ApplicationMessage | null; job: Job | null; candidateName: string }[]
> {
  const applications = await db.list('applications', {
    where: [{ field: 'status', op: 'in', value: ['Prepared', 'Approved'] }],
  });
  const out = [];
  for (const application of applications) {
    const [message, job, candidate] = await Promise.all([
      db.first('application_messages', {
        where: [{ field: 'applicationId', op: '==', value: application.id }],
        orderBy: { field: 'createdAt', direction: 'desc' },
      }),
      application.jobId ? db.get('jobs', application.jobId) : Promise.resolve(null),
      db.get('candidates', application.candidateId),
    ]);
    out.push({ application, message, job, candidateName: candidate?.name ?? 'Unknown' });
  }
  return out;
}
