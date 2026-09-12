import { guard } from '@/lib/api';
import { prepareApplicationForMatch } from '@/services/applications';

export async function POST(request: Request) {
  return guard(async () => {
    const { matchId } = (await request.json()) as { matchId?: string };
    if (!matchId) throw new Error('No match given.');
    return prepareApplicationForMatch(matchId);
  });
}
