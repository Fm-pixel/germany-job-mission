import crypto from 'node:crypto';
import { db, type Candidate, type CandidateProfile, type LanguageLevel } from '../db';
import { deleteDocument } from '../documents';
import { logAudit } from '../tracking/audit';
import type { CvExtraction } from '../ai/cv';
import { levelFromExtraction, needsConfirmationFrom } from '../ai/cv';

export async function createCandidate(input: {
  name: string;
  country: string;
  city?: string;
  profession?: string;
  email?: string;
  phone?: string;
  birthYear?: number;
  track?: Candidate['track'];
  relocate?: boolean;
}): Promise<Candidate> {
  const candidate = await db.create('candidates', {
    name: input.name,
    country: input.country,
    city: input.city,
    profession: input.profession,
    email: input.email,
    phone: input.phone,
    birthYear: input.birthYear,
    track: input.track ?? 'unknown',
    status: 'active',
    relocate: input.relocate ?? true,
    preferredCities: [],
    preferredStates: [],
    workingTime: 'either',
  });
  await logAudit({
    who: 'me',
    what: `Added ${candidate.name} to the people I'm helping`,
    why: 'New person created in the UI',
    candidateId: candidate.id,
  });
  return candidate;
}

export async function candidatePortalToken(candidateId: string): Promise<string> {
  const candidate = await db.get('candidates', candidateId);
  if (!candidate) throw new Error('Candidate not found.');
  if (candidate.portalToken) return candidate.portalToken;
  const token = crypto.randomBytes(32).toString('base64url');
  await db.update('candidates', candidateId, {
    portalToken: token,
    portalTokenIssuedAt: new Date().toISOString(),
  });
  return token;
}

export async function revokePortalToken(candidateId: string): Promise<void> {
  await db.update('candidates', candidateId, { portalToken: undefined, portalTokenIssuedAt: undefined });
}

export async function findByPortalToken(token: string): Promise<Candidate | null> {
  if (!token || token.length < 20) return null;
  return db.first('candidates', { where: [{ field: 'portalToken', op: '==', value: token }] });
}

/** Removes a person and everything attached to them, files included. */
export async function deleteCandidateCompletely(candidateId: string): Promise<{ deleted: number }> {
  const candidate = await db.get('candidates', candidateId);
  if (!candidate) return { deleted: 0 };
  let deleted = 0;

  const documents = await db.byCandidate('documents', candidateId);
  for (const doc of documents) {
    await deleteDocument(doc.id);
    deleted += 1;
  }

  const applications = await db.byCandidate('applications', candidateId);
  for (const application of applications) {
    for (const collection of ['application_messages', 'emails', 'interviews'] as const) {
      const rows = await db.list(collection, {
        where: [{ field: 'applicationId', op: '==', value: application.id }],
      });
      for (const row of rows) {
        await db.remove(collection, row.id);
        deleted += 1;
      }
    }
    await db.remove('applications', application.id);
    deleted += 1;
  }

  for (const collection of [
    'candidate_profiles',
    'education',
    'qualifications',
    'work_experience',
    'languages',
    'job_matches',
    'visa_assessments',
    'checklist_items',
    'tasks',
    'notes',
    'offers',
    'contracts',
  ] as const) {
    const rows = await db.byCandidate(collection, candidateId);
    for (const row of rows) {
      await db.remove(collection, row.id);
      deleted += 1;
    }
  }

  await db.remove('candidates', candidateId);
  deleted += 1;

  await logAudit({
    who: 'me',
    what: `Deleted ${candidate.name} and all their data`,
    why: 'Requested deletion',
    outcome: 'ok',
    detail: `${deleted} records removed, Drive files deleted`,
  });
  return { deleted };
}

export async function getProfile(candidateId: string): Promise<CandidateProfile | null> {
  return db.first('candidate_profiles', {
    where: [{ field: 'candidateId', op: '==', value: candidateId }],
  });
}

export async function upsertProfile(
  candidateId: string,
  patch: Partial<CandidateProfile>,
): Promise<CandidateProfile> {
  const existing = await getProfile(candidateId);
  if (existing) return db.update('candidate_profiles', existing.id, patch);
  return db.create('candidate_profiles', {
    candidateId,
    skills: [],
    industries: [],
    jobTitles: [],
    confirmed: false,
    needsConfirmation: [],
    ...patch,
  } as Omit<CandidateProfile, 'id' | 'createdAt' | 'updatedAt'>);
}

export interface PendingExtraction {
  profile: Partial<CandidateProfile>;
  languages: { language: string; level: LanguageLevel | null; raw: string }[];
  education: CvExtraction['education'];
  certificates: CvExtraction['certificates'];
  workExperience: CvExtraction['workExperience'];
  needsConfirmation: { field: string; value: string; reason: string }[];
}

/** Turns a raw CV extraction into the "review before it becomes the profile" shape. */
export function toPendingExtraction(extraction: CvExtraction): PendingExtraction {
  return {
    profile: {
      summary: extraction.summary,
      profession: extraction.profession.value || undefined,
      skills: extraction.skills,
      industries: extraction.industries,
      jobTitles: extraction.jobTitles,
      yearsExperience: extraction.yearsExperience.value,
      qualificationLevel: extraction.qualificationLevel.value,
    },
    languages: extraction.languages.map((l) => ({
      language: l.language,
      level: levelFromExtraction(l.level),
      raw: l.level,
    })),
    education: extraction.education,
    certificates: extraction.certificates,
    workExperience: extraction.workExperience,
    needsConfirmation: needsConfirmationFrom(extraction),
  };
}

/** Called when I press "Confirm" — only then does extracted data become real. */
export async function applyExtraction(
  candidateId: string,
  pending: PendingExtraction,
  documentId?: string,
): Promise<CandidateProfile> {
  const profile = await upsertProfile(candidateId, {
    ...pending.profile,
    skills: pending.profile.skills ?? [],
    industries: pending.profile.industries ?? [],
    jobTitles: pending.profile.jobTitles ?? [],
    confirmed: true,
    needsConfirmation: pending.needsConfirmation,
    extractedFromDocumentId: documentId,
    extractedAt: new Date().toISOString(),
  });

  for (const lang of pending.languages) {
    if (!lang.level) continue;
    const existing = await db.first('languages', {
      where: [
        { field: 'candidateId', op: '==', value: candidateId },
        { field: 'language', op: '==', value: lang.language },
      ],
    });
    if (existing) await db.update('languages', existing.id, { level: lang.level });
    else await db.create('languages', { candidateId, language: lang.language, level: lang.level });
  }

  for (const item of pending.education) {
    await db.create('education', {
      candidateId,
      school: item.school,
      degree: item.degree || undefined,
      field: item.field || undefined,
      country: item.country || undefined,
      graduationYear: item.graduationYear ?? undefined,
      level: item.level,
    });
  }

  for (const item of pending.certificates) {
    await db.create('qualifications', {
      candidateId,
      title: item.title,
      issuer: item.issuer || undefined,
      country: item.country || undefined,
      year: item.year ?? undefined,
      type: item.type,
      recognitionStatus: 'unknown',
    });
  }

  for (const item of pending.workExperience) {
    await db.create('work_experience', {
      candidateId,
      employer: item.employer,
      title: item.title,
      from: item.from || undefined,
      to: item.to || undefined,
      country: item.country || undefined,
      description: item.description || undefined,
    });
  }

  const candidate = await db.get('candidates', candidateId);
  if (candidate) {
    const patch: Partial<Candidate> = {};
    if (!candidate.profession && pending.profile.profession) patch.profession = pending.profile.profession;
    if (candidate.track === 'unknown') {
      patch.track = pending.profile.qualificationLevel === 'none' ? 'B-apprenticeship' : 'A-skilled';
    }
    if (Object.keys(patch).length > 0) await db.update('candidates', candidateId, patch);
  }

  await logAudit({
    who: 'me',
    what: 'Confirmed the extracted CV data',
    why: 'The extracted fields were reviewed and accepted',
    candidateId,
  });

  return profile;
}
