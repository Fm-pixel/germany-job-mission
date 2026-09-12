import { guard } from '@/lib/api';
import { db } from '@/services/db';
import { createCandidate } from '@/services/candidates';

export async function GET() {
  return guard(async () => db.list('candidates'));
}

export async function POST(request: Request) {
  return guard(async () => {
    const body = (await request.json()) as {
      name?: string;
      country?: string;
      city?: string;
      profession?: string;
      email?: string;
      phone?: string;
      birthYear?: number;
      relocate?: boolean;
      consentConfirmed?: boolean;
    };
    if (!body.name?.trim() || !body.country?.trim()) {
      throw new Error('Name and country are required.');
    }
    const candidate = await createCandidate({
      name: body.name.trim(),
      country: body.country.trim(),
      city: body.city,
      profession: body.profession,
      email: body.email,
      phone: body.phone,
      birthYear: body.birthYear,
      relocate: body.relocate,
    });
    if (body.consentConfirmed) {
      await db.update('candidates', candidate.id, { consentConfirmed: true });
    }
    return candidate;
  });
}
