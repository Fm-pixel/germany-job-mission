#!/usr/bin/env node
/**
 * Publishes firestore.rules to your Firebase project using the service account
 * in FIREBASE_SERVICE_ACCOUNT_JSON. No Firebase CLI login needed.
 *
 *   npm run deploy-rules
 *
 * If it cannot run (no service account yet), it tells you how to paste the
 * rules by hand instead — it never pretends to have succeeded.
 */
import fs from 'node:fs';
import path from 'node:path';
import { GoogleAuth } from 'google-auth-library';

const manualInstructions = `
Could not publish the rules automatically. Do it by hand (2 minutes):
  1. Open console.firebase.google.com and pick your project.
  2. Build -> Firestore Database -> the "Rules" tab.
  3. Delete what is there, paste the content of firestore.rules,
     replace REPLACE_WITH_YOUR_OWNER_UID with your user ID
     (Authentication -> Users -> copy "User UID").
  4. Press Publish.
`;

async function main() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    console.error('FIREBASE_SERVICE_ACCOUNT_JSON is not set.');
    console.error(manualInstructions);
    process.exit(1);
  }
  const credentials = JSON.parse(raw);
  const ownerUid = process.env.OWNER_UID;
  if (!ownerUid) {
    console.error('OWNER_UID is not set — the rules would lock you out.');
    console.error(manualInstructions);
    process.exit(1);
  }

  const rulesPath = path.join(process.cwd(), 'firestore.rules');
  const rules = fs
    .readFileSync(rulesPath, 'utf8')
    .replace('REPLACE_WITH_YOUR_OWNER_UID', ownerUid);

  const auth = new GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });
  const client = await auth.getClient();
  const projectId = credentials.project_id;
  const base = `https://firebaserules.googleapis.com/v1/projects/${projectId}`;

  const ruleset = await client.request({
    url: `${base}/rulesets`,
    method: 'POST',
    data: { source: { files: [{ name: 'firestore.rules', content: rules }] } },
  });
  const rulesetName = ruleset.data.name;

  await client.request({
    url: `${base}/releases/cloud.firestore`,
    method: 'PATCH',
    data: { release: { name: `${base}/releases/cloud.firestore`, rulesetName } },
  });

  console.log(`Published firestore.rules to project ${projectId}.`);
  console.log(`Only the user ${ownerUid} can read or write the database now.`);
  console.log('');
  console.log('The indexes in firestore.indexes.json are not published by this script.');
  console.log('Firestore creates them on demand: when a page needs one, the server log shows a link');
  console.log('that creates it in one click. Or run "firebase deploy --only firestore:indexes".');
}

main().catch((err) => {
  console.error('Failed:', err?.message ?? err);
  console.error(manualInstructions);
  process.exit(1);
});
