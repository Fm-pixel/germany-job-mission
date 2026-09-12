import { Banner, Card } from '@/components/ui';
import { db } from '@/services/db';
import { assessTrackB } from '@/services/immigration/track-b';
import { TrackBPanel } from './panel';

export const dynamic = 'force-dynamic';

export default async function TrackBPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [assessment, tasks, candidate] = await Promise.all([
    assessTrackB(id),
    db.byCandidate('tasks', id),
    db.get('candidates', id),
  ]);

  return (
    <div className="space-y-6">
      <Banner tone="amber" title="The honest position">
        {assessment.headline}
      </Banner>

      <Card title="Where this person stands">
        <dl className="grid gap-4 sm:grid-cols-4">
          <div>
            <dt className="text-xs uppercase text-slate-500">Age</dt>
            <dd className="text-sm">{assessment.age ?? 'year of birth not recorded'}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">School certificate</dt>
            <dd className="text-sm">{assessment.hasSchoolCertificate ? 'uploaded' : 'missing'}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">German</dt>
            <dd className="text-sm">{assessment.german}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">English</dt>
            <dd className="text-sm">{assessment.english}</dd>
          </div>
        </dl>

        <div className="mt-4">
          <div className="section-title">What stands in the way right now</div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
            {assessment.blockers.map((blocker, index) => (
              <li key={index}>{blocker}</li>
            ))}
          </ul>
        </div>
      </Card>

      <Card title="§ 16a training visa — requirements">
        <ul className="space-y-2 text-sm">
          {assessment.requirements.map((requirement, index) => (
            <li key={index}>
              {requirement.text}{' '}
              <span
                className={`pill ${requirement.label === 'CONFIRMED' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}
              >
                {requirement.label}
              </span>{' '}
              <a href={requirement.sourceUrl} target="_blank" rel="noreferrer" className="text-xs text-accent-600 underline">
                source
              </a>
              {requirement.checkedAt && (
                <span className="text-xs text-slate-400"> · checked {requirement.checkedAt.slice(0, 10)}</span>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-slate-500">{assessment.disclaimer}</p>
      </Card>

      <TrackBPanel
        candidateId={id}
        defaultOccupation={candidate?.preferredOccupation ?? candidate?.profession ?? ''}
        germanTasks={tasks
          .filter((task) => task.title.startsWith('German '))
          .map((task) => ({ id: task.id, title: task.title, due: task.due, detail: task.detail }))}
      />

      <Card title="Other doors for 18–26 year-olds">
        <ul className="space-y-2 text-sm">
          {assessment.bridges.map((bridge) => (
            <li key={bridge.name}>
              <strong>{bridge.name}</strong> — {bridge.note}{' '}
              <a href={bridge.sourceUrl} target="_blank" rel="noreferrer" className="text-xs text-accent-600 underline">
                official page
              </a>{' '}
              <span className="pill bg-amber-50 text-amber-800">{bridge.label}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
