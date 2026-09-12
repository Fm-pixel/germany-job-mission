import { guard } from '@/lib/api';
import { db } from '@/services/db';

export async function PATCH(request: Request) {
  return guard(async () => {
    const body = (await request.json()) as {
      messageId?: string;
      subject?: string;
      text?: string;
      attachments?: string[];
    };
    if (!body.messageId) throw new Error('No message given.');
    const message = await db.get('application_messages', body.messageId);
    if (!message) throw new Error('Message not found.');
    if (message.sentAt) throw new Error('This message has already been sent and cannot be edited.');
    return db.update('application_messages', body.messageId, {
      subject: body.subject ?? message.subject,
      body: body.text ?? message.body,
      attachments: body.attachments ?? message.attachments,
      editedByMe: true,
    });
  });
}
