import { db, type Application } from '../db';
import { attachmentsFor, emailConnected, sendEmail } from '../email';
import { logAudit } from '../tracking/audit';
import { setStatus } from './index';
import { scanForScamPatterns } from './scam';

export interface ApproveResult {
  status: Application['status'];
  sent: boolean;
  reason?: string;
  to?: string;
}

/**
 * The one and only send path. Called by my APPROVE & SEND button and by the
 * Sender agent when — and only when — my own rules allow it for that person.
 */
export async function approveAndSend(
  applicationId: string,
  options: { by?: 'me' | 'policy'; to?: string } = {},
): Promise<ApproveResult> {
  const application = await db.get('applications', applicationId);
  if (!application) throw new Error('Application not found.');
  const message = await db.first('application_messages', {
    where: [{ field: 'applicationId', op: '==', value: applicationId }],
    orderBy: { field: 'createdAt', direction: 'desc' },
  });
  if (!message) throw new Error('There is no written message for this application yet.');

  // Safety rail: a flagged advert is never sent, whatever the rules say.
  const flags = scanForScamPatterns(`${message.subject}\n${message.body}`);
  const jobFlags = application.scamFlags ?? [];
  if (flags.length > 0 || jobFlags.length > 0) {
    await db.update('applications', applicationId, {
      blockedReason: `Blocked by scam protection: ${[...jobFlags, ...flags.map((f) => f.label)].join('; ')}`,
    });
    await logAudit({
      who: options.by === 'policy' ? 'Sender agent' : 'me',
      what: 'Refused to send an application',
      why: 'The advert or the message hit a scam pattern',
      applicationId,
      candidateId: application.candidateId,
      outcome: 'blocked',
      detail: [...jobFlags, ...flags.map((f) => f.label)].join('; '),
    });
    throw new Error(
      'This advert is flagged by the scam protection. Check it by hand before anything is sent; nothing was sent.',
    );
  }

  const now = new Date().toISOString();
  await db.update('applications', applicationId, { approvedAt: now, approvedBy: options.by ?? 'me' });
  await db.update('application_messages', message.id, { approvedAt: now });

  const job = application.jobId ? await db.get('jobs', application.jobId) : null;
  const company = application.companyId ? await db.get('companies', application.companyId) : null;
  const to = options.to ?? company?.contactEmail;

  if (!emailConnected() || !to) {
    await setStatus(applicationId, 'Approved', {
      by: options.by === 'policy' ? 'agent' : 'me',
      note: !emailConnected()
        ? 'Approved – waiting for email connection (no provider connected).'
        : 'Approved – no employer email address is known. Apply through the advert link or add the address.',
    });
    await logAudit({
      who: options.by === 'policy' ? 'Sender agent' : 'me',
      what: `Approved the application to ${job?.employer ?? company?.name ?? 'the employer'}`,
      why: !emailConnected() ? 'No email provider is connected' : 'No employer address known',
      applicationId,
      candidateId: application.candidateId,
      outcome: 'skipped',
    });
    return {
      status: 'Approved',
      sent: false,
      reason: !emailConnected()
        ? 'NOT CONNECTED: no email provider. The application waits as "Approved".'
        : 'No employer email address is known. Use the link in the advert, or add the address to the company.',
    };
  }

  const attachments = await attachmentsFor(message);
  const result = await sendEmail(
    { to, subject: message.subject, body: message.body, attachments },
    { applicationId, candidateId: application.candidateId },
  );

  if (!result.sent) {
    await setStatus(applicationId, 'Approved', { note: result.reason, by: 'system' });
    return { status: 'Approved', sent: false, reason: result.reason };
  }

  await db.update('application_messages', message.id, { sentAt: new Date().toISOString() });
  await setStatus(applicationId, 'Applied', {
    by: options.by === 'policy' ? 'agent' : 'me',
    note: `Sent to ${to}.`,
  });
  await logAudit({
    who: options.by === 'policy' ? 'Sender agent' : 'me',
    what: `Sent an application to ${job?.employer ?? company?.name ?? to}`,
    why: options.by === 'policy' ? 'Allowed by my rules for this person' : 'I pressed approve & send',
    applicationId,
    candidateId: application.candidateId,
  });

  const candidate = await db.get('candidates', application.candidateId);
  if (candidate) {
    await db.update('candidates', candidate.id, {
      applicationsSentToday: (candidate.applicationsSentToday ?? 0) + 1,
      reviewedApplicationCount: (candidate.reviewedApplicationCount ?? 0) + (options.by === 'me' ? 1 : 0),
    });
  }

  return { status: 'Applied', sent: true, to };
}
