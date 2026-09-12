import { emailProvider } from '@/lib/env';
import { db, type ApplicationMessage, type EmailRecord } from '../db';
import { readDocument } from '../documents';
import { GmailProvider } from './providers/gmail';
import { ResendProvider } from './providers/resend';

export interface Attachment {
  filename: string;
  mimeType: string;
  content: Buffer;
}

export interface SendInput {
  to: string;
  subject: string;
  body: string;
  attachments?: Attachment[];
  replyToThreadId?: string;
}

export interface SendResult {
  messageId: string;
  threadId?: string;
  provider: 'gmail' | 'resend';
}

export interface EmailProvider {
  readonly key: 'gmail' | 'resend';
  readonly name: string;
  send(input: SendInput): Promise<SendResult>;
  /** Returns replies newer than the sent message, if the provider can see them. */
  fetchReplies?(threadId: string): Promise<{ from: string; body: string; receivedAt: string; messageId: string }[]>;
}

export class EmailNotConnectedError extends Error {
  readonly code = 'NOT_CONNECTED';
  constructor() {
    super(
      'No email provider is connected, so nothing was sent. The application is kept as "Approved – waiting for email connection". See SETUP_FOR_ME.md step 4.',
    );
    this.name = 'EmailNotConnectedError';
  }
}

export function activeProvider(): EmailProvider | null {
  const key = emailProvider();
  if (key === 'gmail') return new GmailProvider();
  if (key === 'resend') return new ResendProvider();
  return null;
}

export function emailConnected(): boolean {
  return activeProvider() !== null;
}

export async function attachmentsFor(message: ApplicationMessage): Promise<Attachment[]> {
  const out: Attachment[] = [];
  for (const documentId of message.attachments ?? []) {
    const doc = await db.get('documents', documentId);
    if (!doc) continue;
    out.push({
      filename: doc.filename,
      mimeType: doc.mimeType,
      content: await readDocument(documentId),
    });
  }
  return out;
}

/** The only place an email actually leaves the system. */
export async function sendEmail(
  input: SendInput,
  context: { applicationId?: string; candidateId?: string },
): Promise<{ sent: boolean; record: EmailRecord; result?: SendResult; reason?: string }> {
  const provider = activeProvider();
  if (!provider) {
    const record = await db.create('emails', {
      applicationId: context.applicationId,
      candidateId: context.candidateId,
      provider: 'none',
      direction: 'outbound',
      to: input.to,
      subject: input.subject,
      body: input.body,
    });
    return { sent: false, record, reason: new EmailNotConnectedError().message };
  }
  const result = await provider.send(input);
  const record = await db.create('emails', {
    applicationId: context.applicationId,
    candidateId: context.candidateId,
    provider: provider.key,
    direction: 'outbound',
    messageId: result.messageId,
    threadId: result.threadId,
    to: input.to,
    from: process.env.EMAIL_FROM ?? process.env.GMAIL_SENDER,
    subject: input.subject,
    body: input.body,
    sentAt: new Date().toISOString(),
  });
  return { sent: true, record, result };
}
