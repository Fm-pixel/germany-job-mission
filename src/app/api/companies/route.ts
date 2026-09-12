import { guard } from '@/lib/api';
import { db } from '@/services/db';
import { safeHttpUrl } from '@/lib/safe';

export async function GET() {
  return guard(async () => db.list('companies', { limit: 500 }));
}

export async function POST(request: Request) {
  return guard(async () => {
    const body = (await request.json()) as { name?: string; contactEmail?: string; contactEvidenceUrl?: string };
    if (!body.name?.trim()) throw new Error('A company name is needed.');
    const evidence = safeHttpUrl(body.contactEvidenceUrl);
    if (body.contactEmail && !evidence) {
      throw new Error(
        'An email address may only be stored together with the page on the company’s own website where you found it, and that page must be an http(s) link.',
      );
    }
    return db.create('companies', { ...body, name: body.name.trim(), contactEvidenceUrl: evidence });
  });
}

export async function PATCH(request: Request) {
  return guard(async () => {
    const { id, ...patch } = (await request.json()) as { id?: string } & Record<string, string>;
    if (!id) throw new Error('No company given.');
    const evidence = safeHttpUrl(patch.contactEvidenceUrl);
    if (patch.contactEmail && !evidence) {
      const existing = await db.get('companies', id);
      if (!existing?.contactEvidenceUrl) {
        throw new Error(
          'An email address may only be stored together with the page on the company’s own website where you found it, and that page must be an http(s) link.',
        );
      }
    }
    return db.update('companies', id, {
      ...patch,
      ...(patch.contactEvidenceUrl !== undefined ? { contactEvidenceUrl: evidence } : {}),
      ...(patch.website !== undefined ? { website: safeHttpUrl(patch.website) } : {}),
      ...(patch.careersUrl !== undefined ? { careersUrl: safeHttpUrl(patch.careersUrl) } : {}),
    });
  });
}
