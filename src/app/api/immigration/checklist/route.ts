import { guard } from '@/lib/api';
import { buildChecklist, updateChecklistItem } from '@/services/immigration';

export async function POST(request: Request) {
  return guard(async () => {
    const { candidateId, pathwayKey } = (await request.json()) as {
      candidateId?: string;
      pathwayKey?: string;
    };
    if (!candidateId || !pathwayKey) throw new Error('Person and pathway are both needed.');
    return buildChecklist(candidateId, pathwayKey);
  });
}

export async function PATCH(request: Request) {
  return guard(async () => {
    const { id, ...patch } = (await request.json()) as { id?: string } & Record<string, never>;
    if (!id) throw new Error('No checklist item given.');
    return updateChecklistItem(id, patch);
  });
}
