import { guard } from '@/lib/api';
import { APPLICATION_STATUSES, type ApplicationStatus } from '@/services/db';
import { setStatus } from '@/services/applications';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return guard(async () => {
    const { status, note } = (await request.json()) as { status?: string; note?: string };
    if (!status || !APPLICATION_STATUSES.includes(status as ApplicationStatus)) {
      throw new Error(`Unknown status "${status}".`);
    }
    return setStatus(id, status as ApplicationStatus, { note, by: 'me' });
  });
}
