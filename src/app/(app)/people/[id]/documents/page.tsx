import { Card, NotConnected } from '@/components/ui';
import { db } from '@/services/db';
import { driveAvailable } from '@/services/documents';
import { aiAvailable } from '@/services/ai/client';
import { localTestModeEnabled } from '@/services/db';
import { DocumentsPanel } from './panel';

export const dynamic = 'force-dynamic';

export default async function DocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const documents = await db.byCandidate('documents', id);
  const drive = driveAvailable();

  return (
    <div className="space-y-6">
      {!drive && !localTestModeEnabled() && (
        <NotConnected
          what="Google Drive"
          detail="Documents cannot be stored until the private Drive folder is shared with the service account."
          step="2"
        />
      )}
      {!drive && localTestModeEnabled() && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Drive is not connected. Because this is LOCAL TEST MODE, uploads are written to files on this machine
          instead — never do this in production.
        </div>
      )}
      {!aiAvailable() && (
        <NotConnected
          what="CV analysis (Anthropic API)"
          detail="You can upload documents, but the CV cannot be read automatically yet. Fill the profile in by hand in the meantime."
          step="3"
        />
      )}
      <Card title="Documents">
        <DocumentsPanel candidateId={id} documents={documents} aiConnected={aiAvailable()} />
      </Card>
    </div>
  );
}
