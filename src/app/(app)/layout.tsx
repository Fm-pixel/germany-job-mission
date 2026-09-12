import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/nav';
import { getSession } from '@/lib/auth';
import { dbStatus } from '@/services/db';
import { localModeEnabled } from '@/lib/env';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');
  const status = dbStatus();

  return (
    <div className="min-h-screen lg:pl-64">
      <Sidebar email={session.email ?? (session.mode === 'local-test' ? 'local test session' : undefined)} />
      <main className="mx-auto max-w-6xl px-4 py-6 lg:px-8">
        {(session.mode === 'local-test' || status.driver === 'local-file') && (
          <div className="mb-5 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
            <strong>LOCAL TEST MODE.</strong>{' '}
            {localModeEnabled() && 'You are not really signed in — this login exists only for testing. '}
            {status.driver === 'local-file' && 'Data is stored in files on this machine, not in Firestore. '}
            Nothing here is production data.
          </div>
        )}
        {!status.connected && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800">
            <strong>DATABASE NOT CONNECTED.</strong> {status.reason} Follow step 1 in SETUP_FOR_ME.md.
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
