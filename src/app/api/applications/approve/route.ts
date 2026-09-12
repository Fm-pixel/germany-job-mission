import { guard } from '@/lib/api';
import { approveAndSend } from '@/services/applications/send';

export async function POST(request: Request) {
  return guard(async () => {
    const { applicationId, to } = (await request.json()) as { applicationId?: string; to?: string };
    if (!applicationId) throw new Error('No application given.');
    return approveAndSend(applicationId, { by: 'me', to });
  });
}
