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
    if (body.contactEmail && !body.contactEvidenceUrl) {
      throw new Error(
        'An email address may only be stored together with the page it was found on (the company’s own website).',
      );
    }
    return db.create('companies', { name: body.name.trim(), ...body });
  });
}

export async function PATCH(request: Request) {
  return guard(async () => {
    const { id, ...patch } = (await request.json()) as { id?: string } & Record<string, string>;
    if (!id) throw new Error('No company given.');
    if (patch.contactEmail && !patch.contactEvidenceUrl) {
      const existing = await db.get('companies', id);
      if (!existing?.contactEvidenceUrl) {
        throw new Error(
          'An email address may only be stored together with the page it was found on (the company’s own website).',
        );
      }
    }
    return db.update('companies', id, patch);
  });
}
