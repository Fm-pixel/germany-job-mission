import { guard } from '@/lib/api';
import { fastestRealisticPath } from '@/services/immigration';

export async function POST(request: Request) {
  return guard(async () => {
    const { candidateId } = (await request.json()) as { candidateId?: string };
    if (!candidateId) throw new Error('No person given.');
    return fastestRealisticPath(candidateId);
  });
}
