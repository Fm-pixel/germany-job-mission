import { db } from '@/services/db';
import { approveAndSend } from '@/services/applications/send';
import { emailConnected } from '@/services/email';
import { logAudit } from '@/services/tracking/audit';
import { mayAutoSend } from './safety';
import { emptyResult, type Agent, type AgentContext, type AgentResult } from './types';

/**
 * Sends only what my own rules allow, and only through the safety rails.
 * Everything it does not send stays in the "Needs you" inbox.
 */
export const sender: Agent = {
  key: 'sender',
  name: 'Sender',
  description: 'Sends the applications your rules allow to go automatically. Everything else waits for you.',
  everyHours: 6,

  async run(ctx: AgentContext): Promise<AgentResult> {
    const result = emptyResult('Sender');

    if (ctx.policy.autoSendScoreThreshold > 100) {
      result.skipped.push('Your rules do not allow automatic sending at all — every application waits for you.');
      return result;
    }
    if (!emailConnected()) {
      result.skipped.push('No email provider is connected, so nothing can be sent. Approved applications wait.');
      return result;
    }

    const prepared = await db.list('applications', {
      where: [{ field: 'status', op: '==', value: 'Prepared' }],
    });

    for (const application of prepared) {
      const decision = await mayAutoSend(application.id, ctx.policy);
      if (!decision.allowed) {
        result.skipped.push(decision.reason);
        continue;
      }
      const company = application.companyId ? await db.get('companies', application.companyId) : null;
      if (!company?.contactEmail) {
        result.skipped.push('No employer email address is known, so this one waits for you.');
        continue;
      }
      try {
        const sent = await approveAndSend(application.id, { by: 'policy', to: company.contactEmail });
        if (sent.sent) result.did.push(`Sent an application to ${company.name}.`);
        else result.skipped.push(sent.reason ?? 'Not sent.');
      } catch (err) {
        result.errors.push(err instanceof Error ? err.message : String(err));
      }
    }

    await logAudit({
      who: 'Sender agent',
      what: 'Checked which applications my rules allow to be sent',
      why: `${ctx.trigger} run`,
      outcome: result.errors.length > 0 ? 'error' : 'ok',
      detail: `${result.did.length} sent, ${result.skipped.length} left for you`,
    });
    return result;
  },
};
