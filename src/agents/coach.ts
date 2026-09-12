import { db } from '@/services/db';
import { aiAvailable } from '@/services/ai/client';
import { buildInterviewPack } from '@/services/ai/interview';
import { candidateContext, candidateProfileText, languageOf } from '@/services/matching';
import { logAudit } from '@/services/tracking/audit';
import { emptyResult, type Agent, type AgentContext, type AgentResult } from './types';

/** Builds the interview pack as soon as an application reaches Interview. */
export const coach: Agent = {
  key: 'coach',
  name: 'Coach',
  description: 'Prepares the interview pack whenever an application reaches the interview stage.',
  everyHours: 12,

  async run(ctx: AgentContext): Promise<AgentResult> {
    const result = emptyResult('Coach');
    if (!aiAvailable()) {
      result.skipped.push('The Anthropic API is NOT CONNECTED, so no interview pack can be built.');
      return result;
    }

    const applications = await db.list('applications', {
      where: [{ field: 'status', op: 'in', value: ['Interview', 'Second interview'] }],
    });

    for (const application of applications) {
      const existing = await db.first('interviews', {
        where: [{ field: 'applicationId', op: '==', value: application.id }],
      });
      if (existing?.prepPack) {
        result.skipped.push('A pack already exists for this interview.');
        continue;
      }
      try {
        const job = application.jobId ? await db.get('jobs', application.jobId) : null;
        const ctxData = await candidateContext(application.candidateId);
        const pack = await buildInterviewPack({
          profileText: candidateProfileText(ctxData),
          jobTitle: job?.title ?? 'the position',
          employer: job?.employer ?? 'the employer',
          jobText: job?.description,
          germanLevel: languageOf(ctxData.languages, 'German') ?? 'none',
        });
        const payload = { prepPack: { ...pack, generatedAt: new Date().toISOString() } };
        if (existing) await db.update('interviews', existing.id, payload);
        else
          await db.create('interviews', {
            applicationId: application.id,
            candidateId: application.candidateId,
            ...payload,
          });
        result.did.push(`Built the interview pack for ${ctxData.candidate.name} — ${job?.employer ?? 'the employer'}.`);
      } catch (err) {
        result.errors.push(err instanceof Error ? err.message : String(err));
      }
    }

    await logAudit({
      who: 'Coach agent',
      what: 'Prepared interview packs',
      why: `${ctx.trigger} run`,
      outcome: result.errors.length > 0 ? 'error' : 'ok',
      detail: `${result.did.length} packs`,
    });
    return result;
  },
};
