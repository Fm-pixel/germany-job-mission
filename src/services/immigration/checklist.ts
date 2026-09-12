import { db, type ChecklistItem } from '../db';
import { PATHWAYS } from './pathways';
import { storedRequirements } from './recheck';

/** Builds the personalised visa checklist from the chosen pathway. */
export async function buildChecklist(candidateId: string, pathwayKey: string): Promise<ChecklistItem[]> {
  const pathway = PATHWAYS.find((p) => p.key === pathwayKey);
  if (!pathway) throw new Error(`Unknown pathway "${pathwayKey}".`);
  const stored = await storedRequirements(pathwayKey);
  const existing = await db.byCandidate('checklist_items', candidateId);

  const out: ChecklistItem[] = [];
  for (const title of pathway.documents) {
    const already = existing.find((item) => item.title === title && item.pathwayKey === pathwayKey);
    if (already) {
      out.push(already);
      continue;
    }
    const requirement = stored.find((s) => s.text.toLowerCase().includes(title.toLowerCase().split(' ')[0]));
    out.push(
      await db.create('checklist_items', {
        candidateId,
        pathwayKey,
        title,
        status: 'open',
        owner: ownerFor(title),
        label: requirement?.label ?? 'LIKELY-NEEDS-CONFIRMATION',
        sourceUrl: requirement?.sourceUrl ?? pathway.sourceUrl,
      }),
    );
  }
  return out;
}

function ownerFor(title: string): ChecklistItem['owner'] {
  const t = title.toLowerCase();
  if (t.includes('contract') || t.includes('employer')) return 'employer';
  if (t.includes('passport') || t.includes('certificate') || t.includes('photo') || t.includes('cv')) return 'candidate';
  return 'me';
}

export async function updateChecklistItem(
  id: string,
  patch: Partial<Pick<ChecklistItem, 'status' | 'owner' | 'deadline' | 'notes' | 'documentId'>>,
): Promise<ChecklistItem> {
  return db.update('checklist_items', id, patch);
}
