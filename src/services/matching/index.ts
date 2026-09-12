import { z } from 'zod';
import { db, type Candidate, type Job, type JobMatch, type MatchExplanationItem } from '../db';
import { asUntrustedContent } from '@/lib/safe';
import { aiAvailable, askJson } from '../ai/client';
import { recommendedActionFromScore, scoreMatch, type ScoreResult } from './score';

export * from './score';

const AiExplanationSchema = z.object({
  positives: z.array(z.string()).describe('Short ✓ points, each one drawn from the advert AND the profile.'),
  warnings: z.array(z.string()).describe('Short ⚠ points: what the advert asks for and the person does not have.'),
  recommendedAction: z.enum(['APPLY', 'PREPARE FIRST', 'SKIP']),
  reason: z.string().describe('One sentence explaining the recommended action.'),
});

export async function candidateContext(candidateId: string) {
  const [candidate, profile, languages, qualifications, experience, education] = await Promise.all([
    db.get('candidates', candidateId),
    db.first('candidate_profiles', { where: [{ field: 'candidateId', op: '==', value: candidateId }] }),
    db.byCandidate('languages', candidateId),
    db.byCandidate('qualifications', candidateId),
    db.byCandidate('work_experience', candidateId),
    db.byCandidate('education', candidateId),
  ]);
  if (!candidate) throw new Error('Candidate not found.');
  return { candidate, profile, languages, qualifications, experience, education };
}

function profileSummaryForAi(ctx: Awaited<ReturnType<typeof candidateContext>>): string {
  const { candidate, profile, languages, qualifications, experience, education } = ctx;
  return [
    `Name: ${candidate.name}`,
    `Country: ${candidate.country}${candidate.city ? `, ${candidate.city}` : ''}`,
    `Profession: ${profile?.profession ?? candidate.profession ?? 'unknown'}`,
    `Years of experience: ${profile?.yearsExperience ?? 'unknown'}`,
    `Qualification level: ${profile?.qualificationLevel ?? 'unknown'}`,
    `Skills: ${(profile?.skills ?? []).join(', ') || 'unknown'}`,
    `Languages: ${languages.map((l) => `${l.language} ${l.level}`).join(', ') || 'unknown'}`,
    `Qualifications: ${qualifications.map((q) => `${q.title} (${q.country ?? '?'} ${q.year ?? '?'})`).join('; ') || 'none recorded'}`,
    `Education: ${education.map((e) => `${e.degree ?? e.level ?? 'course'} — ${e.school}`).join('; ') || 'none recorded'}`,
    `Work history: ${experience.map((w) => `${w.title} at ${w.employer} (${w.from ?? '?'}–${w.to ?? 'now'})`).join('; ') || 'none recorded'}`,
    `Willing to relocate: ${candidate.relocate ? 'yes' : 'not stated as yes'}`,
    `Preferred places: ${[...(candidate.preferredCities ?? []), ...(candidate.preferredStates ?? [])].join(', ') || 'any'}`,
  ].join('\n');
}

async function aiExplain(
  ctx: Awaited<ReturnType<typeof candidateContext>>,
  job: Job,
  rule: ScoreResult,
): Promise<{ explanation: MatchExplanationItem[]; action: JobMatch['recommendedAction']; reason: string } | null> {
  if (!aiAvailable()) return null;
  if (!job.description) return null;
  try {
    const result = await askJson(
      AiExplanationSchema,
      [
        {
          type: 'text' as const,
          text: `Compare this person with this German vacancy. Use ONLY what is written below — never assume experience, qualifications or language levels that are not stated.

PERSON
${profileSummaryForAi(ctx)}

VACANCY (source: ${job.source}, ${job.url})
Title: ${job.title}
Employer: ${job.employer}
Location: ${job.location ?? 'not stated'}
Salary as advertised: ${job.salary ?? 'not stated'}
${asUntrustedContent('untrusted-job-advert', (job.description ?? '').slice(0, 12000))}

Rule-based score already computed: ${rule.score}/100.
${rule.germanGap ? `The advert names German ${rule.germanGap.required}; the person has ${rule.germanGap.has}. This MUST appear as a warning.` : ''}

Write short ✓ points and ⚠ points as a recruiter would — each one concrete and traceable to the text above. Then recommend APPLY, PREPARE FIRST or SKIP with one sentence.`,
        },
      ],
      { maxTokens: 2000 },
    );
    const explanation: MatchExplanationItem[] = [
      ...result.positives.map((text) => ({ kind: 'positive' as const, text })),
      ...result.warnings.map((text) => ({ kind: 'warning' as const, text })),
    ];
    return { explanation, action: result.recommendedAction, reason: result.reason };
  } catch {
    return null;
  }
}

/** Guarantee from CLAUDE.md / SPEC: a German gap is never hidden. */
function ensureGermanWarning(
  explanation: MatchExplanationItem[],
  gap?: ScoreResult['germanGap'],
): MatchExplanationItem[] {
  if (!gap) return explanation;
  const already = explanation.some(
    (item) => item.kind === 'warning' && /german|deutsch/i.test(item.text) && item.text.includes(gap.required),
  );
  if (already) return explanation;
  return [
    ...explanation,
    { kind: 'warning', text: `Employer asks for German ${gap.required}, candidate has ${gap.has}` },
  ];
}

export async function matchCandidateToJob(
  ctx: Awaited<ReturnType<typeof candidateContext>>,
  job: Job,
  options: { useAi?: boolean } = {},
): Promise<JobMatch> {
  const rule = scoreMatch({
    candidate: ctx.candidate,
    profile: ctx.profile,
    languages: ctx.languages,
    job,
  });
  const fallbackAction = recommendedActionFromScore(rule.score, rule.germanGap);
  const ai = options.useAi === false ? null : await aiExplain(ctx, job, rule);
  const explanation = ensureGermanWarning(ai?.explanation ?? rule.ruleExplanation, rule.germanGap);

  const payload = {
    candidateId: ctx.candidate.id,
    jobId: job.id,
    score: rule.score,
    breakdown: rule.breakdown,
    explanation,
    recommendedAction: ai?.action ?? fallbackAction.action,
    actionReason: ai?.reason ?? fallbackAction.reason,
    aiExplained: Boolean(ai),
    generatedAt: new Date().toISOString(),
  };

  const existing = await db.first('job_matches', {
    where: [
      { field: 'candidateId', op: '==', value: ctx.candidate.id },
      { field: 'jobId', op: '==', value: job.id },
    ],
  });
  if (existing) return db.update('job_matches', existing.id, payload);
  return db.create('job_matches', payload);
}

export async function matchCandidateToStoredJobs(
  candidateId: string,
  options: { limit?: number; useAi?: boolean; aiTopN?: number } = {},
): Promise<JobMatch[]> {
  const ctx = await candidateContext(candidateId);
  const kind = ctx.candidate.track === 'B-apprenticeship' ? 'apprenticeship' : 'job';
  const jobs = await db.list('jobs', {
    where: [
      { field: 'active', op: '==', value: true },
      { field: 'kind', op: '==', value: kind },
    ],
    limit: options.limit ?? 200,
  });

  // Cheap rule score for everything, AI explanation only for the strongest.
  const scored = jobs
    .map((job) => ({
      job,
      rule: scoreMatch({ candidate: ctx.candidate, profile: ctx.profile, languages: ctx.languages, job }),
    }))
    .sort((a, b) => b.rule.score - a.rule.score);

  const aiTopN = options.useAi === false ? 0 : (options.aiTopN ?? 10);
  const out: JobMatch[] = [];
  for (const [index, entry] of scored.entries()) {
    out.push(await matchCandidateToJob(ctx, entry.job, { useAi: index < aiTopN }));
  }
  return out.sort((a, b) => b.score - a.score);
}

export async function topMatches(candidateId: string, limit = 10): Promise<{ match: JobMatch; job: Job | null }[]> {
  const matches = await db.byCandidate('job_matches', candidateId);
  const sorted = matches
    .filter((m) => !m.dismissed)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return Promise.all(
    sorted.map(async (match) => ({ match, job: await db.get('jobs', match.jobId) })),
  );
}

export function candidateProfileText(ctx: Awaited<ReturnType<typeof candidateContext>>): string {
  return profileSummaryForAi(ctx);
}
