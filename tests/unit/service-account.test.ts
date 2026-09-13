import { describe, expect, it } from 'vitest';
import { parseServiceAccount } from '@/services/firebase/admin';

const KEY = {
  type: 'service_account',
  project_id: 'certifypm-pro',
  client_email: 'firebase-adminsdk-fbsvc@certifypm-pro.iam.gserviceaccount.com',
  private_key: '-----BEGIN PRIVATE KEY-----\\nABC\\n-----END PRIVATE KEY-----\\n',
};
const PLAIN = JSON.stringify(KEY);

describe('reading the service-account key however it was pasted', () => {
  it('accepts the plain JSON', () => {
    expect(parseServiceAccount(PLAIN)?.project_id).toBe('certifypm-pro');
  });

  it('accepts it wrapped in single quotes, as a shell leaves it', () => {
    expect(parseServiceAccount(`'${PLAIN}'`)?.project_id).toBe('certifypm-pro');
  });

  it('accepts it wrapped in double quotes with the inner quotes escaped', () => {
    // This is the shape that silently failed before: "{\"type\":\"service_account\"…}"
    const escaped = `"${PLAIN.replace(/"/g, '\\"')}"`;
    expect(parseServiceAccount(escaped)?.client_email).toContain('certifypm-pro');
  });

  it('accepts it base64-encoded', () => {
    expect(parseServiceAccount(Buffer.from(PLAIN).toString('base64'))?.project_id).toBe('certifypm-pro');
  });

  it('tolerates surrounding whitespace and newlines', () => {
    expect(parseServiceAccount(`\n  ${PLAIN}\n `)?.project_id).toBe('certifypm-pro');
  });

  it('refuses anything that is not a key, rather than half-working', () => {
    expect(parseServiceAccount('not json')).toBeNull();
    expect(parseServiceAccount('{"hello":"world"}')).toBeNull();
    expect(parseServiceAccount('')).toBeNull();
  });
});
