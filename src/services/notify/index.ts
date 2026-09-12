import { db } from '../db';
import { emailConnected, sendEmail } from '../email';
import { computePriorities, daysSince } from '../tracking';
import { getPolicy } from '../policy';
import { logAudit } from '../tracking/audit';

/**
 * The daily summary and the weekly report (SPEC section 26 / prompt 19.4).
 * WhatsApp is deliberately NOT CONNECTED — the interface is here, the provider
 * is not, and the UI says so instead of pretending.
 */

export interface NotifyResult {
  sent: boolean;
  channel: 'email' | 'none';
  reason?: string;
  subject: string;
  body: string;
}

export function whatsappStatus() {
  return {
    connected: false,
    note: 'WhatsApp is NOT CONNECTED. To use it you would connect a provider (for example the WhatsApp Business API through Meta, or Twilio) and add its credentials. Until then the summary goes by email only.',
  };
}

export async function buildDailySummary(): Promise<{ subject: string; body: string }> {
  const policy = await getPolicy();
  const [priorities, applications, candidates, audit] = await Promise.all([
    computePriorities(policy.followUpDays),
    db.list('applications', { limit: 500 }),
    db.list('candidates'),
    db.list('audit_logs', { limit: 500 }),
  ]);

  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const yesterday = audit.filter((entry) => entry.at >= since);
  const nameOf = new Map(candidates.map((c) => [c.id, c.name]));

  const wants = new Set(policy.notifyAbout);
  const lines: string[] = [];

  const replies = applications.filter((a) => a.replyAt && a.replyAt >= since);
  if (wants.has('replies') || wants.has('everything')) {
    lines.push(`Replies in the last day: ${replies.length}`);
    for (const application of replies) lines.push(`  · ${nameOf.get(application.candidateId)} — ${application.status}`);
  }

  const interviews = applications.filter((a) => a.status === 'Interview' || a.status === 'Second interview');
  if (wants.has('interviews') || wants.has('everything')) {
    lines.push(`Interviews in progress: ${interviews.length}`);
  }

  const offers = applications.filter((a) => a.status === 'Offer' || a.status === 'Contract');
  if (wants.has('offers') || wants.has('everything')) {
    lines.push(`Offers and contracts: ${offers.length}`);
    for (const application of offers) lines.push(`  · ${nameOf.get(application.candidateId)} — ${application.status}`);
  }

  const deadlines = priorities.filter((p) => /deadline|overdue|due soon/i.test(p.title));
  if (wants.has('deadlines') || wants.has('everything')) {
    lines.push(`Deadlines needing attention: ${deadlines.length}`);
    for (const item of deadlines.slice(0, 8)) lines.push(`  · ${item.title}`);
  }

  const needsMe = priorities.filter((p) => p.priority === 'red' || p.priority === 'orange');
  lines.push('', `Waiting for your decision: ${needsMe.length}`);
  for (const item of needsMe.slice(0, 10)) lines.push(`  · ${item.title} — ${item.detail}`);

  lines.push('', 'What the agents did in the last day:');
  const byAgent = new Map<string, number>();
  for (const entry of yesterday) byAgent.set(entry.who, (byAgent.get(entry.who) ?? 0) + 1);
  for (const [who, count] of byAgent) lines.push(`  · ${who}: ${count} actions`);

  lines.push(
    '',
    'Nothing was sent without your approval except what your own rules in rules.md allow. Open the app to decide the rest.',
  );

  return {
    subject: `Germany Job Mission — ${needsMe.length} thing(s) need you`,
    body: lines.join('\n'),
  };
}

export async function sendDailySummary(): Promise<NotifyResult> {
  const { subject, body } = await buildDailySummary();
  const to = process.env.OWNER_EMAIL?.trim();
  if (!to || !emailConnected()) {
    await logAudit({
      who: 'Notifier',
      what: 'Prepared the daily summary',
      why: 'Daily run',
      outcome: 'skipped',
      detail: !to ? 'OWNER_EMAIL is not set' : 'No email provider connected',
    });
    return {
      sent: false,
      channel: 'none',
      reason: !to
        ? 'OWNER_EMAIL is not set, so the summary could not be sent. It is visible on the dashboard.'
        : 'No email provider is connected (SETUP_FOR_ME.md step 4).',
      subject,
      body,
    };
  }
  await sendEmail({ to, subject, body }, {});
  await logAudit({ who: 'Notifier', what: 'Sent the daily summary', why: 'Daily run' });
  return { sent: true, channel: 'email', subject, body };
}

export async function buildWeeklyReport(): Promise<{ subject: string; body: string }> {
  const [candidates, applications, jobs, companies] = await Promise.all([
    db.list('candidates'),
    db.list('applications', { limit: 500 }),
    db.list('jobs', { limit: 500 }),
    db.list('companies', { limit: 500 }),
  ]);
  const week = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
  const lines: string[] = ['Weekly report', ''];

  lines.push('People making progress:');
  for (const candidate of candidates.filter((c) => c.status === 'active')) {
    const theirs = applications.filter((a) => a.candidateId === candidate.id);
    const sent = theirs.filter((a) => a.appliedAt && a.appliedAt >= week).length;
    const replies = theirs.filter((a) => a.replyAt && a.replyAt >= week).length;
    if (sent > 0 || replies > 0) {
      lines.push(`  · ${candidate.name}: ${sent} sent, ${replies} replies this week`);
    }
  }

  lines.push('', 'People with no applications at all:');
  for (const candidate of candidates.filter((c) => c.status === 'active')) {
    if (!applications.some((a) => a.candidateId === candidate.id)) lines.push(`  · ${candidate.name}`);
  }

  lines.push('', 'Strongest new opportunities this week:');
  const newJobs = jobs.filter((job) => job.discoveredAt >= week);
  const matches = await db.list('job_matches', { limit: 500 });
  const strong = matches
    .filter((match) => newJobs.some((job) => job.id === match.jobId))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
  for (const match of strong) {
    const job = jobs.find((j) => j.id === match.jobId);
    const candidate = candidates.find((c) => c.id === match.candidateId);
    lines.push(`  · ${match.score}% — ${job?.title} at ${job?.employer} for ${candidate?.name}`);
  }

  lines.push('', 'Employers worth contacting directly:');
  for (const company of companies.filter((c) => !c.isAgency).slice(0, 8)) {
    lines.push(`  · ${company.name} (${company.location ?? 'location unknown'}) — ${company.careersUrl ?? company.website ?? 'no link stored'}`);
  }

  lines.push('', 'Nothing in this report is a promise. Every immigration statement needs confirmation by the authority.');
  return { subject: 'Germany Job Mission — weekly report', body: lines.join('\n') };
}

export async function sendWeeklyReport(): Promise<NotifyResult> {
  const { subject, body } = await buildWeeklyReport();
  const to = process.env.OWNER_EMAIL?.trim();
  if (!to || !emailConnected()) {
    return {
      sent: false,
      channel: 'none',
      reason: !to ? 'OWNER_EMAIL is not set.' : 'No email provider is connected.',
      subject,
      body,
    };
  }
  await sendEmail({ to, subject, body }, {});
  await logAudit({ who: 'Notifier', what: 'Sent the weekly report', why: 'Weekly run' });
  return { sent: true, channel: 'email', subject, body };
}

/** Everything the policy says I must decide myself. */
export async function needsMe() {
  const policy = await getPolicy();
  const priorities = await computePriorities(policy.followUpDays);
  const prepared = await db.list('applications', { where: [{ field: 'status', op: '==', value: 'Prepared' }] });
  const withDetail = [];
  for (const application of prepared) {
    const [candidate, job, message] = await Promise.all([
      db.get('candidates', application.candidateId),
      application.jobId ? db.get('jobs', application.jobId) : Promise.resolve(null),
      db.first('application_messages', {
        where: [{ field: 'applicationId', op: '==', value: application.id }],
        orderBy: { field: 'createdAt', direction: 'desc' },
      }),
    ]);
    withDetail.push({
      applicationId: application.id,
      candidateName: candidate?.name ?? 'someone',
      employer: job?.employer ?? 'a company',
      title: job?.title ?? 'speculative application',
      subject: message?.subject ?? '',
      needsInfo: message?.needsInfo ?? [],
      scamFlags: application.scamFlags ?? [],
      waitingDays: daysSince(application.createdAt) ?? 0,
    });
  }
  return { priorities, applications: withDetail, policy };
}
