import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/services/db';
import { Pill } from '@/components/ui';
import { PersonTabs } from '@/components/person-tabs';

export default async function PersonLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const candidate = await db.get('candidates', id);
  if (!candidate) notFound();
  const languages = await db.byCandidate('languages', id);
  const german = languages.find((l) => l.language.toLowerCase() === 'german')?.level ?? '—';
  const english = languages.find((l) => l.language.toLowerCase() === 'english')?.level ?? '—';

  return (
    <div className="space-y-6">
      <header className="card card-pad">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/people" className="text-xs text-slate-500 hover:underline">
              ← All people
            </Link>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">{candidate.name}</h1>
            <p className="text-sm text-slate-500">
              {[candidate.profession, candidate.city, candidate.country].filter(Boolean).join(' · ')}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone="slate">German {german}</Pill>
            <Pill tone="slate">English {english}</Pill>
            <Pill tone={candidate.status === 'active' ? 'green' : 'yellow'}>{candidate.status}</Pill>
            <Pill tone={candidate.track === 'B-apprenticeship' ? 'yellow' : 'blue'}>
              {candidate.track === 'B-apprenticeship'
                ? 'Track B – apprenticeship'
                : candidate.track === 'A-skilled'
                  ? 'Track A – skilled worker'
                  : 'Track not decided'}
            </Pill>
          </div>
        </div>
        <PersonTabs id={id} />
      </header>
      {children}
    </div>
  );
}
