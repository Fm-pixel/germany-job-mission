import { db } from '@/services/db';
import { activeProvider } from '@/services/email';
import { aiAvailable, askJson } from '@/services/ai/client';
import { z } from 'zod';
import { setStatus } from '@/services/applications';
import { scanForScamPatterns } from '@/services/applications/scam';
import { logAudit } from '@/services/tracking/audit';
import { emptyResult, type Agent, type AgentContext, type AgentResult } from './types';

const ReplySchema = z.object({
  intent: z.enum(['rejection', 'interview-invitation', 'question', 'offer', 'auto-reply', 'other']),
  summary: z.string().describe('Two plain sentences: what the employer wants.'),
  suggestedReply: z.string().describe('A short polite German reply, or "" if none is needed.'),
  needsMe: z.boolean(),
});

/** Reads employer replies, updates the status and drafts an answer for me. */
export const reader: Agent = {
  key: 'reader',
  name: 'Reader',
  description: 'Reads employer replies, updates the application status and drafts an answer for you.',
  everyHours: 3,

  async run(ctx: AgentContext): Promise<AgentResult> {
    const result = emptyResult('Reader');
    const provider = activeProvider();
    if (!provider?.fetchReplies) {
      result.skipped.push(
        provider
          ? `${provider.name} cannot read replies, so statuses must be set by hand.`
          : 'No email provider is connected, so replies cannot be read.',
      );
      return result;
    }

    const sent = await db.list('emails', { where: [{ field: 'direction', op: '==', value: 'outbound' }], limit: 200 });
    for (const email of sent) {
      if (!email.threadId || !email.applicationId) continue;
      const application = await db.get('applications', email.applicationId);
      if (!application || application.replyAt) continue;

      let replies;
      try {
        replies = await provider.fetchReplies(email.threadId);
      } catch (err) {
        result.errors.push(`Could not read a thread: ${err instanceof Error ? err.message : String(err)}`);
        continue;
      }
      if (replies.length === 0) continue;

      for (const reply of replies) {
        const known = await db.first('emails', {
          where: [{ field: 'messageId', op: '==', value: reply.messageId }],
        });
        if (known) continue;

        const flags = scanForScamPatterns(reply.body);
        await db.create('emails', {
          applicationId: email.applicationId,
          candidateId: application.candidateId,
          provider: provider.key,
          direction: 'inbound',
          messageId: reply.messageId,
          threadId: email.threadId,
          from: reply.from,
          subject: `Re: ${email.subject}`,
          body: reply.body,
          receivedAt: reply.receivedAt,
        });

        await setStatus(email.applicationId, 'Reply received', {
          by: 'agent',
          note: `Reply from ${reply.from}.`,
        });
        result.did.push(`Reply from ${reply.from} — status set to "Reply received".`);

        if (flags.length > 0) {
          await db.update('applications', email.applicationId, {
            scamFlags: [...(application.scamFlags ?? []), ...flags.map((f) => f.label)],
          });
          result.did.push(`⚠ That reply hit a scam pattern: ${flags.map((f) => f.label).join('; ')}.`);
        }

        if (!aiAvailable()) continue;
        try {
          const understanding = await askJson(
            ReplySchema,
            `An employer replied to an application. Explain in plain words what they want and draft a short German answer if one is needed.

REPLY
From: ${reply.from}
"""
${reply.body.slice(0, 8000)}
"""`,
            { maxTokens: 2000 },
          );
          if (understanding.intent === 'interview-invitation') {
            await setStatus(email.applicationId, 'Interview', { by: 'agent', note: understanding.summary });
          }
          if (understanding.intent === 'rejection') {
            await setStatus(email.applicationId, 'Rejected', { by: 'agent', note: understanding.summary });
          }
          if (understanding.intent === 'offer') {
            await setStatus(email.applicationId, 'Offer', { by: 'agent', note: understanding.summary });
          }
          if (understanding.suggestedReply) {
            await db.create('application_messages', {
              applicationId: email.applicationId,
              candidateId: application.candidateId,
              kind: 'reply-draft',
              channel: 'email',
              language: 'de',
              subject: `Re: ${email.subject}`,
              body: understanding.suggestedReply,
              attachments: [],
              needsInfo: [],
            });
          }
          result.did.push(`Understood as: ${understanding.intent}. ${understanding.summary}`);
        } catch (err) {
          result.errors.push(`Could not read a reply: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }

    await logAudit({
      who: 'Reader agent',
      what: 'Checked for employer replies',
      why: `${ctx.trigger} run`,
      outcome: result.errors.length > 0 ? 'error' : 'ok',
      detail: `${result.did.length} updates`,
    });
    return result;
  },
};
