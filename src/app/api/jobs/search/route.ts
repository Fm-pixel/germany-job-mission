import { guard } from '@/lib/api';
import { db } from '@/services/db';
import { queryForCandidate, searchAndStore, type JobSearchQuery } from '@/services/jobs';
import { logAudit } from '@/services/tracking/audit';

export async function POST(request: Request) {
  return guard(async () => {
    const body = (await request.json()) as {
      candidateId?: string;
      what?: string;
      where?: string;
      radiusKm?: number;
      kind?: 'job' | 'apprenticeship';
      size?: number;
      withDetail?: number;
    };

    let query: JobSearchQuery = {
      what: body.what,
      where: body.where,
      radiusKm: body.radiusKm,
      kind: body.kind,
      size: body.size ?? 25,
    };

    if (body.candidateId) {
      const candidate = await db.get('candidates', body.candidateId);
      if (!candidate) throw new Error('Person not found.');
      query = { ...queryForCandidate(candidate, query), size: query.size };
    }
    if (!query.what?.trim()) {
      throw new Error('Say which occupation to search for (the person has none stored yet).');
    }

    const result = await searchAndStore(query, 'bundesagentur', { withDetail: body.withDetail ?? 10 });
    await logAudit({
      who: 'me',
      what: `Searched the Bundesagentur job API for "${query.what}"`,
      why: body.candidateId ? `Job search for candidate ${body.candidateId}` : 'Manual search',
      candidateId: body.candidateId,
      outcome: result.sourceConnected ? 'ok' : 'error',
      detail: result.sourceConnected
        ? `${result.jobs.length} vacancies (${result.newCount} new) of ${result.total}`
        : result.sourceError,
    });
    return result;
  });
}
