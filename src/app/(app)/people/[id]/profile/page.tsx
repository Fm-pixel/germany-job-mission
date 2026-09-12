import { Card } from '@/components/ui';
import { DeletePerson } from '@/components/danger-zone';
import { db } from '@/services/db';
import { getProfile } from '@/services/candidates';
import { ProfileEditor } from './editor';

export const dynamic = 'force-dynamic';

export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [candidate, profile, languages, education, qualifications, workExperience] = await Promise.all([
    db.get('candidates', id),
    getProfile(id),
    db.byCandidate('languages', id),
    db.byCandidate('education', id),
    db.byCandidate('qualifications', id),
    db.byCandidate('work_experience', id),
  ]);
  if (!candidate) return null;

  return (
    <div className="space-y-6">
      <ProfileEditor
      candidateId={id}
      initial={{
        candidate,
        profile,
        languages,
        education,
        qualifications,
        workExperience,
      }}
      />
      <Card title="Delete this person">
        <DeletePerson candidateId={id} name={candidate.name} />
      </Card>
    </div>
  );
}
