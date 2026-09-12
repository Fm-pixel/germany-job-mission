import { Banner, Card, Empty, NotConnected, Pill } from '@/components/ui';
import { db } from '@/services/db';
import { aiAvailable } from '@/services/ai/client';
import { SEED_OPPORTUNITIES } from '@/services/opportunities/seed-list';
import { RadarPanel } from './panel';

export const dynamic = 'force-dynamic';

export default async function OpportunitiesPage() {
  const opportunities = await db.list('opportunities', { limit: 200 });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Opportunity Radar</h1>
        <p className="mt-1 text-sm text-slate-500">
          Every other legal door: programmes, scholarships, exchanges, volunteering, study, family. Each one with its
          official page and the date it was last checked.
        </p>
      </header>

      <Banner tone="amber" title="Two things this radar will never do">
        It never lists a short-stay visitor visa (event, conference, family visit) as a way to live or work in Germany —
        those are networking chances only. And the family route for parents is shown as very limited, hardship cases
        only.
      </Banner>

      {!aiAvailable() && (
        <NotConnected
          what="Programme research"
          detail={`The ${SEED_OPPORTUNITIES.length} programmes below are watched, but reading their official pages needs the Anthropic API. Until then the list shows the programme and its official link only — no requirements and no deadlines are filled in from memory.`}
          step="3"
        />
      )}

      <Card title="Refresh">
        <RadarPanel count={opportunities.length} seedCount={SEED_OPPORTUNITIES.length} />
      </Card>

      <Card title={`Programmes (${opportunities.length})`}>
        {opportunities.length === 0 ? (
          <Empty>Nothing stored yet. Press “Re-check every programme”.</Empty>
        ) : (
          <div className="space-y-3">
            {opportunities.map((opportunity) => (
              <div key={opportunity.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <a
                      href={opportunity.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-semibold text-accent-600 underline"
                    >
                      {opportunity.name}
                    </a>
                    <div className="text-xs text-slate-500">
                      {opportunity.organiser} · {opportunity.type}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {opportunity.nextDeadline && <Pill tone="yellow">deadline {opportunity.nextDeadline}</Pill>}
                    <Pill tone={opportunity.status === 'open' ? 'green' : 'slate'}>{opportunity.status}</Pill>
                    <Pill tone="yellow">{opportunity.label}</Pill>
                  </div>
                </div>
                {opportunity.requirements.length > 0 && (
                  <ul className="mt-2 list-disc pl-5 text-sm text-slate-700">
                    {opportunity.requirements.slice(0, 6).map((requirement, index) => (
                      <li key={index}>{requirement}</li>
                    ))}
                  </ul>
                )}
                {opportunity.honestNote && (
                  <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-900">
                    {opportunity.honestNote}
                  </p>
                )}
                <p className="mt-2 text-xs text-slate-400">Checked {opportunity.checkedAt.slice(0, 10)}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
