import { guard } from '@/lib/api';
import { db, type Candidate, type CandidateProfile } from '@/services/db';
import { getProfile, upsertProfile } from '@/services/candidates';

interface ProfilePayload {
  candidate?: Partial<Candidate>;
  profile?: Partial<CandidateProfile>;
  languages?: { language: string; level: string; certificate?: string }[];
  education?: { school: string; degree?: string; field?: string; country?: string; graduationYear?: number; level?: string }[];
  qualifications?: { title: string; issuer?: string; country?: string; year?: number; type?: string }[];
  workExperience?: { employer: string; title: string; from?: string; to?: string; country?: string; description?: string }[];
}

async function replaceAll<C extends 'languages' | 'education' | 'qualifications' | 'work_experience'>(
  collection: C,
  candidateId: string,
  rows: Record<string, unknown>[],
) {
  const existing = await db.byCandidate(collection, candidateId);
  for (const row of existing) await db.remove(collection, row.id);
  for (const row of rows) {
    await db.create(collection, { ...row, candidateId } as never);
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return guard(async () => ({
    candidate: await db.get('candidates', id),
    profile: await getProfile(id),
    languages: await db.byCandidate('languages', id),
    education: await db.byCandidate('education', id),
    qualifications: await db.byCandidate('qualifications', id),
    workExperience: await db.byCandidate('work_experience', id),
  }));
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return guard(async () => {
    const body = (await request.json()) as ProfilePayload;
    if (body.candidate) {
      const patch = { ...body.candidate };
      delete patch.id;
      await db.update('candidates', id, patch);
    }
    if (body.profile) await upsertProfile(id, body.profile);
    if (body.languages) {
      await replaceAll('languages', id, body.languages.filter((l) => l.language.trim()) as never);
    }
    if (body.education) {
      await replaceAll('education', id, body.education.filter((e) => e.school.trim()) as never);
    }
    if (body.qualifications) {
      await replaceAll('qualifications', id, body.qualifications.filter((q) => q.title.trim()) as never);
    }
    if (body.workExperience) {
      await replaceAll('work_experience', id, body.workExperience.filter((w) => w.employer.trim()) as never);
    }
    return { saved: true };
  });
}
