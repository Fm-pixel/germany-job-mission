import { redirect } from 'next/navigation';
import { getSession, signUpAllowed } from '@/lib/auth';
import { firebaseWebConfigured, localModeEnabled } from '@/lib/env';
import { LoginForm } from './login-form';

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect('/');
  const configured = firebaseWebConfigured();
  const canSignUp = configured ? await signUpAllowed().catch(() => false) : false;

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent-300">My Germany</div>
          <h1 className="text-2xl font-semibold text-white">Job Mission</h1>
          <p className="mt-2 text-sm text-slate-400">Private tool. One account: yours.</p>
        </div>
        <div className="card card-pad">
          {localModeEnabled() ? (
            <LocalLogin />
          ) : configured ? (
            <LoginForm canSignUp={canSignUp} />
          ) : (
            <div className="text-sm text-slate-700">
              <p className="font-semibold text-amber-700">Login is NOT CONNECTED.</p>
              <p className="mt-2">
                The Firebase values are missing. Open <code>SETUP_FOR_ME.md</code> and follow step 1, then reload
                this page.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LocalLogin() {
  return (
    <form action="/api/auth/local-login" method="post" className="space-y-3">
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        <strong>LOCAL TEST LOGIN.</strong> This is not real authentication and only works because
        GJM_LOCAL_MODE=1 is set. Never use it in production.
      </div>
      <div>
        <label className="label" htmlFor="password">
          Test password
        </label>
        <input className="input" id="password" name="password" type="password" required />
      </div>
      <button className="btn-primary w-full" type="submit">
        Enter
      </button>
    </form>
  );
}
