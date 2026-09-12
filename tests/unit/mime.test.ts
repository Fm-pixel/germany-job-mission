import { describe, expect, it } from 'vitest';
import { buildMimeMessage, encodeSubject } from '@/services/email/mime';

const GERMAN_SUBJECT = 'Bewerbung als Elektriker – Berufserfahrung aus Ruanda';

describe('the subject line', () => {
  it('encodes German punctuation and umlauts so they arrive readable', () => {
    const encoded = encodeSubject(GERMAN_SUBJECT);
    expect(encoded.startsWith('=?UTF-8?B?')).toBe(true);
    const decoded = Buffer.from(encoded.slice(10, -2), 'base64').toString('utf8');
    expect(decoded).toBe(GERMAN_SUBJECT);
  });

  it('leaves a plain ASCII subject alone', () => {
    expect(encodeSubject('Application as an electrician')).toBe('Application as an electrician');
  });

  it('never lets a line break become an extra header', () => {
    expect(encodeSubject('Hallo\r\nBcc: someone@example.com')).not.toMatch(/[\r\n]/);
  });
});

describe('the message Gmail sends', () => {
  const base = { from: 'me@example.com', to: 'jobs@mueller-elektro.de', subject: GERMAN_SUBJECT };

  it('carries the headers and the body', () => {
    const mime = buildMimeMessage({ ...base, body: 'Sehr geehrte Damen und Herren,' });
    expect(mime).toContain('From: me@example.com');
    expect(mime).toContain('To: jobs@mueller-elektro.de');
    expect(mime).toContain('MIME-Version: 1.0');
    expect(mime.split('\r\n\r\n')[0]).toContain('Content-Type: text/plain; charset="UTF-8"');
  });

  it('keeps a German body intact through base64', () => {
    const body = 'Sehr geehrte Damen und Herren,\n\nmit großem Interesse … Grüße, Jean';
    const mime = buildMimeMessage({ ...base, body });
    const encoded = mime.split('\r\n\r\n').slice(1).join('').replace(/\r\n/g, '');
    expect(Buffer.from(encoded, 'base64').toString('utf8')).toBe(body);
  });

  it('separates and labels every attachment', () => {
    const mime = buildMimeMessage({
      ...base,
      body: 'Anbei meine Unterlagen.',
      attachments: [
        { filename: 'Lebenslauf.pdf', mimeType: 'application/pdf', content: Buffer.from('%PDF-1.4 cv') },
        { filename: 'Zeugnis.pdf', mimeType: 'application/pdf', content: Buffer.from('%PDF-1.4 cert') },
      ],
    });
    const boundary = /boundary="([^"]+)"/.exec(mime)?.[1];
    expect(boundary).toBeTruthy();
    expect(mime).toContain(`--${boundary}--`);
    // one part for the text and one per attachment
    expect(mime.split(`--${boundary}`).length - 1).toBe(4);
    expect(mime).toContain('Content-Disposition: attachment; filename="Lebenslauf.pdf"');
    expect(mime).toContain('Content-Disposition: attachment; filename="Zeugnis.pdf"');
    expect(mime).toContain(Buffer.from('%PDF-1.4 cv').toString('base64'));
  });

  it('does not let a filename break out of its header', () => {
    const mime = buildMimeMessage({
      ...base,
      body: 'x',
      attachments: [
        { filename: 'cv".pdf\r\nBcc: attacker@example.com', mimeType: 'application/pdf', content: Buffer.from('x') },
      ],
    });
    // The text may survive inside the (cleaned) filename; what must never
    // happen is a new header line, or an escape out of the quoted value.
    expect(mime.split('\r\n').some((line) => line.startsWith('Bcc:'))).toBe(false);
    expect(mime).toContain('filename="cv_.pdf_Bcc: attacker@example.com"');
  });

  it('wraps long base64 so a mail server does not reject the line', () => {
    const mime = buildMimeMessage({ ...base, body: 'a'.repeat(5000) });
    const longest = Math.max(...mime.split('\r\n').map((line) => line.length));
    expect(longest).toBeLessThanOrEqual(998);
  });

  it('uses CRLF line endings throughout', () => {
    const mime = buildMimeMessage({ ...base, body: 'one\ntwo' });
    expect(mime.replace(/\r\n/g, '')).not.toMatch(/\n/);
  });
});
