import { Card, NotConnected } from '@/components/ui';
import { db } from '@/services/db';
import { topMatches } from '@/services/matching';
import { aiAvailable } from '@/services/ai/client';
import { MatchList } from './list';

export const dynamic = 'force-dynamic';

export default async function MatchesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rows = await topMatches(id, 50);
  const applications = await db.byCandidate('applications', id);
  const appliedJobIds = new Set(applications.map((a) => a.jobId).filter(Boolean) as string[]);

  return (
    <div className="space-y-6">
      {!aiAvailable() && (
        <NotConnected
          what="AI explanations"
          detail="Scores and the ✓/⚠ list from the rule engine still work. The richer explanation from the job advert needs the Anthropic API."
          step="3"
        />
      )}
      <Card title={`Matches (${rows.length})`}>
        <MatchList
          candidateId={id}
          aiConnected={aiAvailable()}
          rows={rows.map(({ match, job }) => ({
            match,
            job: job
              ? {
                  id: job.id,
                  title: job.title,
                  employer: job.employer,
                  location: job.location,
                  url: job.url,
                  active: job.active,
                }
              : null,
            alreadyApplied: job ? appliedJobIds.has(job.id) : false,
          }))}
        />
      </Card>
    </div>
  );
}
