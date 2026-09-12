import { db, type Application, type Candidate, type Task } from '../db';

export * from './audit';

export interface DashboardStats {
  people: number;
  activeApplications: number;
  interviews: number;
  offers: number;
  contracts: number;
  sent: number;
  replies: number;
  waitingForApproval: number;
}

const ACTIVE_STATUSES = [
  'Prepared',
  'Approved',
  'Applied',
  'Employer viewed',
  'Reply received',
  'Interview',
  'Second interview',
  'Offer',
];

export async function dashboardStats(): Promise<DashboardStats> {
  const [candidates, applications] = await Promise.all([
    db.list('candidates'),
    db.list('applications'),
  ]);
  const count = (predicate: (a: Application) => boolean) => applications.filter(predicate).length;
  return {
    people: candidates.filter((c) => c.status !== 'archived').length,
    activeApplications: count((a) => ACTIVE_STATUSES.includes(a.status)),
    interviews: count((a) => a.status === 'Interview' || a.status === 'Second interview'),
    offers: count((a) => a.status === 'Offer'),
    contracts: count((a) => a.status === 'Contract'),
    sent: count((a) => Boolean(a.appliedAt)),
    replies: count((a) => Boolean(a.replyAt)),
    waitingForApproval: count((a) => a.status === 'Prepared'),
  };
}

export interface CandidateStats {
  applications: number;
  sent: number;
  replies: number;
  interviews: number;
  offers: number;
  contracts: number;
}

export async function candidateStats(candidateId: string): Promise<CandidateStats> {
  const applications = await db.byCandidate('applications', candidateId);
  return {
    applications: applications.length,
    sent: applications.filter((a) => Boolean(a.appliedAt)).length,
    replies: applications.filter((a) => Boolean(a.replyAt)).length,
    interviews: applications.filter((a) => a.status === 'Interview' || a.status === 'Second interview').length,
    offers: applications.filter((a) => a.status === 'Offer').length,
    contracts: applications.filter((a) => a.status === 'Contract').length,
  };
}

export function daysSince(iso?: string): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

export interface PriorityItem {
  key: string;
  priority: Task['priority'];
  title: string;
  detail: string;
  link?: string;
  candidateId?: string;
  applicationId?: string;
}

/**
 * "What should I do today?" — computed from the data, never from a fixed list.
 */
export async function computePriorities(followUpDays = 10): Promise<PriorityItem[]> {
  const [candidates, applications, documents, interviews, checklistItems, opportunities] = await Promise.all([
    db.list('candidates'),
    db.list('applications'),
    db.list('documents'),
    db.list('interviews'),
    db.list('checklist_items'),
    db.list('opportunities'),
  ]);
  const activeCandidates = candidates.filter((c) => c.status === 'active');
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const items: PriorityItem[] = [];

  for (const application of applications) {
    const candidate = byId.get(application.candidateId);
    const name = candidate?.name ?? 'Someone';
    const job = application.jobId ? undefined : undefined;
    void job;

    if (application.status === 'Prepared') {
      items.push({
        key: `approve-${application.id}`,
        priority: 'orange',
        title: `Approve or skip an application for ${name}`,
        detail: 'A draft is written and waiting for your decision. Nothing is sent until you press approve.',
        link: '/applications/review',
        candidateId: application.candidateId,
        applicationId: application.id,
      });
    }

    if (application.status === 'Applied' && !application.replyAt) {
      const days = daysSince(application.appliedAt);
      if (days !== null && days >= followUpDays && application.followUpCount === 0) {
        items.push({
          key: `followup-${application.id}`,
          priority: 'red',
          title: `Follow up on ${name}'s application`,
          detail: `Sent ${days} days ago with no reply. Suggested action: SEND FOLLOW-UP.`,
          link: '/applications/review',
          candidateId: application.candidateId,
          applicationId: application.id,
        });
      }
    }

    if (application.status === 'Reply received') {
      items.push({
        key: `reply-${application.id}`,
        priority: 'red',
        title: `An employer replied about ${name}`,
        detail: 'Read the reply and decide the next step.',
        link: `/applications/${application.id}`,
        candidateId: application.candidateId,
        applicationId: application.id,
      });
    }

    if (application.status === 'Offer' || application.status === 'Contract') {
      items.push({
        key: `immigration-${application.id}`,
        priority: 'red',
        title: `${name} has ${application.status === 'Offer' ? 'an offer' : 'a contract'} — start the visa file`,
        detail: 'The immigration pathway can now be determined from real data.',
        link: `/people/${application.candidateId}/immigration`,
        candidateId: application.candidateId,
        applicationId: application.id,
      });
    }
  }

  for (const interview of interviews) {
    const days = interview.scheduledAt
      ? Math.floor((new Date(interview.scheduledAt).getTime() - Date.now()) / 86_400_000)
      : null;
    if (days !== null && days >= 0 && days <= 7) {
      const name = byId.get(interview.candidateId)?.name ?? 'Someone';
      items.push({
        key: `interview-${interview.id}`,
        priority: 'red',
        title: `Interview for ${name} in ${days} day(s)`,
        detail: 'Open the interview preparation pack and go through it together.',
        link: `/people/${interview.candidateId}/interviews`,
        candidateId: interview.candidateId,
      });
    }
  }

  for (const candidate of activeCandidates) {
    const theirApplications = applications.filter((a) => a.candidateId === candidate.id);
    if (theirApplications.length === 0) {
      items.push({
        key: `noapps-${candidate.id}`,
        priority: 'orange',
        title: `${candidate.name} has no applications yet`,
        detail: 'Run a job search and generate the first matches.',
        link: `/people/${candidate.id}`,
        candidateId: candidate.id,
      });
    }
    const theirDocuments = documents.filter((d) => d.candidateId === candidate.id);
    if (!theirDocuments.some((d) => d.type === 'CV')) {
      items.push({
        key: `nocv-${candidate.id}`,
        priority: 'orange',
        title: `${candidate.name} has no CV on file`,
        detail: 'Upload the CV so the profile can be extracted and applications can be written.',
        link: `/people/${candidate.id}/documents`,
        candidateId: candidate.id,
      });
    }
  }

  for (const item of checklistItems) {
    if (item.status === 'done' || item.status === 'not-applicable' || !item.deadline) continue;
    const days = Math.floor((new Date(item.deadline).getTime() - Date.now()) / 86_400_000);
    if (days <= 14) {
      const name = byId.get(item.candidateId)?.name ?? 'Someone';
      items.push({
        key: `checklist-${item.id}`,
        priority: days < 0 ? 'red' : 'orange',
        title: `${days < 0 ? 'Overdue' : 'Due soon'}: ${item.title} (${name})`,
        detail: `Owner: ${item.owner}. Deadline ${item.deadline}.`,
        link: `/people/${item.candidateId}/immigration`,
        candidateId: item.candidateId,
      });
    }
  }

  for (const opportunity of opportunities) {
    if (opportunity.status !== 'open' || !opportunity.nextDeadline) continue;
    const days = Math.floor((new Date(opportunity.nextDeadline).getTime() - Date.now()) / 86_400_000);
    if (days >= 0 && days <= 30) {
      items.push({
        key: `opportunity-${opportunity.id}`,
        priority: 'orange',
        title: `Open call: ${opportunity.name} — deadline ${opportunity.nextDeadline}`,
        detail: `${opportunity.organiser}. Check who fits.`,
        link: '/opportunities',
      });
    }
  }

  const order: Record<Task['priority'], number> = { red: 0, orange: 1, green: 2 };
  return items.sort((a, b) => order[a.priority] - order[b.priority]);
}

/** Mirrors the computed priorities into the tasks table so they can be snoozed. */
export async function syncTasks(followUpDays = 10): Promise<Task[]> {
  const priorities = await computePriorities(followUpDays);
  const existing = await db.list('tasks');
  const out: Task[] = [];
  for (const item of priorities) {
    const already = existing.find((t) => t.link === item.link && t.title === item.title);
    if (already) {
      if (already.state === 'snoozed' && already.snoozedUntil && already.snoozedUntil > new Date().toISOString()) {
        continue;
      }
      out.push(already);
      continue;
    }
    out.push(
      await db.create('tasks', {
        title: item.title,
        detail: item.detail,
        priority: item.priority,
        candidateId: item.candidateId,
        applicationId: item.applicationId,
        owner: 'me',
        state: 'open',
        source: 'system',
        link: item.link,
      }),
    );
  }
  return out;
}

export function candidateHeadline(candidate: Candidate): string {
  return [candidate.profession, candidate.country].filter(Boolean).join(' · ');
}
