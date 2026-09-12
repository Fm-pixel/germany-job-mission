import type { EmailProvider, SendInput, SendResult } from '../index';

/** Resend: the simpler option — one API key, no OAuth screen. */
export class ResendProvider implements EmailProvider {
  readonly key = 'resend' as const;
  readonly name = 'Resend';

  async send(input: SendInput): Promise<SendResult> {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;
    if (!apiKey || !from) {
      throw new Error('Resend is not configured (RESEND_API_KEY / EMAIL_FROM missing).');
    }
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        text: input.body,
        attachments: (input.attachments ?? []).map((a) => ({
          filename: a.filename,
          content: a.content.toString('base64'),
        })),
      }),
    });
    if (!res.ok) {
      throw new Error(`Resend refused the message: ${res.status} ${await res.text()}`);
    }
    const data = (await res.json()) as { id: string };
    return { messageId: data.id, provider: 'resend' };
  }
}
