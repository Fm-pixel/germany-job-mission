import { guard } from '@/lib/api';
import { getPolicy, policyMeta, refreshPolicy } from '@/services/policy';
import { connectionStates } from '@/lib/env';
import { checkDriveConnection } from '@/services/documents';
import { whatsappStatus } from '@/services/notify';

export async function GET() {
  return guard(async () => ({
    policy: await getPolicy(),
    meta: await policyMeta(),
    connections: connectionStates(),
    whatsapp: whatsappStatus(),
  }));
}

export async function POST(request: Request) {
  return guard(async () => {
    const { action } = (await request.json().catch(() => ({}))) as { action?: string };
    if (action === 'test-drive') return checkDriveConnection();
    return { policy: await refreshPolicy() };
  });
}
