import Link from 'next/link';
import { Card, Empty, Pill } from '@/components/ui';
import { db } from '@/services/db';
import { candidateStats } from '@/services/tracking';

export const dynamic = 'force-dynamic';

export default async function PeoplePage() {
  const candidates = await db.list('candidates');
  const rows = await Promise.all(
    candidates.map(async (candidate) => ({
      candidate,
      stats: await candidateStats(candidate.id),
      languages: await db.byCandidate('languages', candidate.id),
    })),
  );

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">People I&apos;m helping</h1>
          <p className="mt-1 text-sm text-slate-500">Everyone you are personally supporting, and where they stand.</p>
        </div>
        <Link href="/people/new" className="btn-primary">
          Add a person
        </Link>
      </header>

      <Card>
        {rows.length === 0 ? (
          <Empty>Nobody added yet.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3">Person</th>
                  <th className="py-2 pr-3">Profession</th>
                  <th className="py-2 pr-3">Languages</th>
                  <th className="py-2 pr-3">Track</th>
                  <th className="py-2 pr-3 text-right">Apps</th>
                  <th className="py-2 pr-3 text-right">Interviews</th>
                  <th className="py-2 pr-3 text-right">Offers</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map(({ candidate, stats, languages }) => (
                  <tr key={candidate.id}>
                    <td className="py-3 pr-3">
                      <Link href={`/people/${candidate.id}`} className="font-medium text-accent-600 hover:underline">
                        {candidate.name}
                      </Link>
                      <div className="text-xs text-slate-500">{candidate.country}</div>
                    </td>
                    <td className="py-3 pr-3">{candidate.profession ?? '—'}</td>
                    <td className="py-3 pr-3 text-xs text-slate-600">
                      {languages.length === 0
                        ? '—'
                        : languages.map((l) => `${l.language} ${l.level}`).join(', ')}
                    </td>
                    <td className="py-3 pr-3">
                      <Pill tone={candidate.track === 'B-apprenticeship' ? 'yellow' : 'blue'}>
                        {candidate.track === 'B-apprenticeship'
                          ? 'Track B – apprenticeship'
                          : candidate.track === 'A-skilled'
                            ? 'Track A – skilled'
                            : 'not decided'}
                      </Pill>
                    </td>
                    <td className="py-3 pr-3 text-right">{stats.applications}</td>
                    <td className="py-3 pr-3 text-right">{stats.interviews}</td>
                    <td className="py-3 pr-3 text-right">{stats.offers}</td>
                    <td className="py-3 text-right">
                      <Link href={`/people/${candidate.id}`} className="text-xs text-accent-600 underline">
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
