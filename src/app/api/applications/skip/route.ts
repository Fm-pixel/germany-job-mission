import { guard } from '@/lib/api';
import { setStatus } from '@/services/applications';
import { logAudit } from '@/services/tracking/audit';

export async function POST(request: Request) {
  return guard(async () => {
    const { applicationId, note } = (await request.json()) as { applicationId?: string; note?: string };
    if (!applicationId) throw new Error('No application given.');
    const application = await setStatus(applicationId, 'Rejected', {
      by: 'me',
      note: note ?? 'Skipped by me — not sent.',
    });
    await logAudit({
      who: 'me',
      what: 'Skipped an application',
      why: note ?? 'Decided not to apply',
      applicationId,
      candidateId: application.candidateId,
      outcome: 'skipped',
    });
    return application;
  });
}
