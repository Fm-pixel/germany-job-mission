import { guard } from '@/lib/api';
import { dueFollowUps, prepareFollowUp } from '@/services/applications/followup';
import { getPolicy } from '@/services/policy';

export async function GET() {
  return guard(async () => {
    const policy = await getPolicy();
    return dueFollowUps(policy.followUpDays, policy.maxFollowUps);
  });
}

export async function POST(request: Request) {
  return guard(async () => {
    const { applicationId } = (await request.json()) as { applicationId?: string };
    if (!applicationId) throw new Error('No application given.');
    return prepareFollowUp(applicationId, { by: 'me' });
  });
}
