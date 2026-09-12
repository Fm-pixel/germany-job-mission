'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, type UserCredential } from 'firebase/auth';
import type { ConfirmationResult } from 'firebase/auth';
import {
  clientAuth,
  looksLikeInternationalNumber,
  normaliseNumber,
  resetPhoneVerifier,
  sendPhoneCode,
  signInWithGoogle,
} from '@/lib/firebase-client';

type Method = 'email' | 'google' | 'phone';

export function LoginForm({ canSignUp }: { canSignUp: boolean }) {
  const router = useRouter();
  const [method, setMethod] = useState<Method>('email');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** The one place a signed-in user becomes a server session. */
  async function startSession(credential: UserCredential) {
    const idToken = await credential.user.getIdToken();
    const res = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      await clientAuth().signOut();
      throw new Error(data.error ?? 'The server refused the sign-in.');
    }
    router.push('/');
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-lg bg-slate-100 p-1 text-xs">
        {(['email', 'google', 'phone'] as const).map((option) => (
          <button
            key={option}
            type="button"
            className={`flex-1 rounded-md px-2 py-1.5 transition ${
              method === option ? 'bg-white font-medium text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
            onClick={() => {
              setMethod(option);
              setError(null);
            }}
          >
            {option === 'email' ? 'Email' : option === 'google' ? 'Google' : 'Phone'}
          </button>
        ))}
      </div>

      {method === 'email' && (
        <EmailForm canSignUp={canSignUp} busy={busy} setBusy={setBusy} setError={setError} onSignedIn={startSession} />
      )}

      {method === 'google' && (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">Sign in with the Google account that owns this tool.</p>
          <button
            className="btn-secondary w-full"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await startSession(await signInWithGoogle());
              } catch (err) {
                setError(readableError(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? 'One moment…' : 'Continue with Google'}
          </button>
        </div>
      )}

      {method === 'phone' && (
        <PhoneForm busy={busy} setBusy={setBusy} setError={setError} onSignedIn={startSession} />
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* The invisible reCAPTCHA that phone sign-in needs. */}
      <div id="gjm-recaptcha" />
    </div>
  );
}

function EmailForm({
  canSignUp,
  busy,
  setBusy,
  setError,
  onSignedIn,
}: {
  canSignUp: boolean;
  busy: boolean;
  setBusy: (value: boolean) => void;
  setError: (value: string | null) => void;
  onSignedIn: (credential: UserCredential) => Promise<void>;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>(canSignUp ? 'signup' : 'login');

  return (
    <form
      className="space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError(null);
        try {
          const auth = clientAuth();
          const credential =
            mode === 'signup'
              ? await createUserWithEmailAndPassword(auth, email, password)
              : await signInWithEmailAndPassword(auth, email, password);
          await onSignedIn(credential);
        } catch (err) {
          setError(readableError(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      {mode === 'signup' && (
        <div className="rounded-lg border border-accent-300 bg-accent-50 px-3 py-2 text-xs text-accent-700">
          No account exists yet. Create yours now — afterwards sign-up is switched off automatically.
        </div>
      )}
      <div>
        <label className="label" htmlFor="email">
          Email
        </label>
        <input
          className="input"
          id="email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div>
        <label className="label" htmlFor="password">
          Password
        </label>
        <input
          className="input"
          id="password"
          type="password"
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
        />
      </div>
      <button className="btn-primary w-full" type="submit" disabled={busy}>
        {busy ? 'One moment…' : mode === 'signup' ? 'Create my account' : 'Sign in'}
      </button>
      {canSignUp && (
        <button
          type="button"
          className="w-full text-center text-xs text-slate-500 underline"
          onClick={() => setMode(mode === 'signup' ? 'login' : 'signup')}
        >
          {mode === 'signup' ? 'I already have an account' : 'Create the first account'}
        </button>
      )}
    </form>
  );
}

function PhoneForm({
  busy,
  setBusy,
  setError,
  onSignedIn,
}: {
  busy: boolean;
  setBusy: (value: boolean) => void;
  setError: (value: string | null) => void;
  onSignedIn: (credential: UserCredential) => Promise<void>;
}) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [pending, setPending] = useState<ConfirmationResult | null>(null);

  if (pending) {
    return (
      <form
        className="space-y-3"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError(null);
          try {
            await onSignedIn(await pending.confirm(code.trim()));
          } catch (err) {
            setError(readableError(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <p className="text-sm text-slate-600">
          A code was sent to {phone}. It is valid for a few minutes.
        </p>
        <div>
          <label className="label" htmlFor="code">
            The six-digit code
          </label>
          <input
            className="input tracking-[0.3em]"
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
        </div>
        <button className="btn-primary w-full" type="submit" disabled={busy}>
          {busy ? 'Checking…' : 'Sign in'}
        </button>
        <button
          type="button"
          className="w-full text-center text-xs text-slate-500 underline"
          onClick={() => {
            resetPhoneVerifier();
            setPending(null);
            setCode('');
          }}
        >
          Use a different number
        </button>
      </form>
    );
  }

  return (
    <form
      className="space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        const number = normaliseNumber(phone);
        if (!looksLikeInternationalNumber(number)) {
          setError('Write the number in international form, starting with + and the country code.');
          return;
        }
        setBusy(true);
        setError(null);
        try {
          setPending(await sendPhoneCode(number, 'gjm-recaptcha'));
          setPhone(number);
        } catch (err) {
          resetPhoneVerifier();
          setError(readableError(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <div>
        <label className="label" htmlFor="phone">
          Phone number
        </label>
        <input
          className="input"
          id="phone"
          type="tel"
          autoComplete="tel"
          placeholder="+49 151 23456789"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
        />
        <p className="mt-1 text-xs text-slate-500">
          With the country code, for example +49 for Germany or +250 for Rwanda.
        </p>
      </div>
      <button className="btn-primary w-full" type="submit" disabled={busy}>
        {busy ? 'Sending…' : 'Send me a code'}
      </button>
    </form>
  );
}

/** Firebase error codes are not for humans; these are the ones worth naming. */
function readableError(err: unknown): string {
  const code = (err as { code?: string } | null)?.code ?? '';
  switch (code) {
    case 'auth/invalid-email':
      return 'That email address does not look right.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Those details do not match an account.';
    case 'auth/email-already-in-use':
      return 'An account with that email already exists — sign in instead.';
    case 'auth/weak-password':
      return 'Choose a longer password (at least 8 characters).';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'The Google window was closed before sign-in finished.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the Google window. Allow pop-ups for this page and try again.';
    case 'auth/unauthorized-domain':
      return 'This web address is not on the Firebase list of authorised domains. Add it under Authentication → Settings → Authorised domains (SETUP_FOR_ME.md step 1).';
    case 'auth/operation-not-allowed':
      return 'That sign-in method is not switched on in Firebase yet (SETUP_FOR_ME.md step 1).';
    case 'auth/invalid-phone-number':
      return 'Write the number in international form, starting with + and the country code.';
    case 'auth/invalid-verification-code':
      return 'That code is not right. Check the SMS and try again.';
    case 'auth/code-expired':
      return 'That code has expired. Ask for a new one.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a few minutes and try again.';
    case 'auth/quota-exceeded':
      return 'The SMS quota for this project is used up for now.';
    default:
      return err instanceof Error ? err.message : 'Sign-in failed.';
  }
}
