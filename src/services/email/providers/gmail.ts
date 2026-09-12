import { google } from 'googleapis';
import { buildMimeMessage } from '../mime';
import type { EmailProvider, SendInput, SendResult } from '../index';

/** Gmail through OAuth on the owner's own account. */
export class GmailProvider implements EmailProvider {
  readonly key = 'gmail' as const;
  readonly name = 'Gmail';

  private client() {
    const { GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN } = process.env;
    if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN) {
      throw new Error('Gmail is not configured (client id, secret or refresh token missing).');
    }
    const auth = new google.auth.OAuth2(GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET);
    auth.setCredentials({ refresh_token: GMAIL_REFRESH_TOKEN });
    return google.gmail({ version: 'v1', auth });
  }

  async send(input: SendInput): Promise<SendResult> {
    const gmail = this.client();
    const from = process.env.GMAIL_SENDER || process.env.EMAIL_FROM || 'me';
    const raw = Buffer.from(
      buildMimeMessage({
        from,
        to: input.to,
        subject: input.subject,
        body: input.body,
        attachments: input.attachments,
      }),
      'utf8',
    ).toString('base64url');
    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw, threadId: input.replyToThreadId },
    });
    if (!res.data.id) throw new Error('Gmail did not return a message ID.');
    return { messageId: res.data.id, threadId: res.data.threadId ?? undefined, provider: 'gmail' };
  }

  async fetchReplies(threadId: string) {
    const gmail = this.client();
    const thread = await gmail.users.threads.get({ userId: 'me', id: threadId, format: 'full' });
    const out: { from: string; body: string; receivedAt: string; messageId: string }[] = [];
    for (const message of thread.data.messages ?? []) {
      const headers = message.payload?.headers ?? [];
      const from = headers.find((h) => h.name?.toLowerCase() === 'from')?.value ?? '';
      const isFromMe = (message.labelIds ?? []).includes('SENT');
      if (isFromMe) continue;
      out.push({
        from,
        body: readPlainText(message.payload) ?? message.snippet ?? '',
        receivedAt: message.internalDate
          ? new Date(Number(message.internalDate)).toISOString()
          : new Date().toISOString(),
        messageId: message.id ?? '',
      });
    }
    return out;
  }
}

type Part = { mimeType?: string | null; body?: { data?: string | null } | null; parts?: Part[] };

function readPlainText(payload?: Part | null): string | null {
  if (!payload) return null;
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64').toString('utf8');
  }
  for (const part of payload.parts ?? []) {
    const found = readPlainText(part);
    if (found) return found;
  }
  return null;
}
