#!/usr/bin/env node
/**
 * Connects this app to a Firebase project, without the console.
 *
 *   FIREBASE_SERVICE_ACCOUNT_JSON='<the whole JSON>' npm run firebase:setup
 *
 * It does three things, and says plainly what it could not do:
 *   1. finds the web app in the project (or registers one called "gjm-web"),
 *   2. reads that app's config and writes it into .env.local,
 *   3. switches on the sign-in methods it is allowed to switch on
 *      (email/password and phone), and reports on Google.
 *
 * Nothing is invented: every value written comes from the Firebase API.
 *
 * Options:
 *   --project <id>   use this project instead of FIREBASE_PROJECT_ID / the key's own
 *   --app-name <n>   display name for the web app (default "gjm-web")
 *   --dry-run        show what would happen, change nothing
 */
import fs from 'node:fs';
import path from 'node:path';
import { GoogleAuth } from 'google-auth-library';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : fallback;
};
const dryRun = args.includes('--dry-run');
const appName = flag('app-name', 'gjm-web');

function fail(message, hint) {
  console.error(`\n${message}`);
  if (hint) console.error(hint);
  process.exit(1);
}

async function main() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    fail(
      'FIREBASE_SERVICE_ACCOUNT_JSON is not set.',
      `
Get it once from the Firebase console:
  Project settings -> Service accounts -> Generate new private key.
Then run, with the whole file in single quotes:
  FIREBASE_SERVICE_ACCOUNT_JSON='<paste>' npm run firebase:setup
`,
    );
  }

  let credentials;
  try {
    credentials = JSON.parse(raw);
  } catch {
    fail('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON. Paste the whole file, in single quotes.');
  }

  const projectId = flag('project', process.env.FIREBASE_PROJECT_ID || credentials.project_id);
  if (!projectId) fail('No project id — pass --project <id>.');
  console.log(`Project: ${projectId}`);
  if (credentials.project_id && credentials.project_id !== projectId) {
    console.log(`Note: the key belongs to ${credentials.project_id}; using ${projectId} as asked.`);
  }

  const auth = new GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/cloud-platform', 'https://www.googleapis.com/auth/firebase'],
  });
  const client = await auth.getClient();

  const call = async (url, method = 'GET', data) => {
    try {
      const res = await client.request({ url, method, data });
      return res.data;
    } catch (err) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.error?.message ?? err.message;
      const error = new Error(`${method} ${url} -> ${status ?? '?'}: ${detail}`);
      error.status = status;
      throw error;
    }
  };

  // --- 1. the web app -------------------------------------------------------
  let webApp;
  try {
    const list = await call(`https://firebase.googleapis.com/v1beta1/projects/${projectId}/webApps`);
    webApp = (list.apps ?? [])[0];
  } catch (err) {
    if (err.status === 403) {
      fail(
        `This service account may not manage the project (${err.message}).`,
        `
Give it the role in Google Cloud:
  console.cloud.google.com -> IAM & Admin -> IAM -> find the service account
  (${credentials.client_email}) -> add the role "Firebase Admin" (or "Owner").
Also make sure the Firebase Management API is enabled for the project.
`,
      );
    }
    throw err;
  }

  if (webApp) {
    console.log(`Web app already registered: ${webApp.displayName ?? webApp.appId} (${webApp.appId})`);
  } else if (dryRun) {
    console.log(`Would register a new web app called "${appName}".`);
    return;
  } else {
    console.log(`No web app yet — registering "${appName}"…`);
    const operation = await call(
      `https://firebase.googleapis.com/v1beta1/projects/${projectId}/webApps`,
      'POST',
      { displayName: appName },
    );
    // Registration is a long-running operation; wait for it to finish.
    let done = operation;
    for (let attempt = 0; attempt < 30 && !done.done; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      done = await call(`https://firebase.googleapis.com/v1beta1/${operation.name}`);
    }
    if (!done.done || !done.response) fail('Firebase did not finish registering the web app. Try again.');
    webApp = done.response;
    console.log(`Registered: ${webApp.appId}`);
  }

  // --- 2. its config --------------------------------------------------------
  const config = await call(`https://firebase.googleapis.com/v1beta1/${webApp.name}/config`);
  const lines = {
    NEXT_PUBLIC_FIREBASE_API_KEY: config.apiKey,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: config.authDomain,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: config.projectId,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: config.storageBucket ?? '',
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: config.messagingSenderId ?? '',
    NEXT_PUBLIC_FIREBASE_APP_ID: config.appId,
  };

  console.log('\nThe web app config:');
  for (const [key, value] of Object.entries(lines)) console.log(`  ${key}=${value}`);

  if (!dryRun) {
    const envPath = path.join(process.cwd(), '.env.local');
    const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
    let next = existing;
    for (const [key, value] of Object.entries(lines)) {
      const line = `${key}=${value}`;
      next = new RegExp(`^${key}=.*$`, 'm').test(next)
        ? next.replace(new RegExp(`^${key}=.*$`, 'm'), line)
        : `${next.trimEnd()}\n${line}`;
    }
    fs.writeFileSync(envPath, `${next.trim()}\n`, 'utf8');
    console.log(`\nWritten into .env.local (which is never committed).`);
  }

  // --- 3. the sign-in methods ----------------------------------------------
  const identityBase = `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}`;
  let signInConfig;
  try {
    signInConfig = await call(`${identityBase}/config`);
  } catch (err) {
    console.log(`\nCould not read the sign-in settings (${err.message}).`);
    console.log('Switch the three methods on by hand: Firebase console -> Authentication -> Sign-in method.');
    return;
  }

  const state = {
    email: signInConfig.signIn?.email?.enabled === true,
    phone: signInConfig.signIn?.phoneNumber?.enabled === true,
  };
  console.log('\nSign-in methods:');
  console.log(`  Email/password: ${state.email ? 'on' : 'OFF'}`);
  console.log(`  Phone:          ${state.phone ? 'on' : 'OFF'}`);

  if (!dryRun && (!state.email || !state.phone)) {
    try {
      await call(`${identityBase}/config?updateMask=signIn.email.enabled,signIn.phoneNumber.enabled`, 'PATCH', {
        signIn: { email: { enabled: true }, phoneNumber: { enabled: true } },
      });
      console.log('  -> switched Email/password and Phone on.');
    } catch (err) {
      console.log(`  -> could not switch them on automatically (${err.message}).`);
      console.log('     Do it in the console: Authentication -> Sign-in method.');
    }
  }

  let googleOn = false;
  try {
    const idps = await call(`${identityBase}/defaultSupportedIdpConfigs`);
    googleOn = (idps.defaultSupportedIdpConfigs ?? []).some(
      (idp) => idp.name?.endsWith('google.com') && idp.enabled,
    );
  } catch {
    // Listing may be refused; the console still shows the truth.
  }
  console.log(`  Google:         ${googleOn ? 'on' : 'OFF'}`);
  if (!googleOn) {
    console.log(
      `
  Google sign-in has to be switched on in the console once, because Firebase
  creates the OAuth client for it there:
    console.firebase.google.com -> ${projectId} -> Authentication ->
    Sign-in method -> Google -> Enable -> pick a support email -> Save.`,
    );
  }

  console.log(
    `
Next:
  1. Sign in once at /login, then copy your user ID from
     Authentication -> Users and put it in OWNER_UIDS.
  2. Run: npm run deploy-rules   (locks the database to that id)
  3. Add your live web address under Authentication -> Settings ->
     Authorised domains, or Google and phone sign-in will refuse to run there.`,
  );
}

main().catch((err) => {
  console.error(`\nFailed: ${err.message}`);
  process.exit(1);
});
