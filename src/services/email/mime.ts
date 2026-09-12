import type { Attachment } from './index';

/**
 * Builds the RFC 5322 message Gmail sends. Kept separate from the provider so
 * it can be tested without a Gmail account: a mistake here reaches a real
 * employer as a broken email.
 */
export interface MimeInput {
  from: string;
  to: string;
  subject: string;
  body: string;
  attachments?: Attachment[];
}

/** Headers must not carry line breaks — they would inject extra headers. */
function headerValue(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

/** Non-ASCII in a subject (umlauts, ß) has to be encoded or it arrives as noise. */
export function encodeSubject(subject: string): string {
  const clean = headerValue(subject);
  if (/^[\x20-\x7e]*$/.test(clean)) return clean;
  return `=?UTF-8?B?${Buffer.from(clean, 'utf8').toString('base64')}?=`;
}

export function buildMimeMessage(input: MimeInput): string {
  const attachments = input.attachments ?? [];
  const lines: string[] = [
    `From: ${headerValue(input.from)}`,
    `To: ${headerValue(input.to)}`,
    `Subject: ${encodeSubject(input.subject)}`,
    'MIME-Version: 1.0',
  ];

  if (attachments.length === 0) {
    lines.push('Content-Type: text/plain; charset="UTF-8"', 'Content-Transfer-Encoding: base64', '');
    lines.push(wrap(Buffer.from(input.body, 'utf8').toString('base64')));
    return lines.join('\r\n');
  }

  const boundary = `gjm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`, '');
  lines.push(
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    wrap(Buffer.from(input.body, 'utf8').toString('base64')),
    '',
  );

  for (const attachment of attachments) {
    const filename = attachment.filename.replace(/["\r\n]+/g, '_');
    lines.push(
      `--${boundary}`,
      `Content-Type: ${headerValue(attachment.mimeType || 'application/octet-stream')}; name="${filename}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${filename}"`,
      '',
      wrap(attachment.content.toString('base64')),
      '',
    );
  }

  lines.push(`--${boundary}--`, '');
  return lines.join('\r\n');
}

/** Base64 in a mail body has to be wrapped; long unbroken lines get rejected. */
function wrap(base64: string, width = 76): string {
  const out: string[] = [];
  for (let i = 0; i < base64.length; i += width) out.push(base64.slice(i, i + width));
  return out.join('\r\n');
}
