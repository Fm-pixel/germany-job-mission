import { guard } from '@/lib/api';
import { db } from '@/services/db';
import { aiAvailable } from '@/services/ai/client';
import { buildInterviewPack } from '@/services/ai/interview';
import { candidateContext, candidateProfileText, languageOf } from '@/services/matching';
import { logAudit } from '@/services/tracking/audit';

export async function POST(request: Request) {
  return guard(async () => {
    const { applicationId, scheduledAt, mode } = (await request.json()) as {
      applicationId?: string;
      scheduledAt?: string;
      mode?: 'video' | 'phone' | 'onsite';
    };
    if (!applicationId) throw new Error('No application given.');
    const application = await db.get('applications', applicationId);
    if (!application) throw new Error('Application not found.');

    const existing = await db.first('interviews', {
      where: [{ field: 'applicationId', op: '==', value: applicationId }],
    });
    const interview =
      existing ??
      (await db.create('interviews', {
        applicationId,
        candidateId: application.candidateId,
        scheduledAt,
        mode,
      }));
    if (existing && (scheduledAt || mode)) {
      await db.update('interviews', existing.id, { scheduledAt, mode });
    }

    if (!aiAvailable()) {
      return { interview, prepPack: null, note: 'The interview pack needs the Anthropic API (NOT CONNECTED).' };
    }

    const job = application.jobId ? await db.get('jobs', application.jobId) : null;
    const ctx = await candidateContext(application.candidateId);
    const pack = await buildInterviewPack({
      profileText: candidateProfileText(ctx),
      jobTitle: job?.title ?? 'the position',
      employer: job?.employer ?? 'the employer',
      jobText: job?.description,
      germanLevel: languageOf(ctx.languages, 'German') ?? 'none',
    });
    const saved = await db.update('interviews', interview.id, {
      prepPack: { ...pack, generatedAt: new Date().toISOString() },
    });
    await logAudit({
      who: 'me',
      what: `Built the interview pack for ${job?.employer ?? 'the employer'}`,
      why: 'The application reached the interview stage',
      candidateId: application.candidateId,
      applicationId,
    });
    return { interview: saved, prepPack: saved.prepPack };
  });
}
