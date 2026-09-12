import { guard } from '@/lib/api';
import { candidatePortalToken, revokePortalToken } from '@/services/candidates';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return guard(async () => {
    const token = await candidatePortalToken(id);
    const base = process.env.APP_URL?.replace(/\/$/, '') ?? '';
    return { token, url: `${base}/portal/${token}` };
  });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return guard(async () => {
    await revokePortalToken(id);
    return { revoked: true };
  });
}
