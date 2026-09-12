import { guard } from '@/lib/api';
import { db } from '@/services/db';
import { fitsForCandidate, seedRadar } from '@/services/opportunities';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const candidateId = url.searchParams.get('candidateId');
  return guard(async () => {
    if (candidateId) return fitsForCandidate(candidateId);
    return db.list('opportunities', { limit: 200 });
  });
}

export async function POST() {
  return guard(async () => seedRadar());
}
