import { Banner, Card } from '@/components/ui';
import { db } from '@/services/db';
import { buildContext, NOT_LEGAL_ADVICE } from '@/services/immigration';
import { ImmigrationPanel } from './panel';

export const dynamic = 'force-dynamic';

export default async function ImmigrationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [ctx, checklist, candidate, qualifications] = await Promise.all([
    buildContext(id),
    db.byCandidate('checklist_items', id),
    db.get('candidates', id),
    db.byCandidate('qualifications', id),
  ]);

  return (
    <div className="space-y-6">
      <Banner tone="amber" title="Read this first">
        {NOT_LEGAL_ADVICE}
      </Banner>

      {!ctx.hasOffer && (
        <Card title="Not yet — and that is on purpose">
          <p className="text-sm text-slate-700">
            The immigration pathway is worked out once a real employer has made an offer. Until then the fastest thing
            that helps this person is more good applications, not paperwork.
          </p>
          <p className="mt-2 text-sm text-slate-700">
            You can still look at the ranked routes and the Opportunity Card assessment below — they simply show the
            missing job offer as the blocking point.
          </p>
        </Card>
      )}

      <ImmigrationPanel
        candidateId={id}
        candidateName={candidate?.name ?? ''}
        country={candidate?.country ?? ''}
        profession={candidate?.profession ?? ''}
        qualificationTitle={qualifications[0]?.title ?? ''}
        checklist={checklist.map((item) => ({
          id: item.id,
          title: item.title,
          status: item.status,
          owner: item.owner,
          deadline: item.deadline,
          label: item.label,
          sourceUrl: item.sourceUrl,
          pathwayKey: item.pathwayKey,
        }))}
      />
    </div>
  );
}
