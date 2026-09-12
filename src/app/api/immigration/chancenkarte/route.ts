import { guard } from '@/lib/api';
import { assessChancenkarte, fetchCriteria } from '@/services/immigration';

export async function POST(request: Request) {
  return guard(async () => {
    const { candidateId, refresh } = (await request.json()) as { candidateId?: string; refresh?: boolean };
    if (!candidateId) throw new Error('No person given.');
    if (refresh) await fetchCriteria();
    return assessChancenkarte(candidateId);
  });
}
