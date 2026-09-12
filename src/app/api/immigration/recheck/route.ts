import { guard } from '@/lib/api';
import { recheckAll, recheckPathway } from '@/services/immigration';
import { logAudit } from '@/services/tracking/audit';

export async function POST(request: Request) {
  return guard(async () => {
    const { pathwayKey } = (await request.json().catch(() => ({}))) as { pathwayKey?: string };
    const outcomes = pathwayKey ? await recheckPathway(pathwayKey) : await recheckAll();
    const confirmed = outcomes.filter((o) => o.label === 'CONFIRMED').length;
    const changed = outcomes.filter((o) => o.changed);
    await logAudit({
      who: 'me',
      what: 'Re-checked the official immigration sources',
      why: pathwayKey ? `Re-check for ${pathwayKey}` : 'Re-check all pathways',
      detail: `${confirmed}/${outcomes.length} requirements confirmed against the official pages; ${changed.length} pages changed since the last check`,
    });
    return { outcomes, confirmed, changedPages: changed.map((c) => c.sourceUrl) };
  });
}
