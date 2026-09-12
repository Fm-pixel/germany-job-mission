import { guard } from '@/lib/api';
import { db, type Candidate } from '@/services/db';
import { deleteCandidateCompletely } from '@/services/candidates';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return guard(async () => {
    const candidate = await db.get('candidates', id);
    if (!candidate) throw new Error('Person not found.');
    return candidate;
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return guard(async () => {
    const patch = (await request.json()) as Partial<Candidate>;
    delete patch.id;
    return db.update('candidates', id, patch);
  });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return guard(async () => deleteCandidateCompletely(id));
}
