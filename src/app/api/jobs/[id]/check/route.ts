import { guard } from '@/lib/api';
import { db } from '@/services/db';
import { checkJobStillActive, fetchJobDetail } from '@/services/jobs';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return guard(async () => {
    const job = await db.get('jobs', id);
    if (!job) throw new Error('Vacancy not found.');
    const url = new URL(request.url);
    if (url.searchParams.get('detail') === '1') return fetchJobDetail(job);
    return checkJobStillActive(job);
  });
}
