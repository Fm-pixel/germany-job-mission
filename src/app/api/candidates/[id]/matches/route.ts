import { guard } from '@/lib/api';
import { matchCandidateToStoredJobs, topMatches } from '@/services/matching';
import { logAudit } from '@/services/tracking/audit';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return guard(async () => topMatches(id, 50));
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return guard(async () => {
    const body = (await request.json().catch(() => ({}))) as { aiTopN?: number };
    const matches = await matchCandidateToStoredJobs(id, { aiTopN: body.aiTopN ?? 10 });
    await logAudit({
      who: 'me',
      what: 'Recalculated the matches',
      why: 'Find matches pressed',
      candidateId: id,
      detail: `${matches.length} vacancies scored`,
    });
    return matches.slice(0, 50);
  });
}
