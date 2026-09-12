import { Card, Pill } from '@/components/ui';
import { connectionStates } from '@/lib/env';
import { getPolicy, policyMeta, rulesPath } from '@/services/policy';
import { recentAudit } from '@/services/tracking/audit';
import { AGENTS } from '@/agents';
import { whatsappStatus } from '@/services/notify';
import { formatDateTime } from '@/lib/format';
import { SettingsActions } from './actions';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const [policy, meta, audit] = await Promise.all([getPolicy(), policyMeta(), recentAudit(60)]);
  const connections = connectionStates();
  const whatsapp = whatsappStatus();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          What is connected, how your rules were understood, and what the agents have been doing.
        </p>
      </header>

      <Card title="Connections">
        <ul className="divide-y divide-slate-100">
          {[...connections, { key: 'wa', name: 'WhatsApp notifications', connected: whatsapp.connected, detail: whatsapp.note, setupStep: '-' }].map(
            (connection) => (
              <li key={connection.key} className="flex items-start justify-between gap-4 py-3">
                <div>
                  <div className="text-sm font-medium text-slate-900">{connection.name}</div>
                  <div className="text-sm text-slate-500">{connection.detail}</div>
                </div>
                <Pill tone={connection.connected ? 'green' : 'yellow'}>
                  {connection.connected ? 'connected' : 'NOT CONNECTED'}
                </Pill>
              </li>
            ),
          )}
        </ul>
        <SettingsActions />
      </Card>

      <Card title="How your rules were understood">
        <p className="text-sm text-slate-500">
          Edit <code>{rulesPath().split('/').slice(-1)[0]}</code> in plain English and commit it. This page shows what
          the agents actually do with it.
        </p>
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          <div>
            <div className="section-title">Your sentences</div>
            <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
              {meta.rulesText || 'rules.md is empty.'}
            </pre>
          </div>
          <div>
            <div className="section-title">
              Understood as {meta.parsedBy === 'ai' ? '(read by the AI)' : '(read by the built-in parser)'}
            </div>
            <ul className="mt-2 space-y-1 text-sm text-slate-700">
              {policy.interpretation.map((line, index) => (
                <li key={index}>· {line}</li>
              ))}
            </ul>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <Row label="Automatic send at" value={policy.autoSendScoreThreshold > 100 ? 'never' : `${policy.autoSendScoreThreshold}%`} />
              <Row label="Review first N per person" value={String(policy.reviewFirstNPerPerson)} />
              <Row label="Follow up after" value={`${policy.followUpDays} days`} />
              <Row label="Max follow-ups" value={String(policy.maxFollowUps)} />
              <Row label="Daily cap per person" value={String(policy.maxApplicationsPerPersonPerDay)} />
              <Row label="Recruiters blocked" value={policy.blockRecruitersAndAgencies ? 'yes' : 'no'} />
              <Row label="Money needs you" value="always (cannot be switched off)" />
              <Row label="Tell me about" value={policy.notifyAbout.join(', ')} />
            </dl>
            {policy.unparsedSentences.length > 0 && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <strong>Not understood as a rule:</strong>
                <ul className="mt-1 list-disc pl-4">
                  {policy.unparsedSentences.map((sentence, index) => (
                    <li key={index}>{sentence}</li>
                  ))}
                </ul>
              </div>
            )}
            <p className="mt-3 text-xs text-slate-500">
              Parsed {meta.parsedAt ? formatDateTime(meta.parsedAt) : 'just now'}.
            </p>
          </div>
        </div>
      </Card>

      <Card title="Safety rails that no rule can switch off">
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
          <li>Never invent a fact about a person, a job, a company or a contact.</li>
          <li>Never send to a contact flagged by the scam protection.</li>
          <li>Never exceed the daily cap per person.</li>
          <li>Never spend money — anything with a cost waits for you.</li>
          <li>Never send a draft that still contains a missing fact.</li>
          <li>Always write every action to the audit log below.</li>
        </ul>
      </Card>

      <Card title="Agents">
        <ul className="divide-y divide-slate-100">
          {AGENTS.map((agent) => (
            <li key={agent.key} className="py-2">
              <div className="text-sm font-medium text-slate-900">{agent.name}</div>
              <div className="text-sm text-slate-500">{agent.description}</div>
              <div className="text-xs text-slate-400">runs every {agent.everyHours} hours</div>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Audit log">
        <ul className="divide-y divide-slate-100 text-sm">
          {audit.map((entry) => (
            <li key={entry.id} className="py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-slate-900">
                  {entry.who}: {entry.what}
                </span>
                <span className="text-xs text-slate-400">{formatDateTime(entry.at)}</span>
              </div>
              <div className="text-slate-500">
                Why: {entry.why}
                {entry.detail ? ` — ${entry.detail}` : ''}
              </div>
              <Pill
                tone={entry.outcome === 'ok' ? 'green' : entry.outcome === 'error' ? 'red' : 'yellow'}
              >
                {entry.outcome}
              </Pill>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-900">{value}</dd>
    </>
  );
}
