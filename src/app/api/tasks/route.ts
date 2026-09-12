import { guard } from '@/lib/api';
import { db } from '@/services/db';
import { syncTasks } from '@/services/tracking';
import { getPolicy } from '@/services/policy';

export async function GET() {
  return guard(async () => {
    const policy = await getPolicy();
    await syncTasks(policy.followUpDays);
    return db.list('tasks', { limit: 500 });
  });
}

export async function POST(request: Request) {
  return guard(async () => {
    const body = (await request.json()) as {
      title?: string;
      detail?: string;
      priority?: 'red' | 'orange' | 'green';
      candidateId?: string;
      due?: string;
      owner?: 'me' | 'candidate' | 'employer';
    };
    if (!body.title?.trim()) throw new Error('A title is needed.');
    return db.create('tasks', {
      title: body.title.trim(),
      detail: body.detail,
      priority: body.priority ?? 'green',
      candidateId: body.candidateId,
      due: body.due,
      owner: body.owner ?? 'me',
      state: 'open',
      source: 'me',
    });
  });
}

export async function PATCH(request: Request) {
  return guard(async () => {
    const { id, state, snoozeDays } = (await request.json()) as {
      id?: string;
      state?: 'open' | 'done' | 'snoozed';
      snoozeDays?: number;
    };
    if (!id) throw new Error('No task given.');
    const patch: Record<string, unknown> = { state: state ?? 'done' };
    if (state === 'snoozed') {
      patch.snoozedUntil = new Date(Date.now() + (snoozeDays ?? 7) * 86_400_000).toISOString();
    }
    return db.update('tasks', id, patch);
  });
}
