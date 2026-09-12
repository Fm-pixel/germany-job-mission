'use client';

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInWithPopup,
  type Auth,
  type ConfirmationResult,
  type UserCredential,
} from 'firebase/auth';

import { firebaseWebConfig, firebaseWebConfigComplete } from './firebase-config';

const config = firebaseWebConfig;

export function firebaseConfigured(): boolean {
  return firebaseWebConfigComplete();
}

export function firebaseProjectId(): string | undefined {
  return config.projectId;
}

export function clientApp(): FirebaseApp {
  if (!firebaseConfigured()) {
    throw new Error('Firebase is NOT CONNECTED — the NEXT_PUBLIC_FIREBASE_* values are missing.');
  }
  return getApps().length ? getApp() : initializeApp(config);
}

export function clientAuth(): Auth {
  return getAuth(clientApp());
}

/** Sign in with a Google account, in a popup. */
export async function signInWithGoogle(): Promise<UserCredential> {
  const provider = new GoogleAuthProvider();
  // Always ask which account, so the wrong Google account is not picked silently.
  provider.setCustomParameters({ prompt: 'select_account' });
  return signInWithPopup(clientAuth(), provider);
}

let verifier: RecaptchaVerifier | null = null;

/**
 * Phone sign-in needs a reCAPTCHA check. "invisible" means it normally runs
 * without the person seeing anything; Firebase shows a challenge only when it
 * is suspicious of the request.
 */
export function phoneVerifier(containerId: string): RecaptchaVerifier {
  if (verifier) return verifier;
  verifier = new RecaptchaVerifier(clientAuth(), containerId, { size: 'invisible' });
  return verifier;
}

export function resetPhoneVerifier(): void {
  try {
    verifier?.clear();
  } catch {
    // Nothing to clear.
  }
  verifier = null;
}

/** Step 1 of phone sign-in: send the SMS code. */
export async function sendPhoneCode(
  phoneNumber: string,
  containerId: string,
): Promise<ConfirmationResult> {
  return signInWithPhoneNumber(clientAuth(), phoneNumber, phoneVerifier(containerId));
}

/** True for a number in international form, the only form Firebase accepts. */
export function looksLikeInternationalNumber(value: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(value.replace(/[\s\-()]/g, ''));
}

export function normaliseNumber(value: string): string {
  return value.replace(/[\s\-()]/g, '');
}
