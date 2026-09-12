import { db } from '@/services/db';
import type { Policy } from '@/services/policy';

/**
 * The rails no rule sentence in rules.md can switch off.
 * Every automatic send passes through here first.
 */
export interface SendDecision {
  allowed: boolean;
  reason: string;
}

export async function mayAutoSend(
  applicationId: string,
  policy: Policy,
): Promise<SendDecision> {
  const application = await db.get('applications', applicationId);
  if (!application) return { allowed: false, reason: 'The application no longer exists.' };

  if (application.scamFlags && application.scamFlags.length > 0) {
    return { allowed: false, reason: `Scam protection flagged this advert: ${application.scamFlags.join('; ')}.` };
  }

  const candidate = await db.get('candidates', application.candidateId);
  if (!candidate) return { allowed: false, reason: 'The person no longer exists.' };

  if (candidate.status !== 'active') {
    return { allowed: false, reason: `${candidate.name} is not active, so nothing is sent for them.` };
  }

  const reviewed = candidate.reviewedApplicationCount ?? 0;
  if (reviewed < policy.reviewFirstNPerPerson) {
    return {
      allowed: false,
      reason: `Your rule says the first ${policy.reviewFirstNPerPerson} applications for a new person are shown to you first (${reviewed} approved by you so far).`,
    };
  }

  const sentToday = await countSentToday(application.candidateId);
  if (sentToday >= policy.maxApplicationsPerPersonPerDay) {
    return {
      allowed: false,
      reason: `The daily cap of ${policy.maxApplicationsPerPersonPerDay} applications for ${candidate.name} is reached.`,
    };
  }

  if (policy.blockRecruitersAndAgencies && application.companyId) {
    const company = await db.get('companies', application.companyId);
    if (company?.isAgency) {
      return { allowed: false, reason: 'This is a recruiter or agency, and your rules say employers only.' };
    }
  }

  const match = application.matchId ? await db.get('job_matches', application.matchId) : null;
  if (!match) {
    return { allowed: false, reason: 'No match score on file, so the threshold cannot be applied.' };
  }
  if (match.score < policy.autoSendScoreThreshold) {
    return {
      allowed: false,
      reason: `The match is ${match.score}%, below your automatic threshold of ${policy.autoSendScoreThreshold}%.`,
    };
  }

  const message = await db.first('application_messages', {
    where: [{ field: 'applicationId', op: '==', value: applicationId }],
    orderBy: { field: 'createdAt', direction: 'desc' },
  });
  if (!message) return { allowed: false, reason: 'Nothing is written yet.' };
  if (message.needsInfo.length > 0) {
    return {
      allowed: false,
      reason: `The draft still contains missing facts (${message.needsInfo.length}), so it waits for you.`,
    };
  }

  return { allowed: true, reason: `Match ${match.score}% is at or above your threshold and all rails pass.` };
}

export async function countSentToday(candidateId: string): Promise<number> {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const applications = await db.byCandidate('applications', candidateId);
  return applications.filter((a) => a.appliedAt && a.appliedAt >= since.toISOString()).length;
}
