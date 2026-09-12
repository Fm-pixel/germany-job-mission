import { Banner, Card, Empty, Pill } from '@/components/ui';
import { db } from '@/services/db';
import { fitsForCandidate } from '@/services/opportunities';

export const dynamic = 'force-dynamic';

export default async function DoorsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [candidate, fits] = await Promise.all([db.get('candidates', id), fitsForCandidate(id)]);
  const open = fits.filter((f) => f.fits);
  const blocked = fits.filter((f) => !f.fits);

  return (
    <div className="space-y-6">
      <Banner tone="amber" title="Read this honestly">
        A short-stay visa for an event, a conference or a family visit is a networking chance — never a way to stay.
        Family reunification for parents is a hardship route only and should not be planned on.
      </Banner>

      <Card title={`Doors open for ${candidate?.name ?? 'this person'}`}>
        {open.length === 0 ? (
          <Empty>
            Nothing matches yet — or the radar has not read the official pages. Open the Opportunity Radar and press
            “Re-check every programme”.
          </Empty>
        ) : (
          <ul className="space-y-2">
            {open.map(({ opportunity }) => (
              <li key={opportunity.id} className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 text-sm">
                <a href={opportunity.url} target="_blank" rel="noreferrer" className="font-semibold text-accent-600 underline">
                  {opportunity.name}
                </a>{' '}
                <Pill tone="yellow">{opportunity.label}</Pill>
                <div className="text-xs text-slate-500">
                  {opportunity.organiser} · checked {opportunity.checkedAt.slice(0, 10)}
                  {opportunity.nextDeadline ? ` · deadline ${opportunity.nextDeadline}` : ''}
                </div>
                {opportunity.honestNote && <p className="mt-1 text-xs text-amber-800">{opportunity.honestNote}</p>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Not yet — and what is missing">
        {blocked.length === 0 ? (
          <Empty>Nothing to show.</Empty>
        ) : (
          <ul className="space-y-2 text-sm">
            {blocked.map(({ opportunity, missing }) => (
              <li key={opportunity.id} className="rounded-lg border border-slate-200 p-3">
                <a href={opportunity.url} target="_blank" rel="noreferrer" className="font-medium text-accent-600 underline">
                  {opportunity.name}
                </a>
                <ul className="mt-1 list-disc pl-5 text-slate-600">
                  {missing.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
