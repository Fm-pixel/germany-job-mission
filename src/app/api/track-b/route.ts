import { guard } from '@/lib/api';
import { assessTrackB, createGermanPlanTasks, germanPlan, sponsorGap } from '@/services/immigration/track-b';
import { searchAndStore } from '@/services/jobs';
import { db } from '@/services/db';

export async function POST(request: Request) {
  return guard(async () => {
    const body = (await request.json()) as {
      candidateId?: string;
      action?: 'assess' | 'german-plan' | 'search-apprenticeships' | 'sponsor-gap';
      trainingPay?: number;
      requiredAmount?: number;
      where?: string;
      what?: string;
    };
    if (!body.candidateId) throw new Error('No person given.');

    switch (body.action) {
      case 'german-plan': {
        const tasks = await createGermanPlanTasks(body.candidateId);
        return { tasks, plan: germanPlan('none') };
      }
      case 'search-apprenticeships': {
        const candidate = await db.get('candidates', body.candidateId);
        if (!candidate) throw new Error('Person not found.');
        return searchAndStore(
          {
            what: body.what || candidate.preferredOccupation || candidate.profession || 'Ausbildung',
            where: body.where,
            kind: 'apprenticeship',
            size: 25,
          },
          'bundesagentur',
          { withDetail: 10 },
        );
      }
      case 'sponsor-gap':
        return sponsorGap(body.trainingPay ?? 0, body.requiredAmount ?? 0);
      default:
        return assessTrackB(body.candidateId);
    }
  });
}
