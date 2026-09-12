#!/usr/bin/env node
/**
 * Creates the example person from BUILD_PLAN prompt 3 (Jean, Rwanda,
 * electrician) so the app can be clicked through without touching real data.
 *
 * It refuses to run against Firestore — it only writes into the local test
 * store, and only when GJM_DB_DRIVER=local-file is set.
 *
 *   GJM_DB_DRIVER=local-file node scripts/seed-example.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

if (process.env.GJM_DB_DRIVER !== 'local-file') {
  console.error('Refusing to run: set GJM_DB_DRIVER=local-file first. This script never writes to Firestore.');
  process.exit(1);
}

const dir = process.env.GJM_LOCAL_DB_DIR || path.join(process.cwd(), '.gjm-data');
fs.mkdirSync(dir, { recursive: true });

const now = new Date().toISOString();
const id = (prefix) => `${prefix}-example`;

function write(collection, rows) {
  fs.writeFileSync(path.join(dir, `${collection}.json`), JSON.stringify(rows, null, 2), 'utf8');
}

write('candidates', [
  {
    id: id('jean'),
    createdAt: now,
    updatedAt: now,
    name: 'Jean (example)',
    country: 'Rwanda',
    city: 'Kigali',
    profession: 'Electrician',
    preferredOccupation: 'Elektriker',
    track: 'A-skilled',
    status: 'active',
    relocate: true,
    preferredCities: [],
    preferredStates: [],
    workingTime: 'either',
    consentConfirmed: true,
    reviewedApplicationCount: 0,
  },
]);

write('candidate_profiles', [
  {
    id: id('profile'),
    createdAt: now,
    updatedAt: now,
    candidateId: id('jean'),
    summary: 'Example data for clicking through the app. Not a real person.',
    profession: 'Elektriker',
    skills: ['Elektroinstallation', 'Fehlersuche', 'Wartung'],
    industries: ['Elektrohandwerk'],
    jobTitles: ['Elektriker', 'Elektroinstallateur'],
    yearsExperience: 5,
    qualificationLevel: 'vocational',
    confirmed: true,
    needsConfirmation: [
      {
        field: 'Language: German',
        value: 'A2',
        reason: 'The CV describes the level in words, not as an official certificate.',
      },
    ],
  },
]);

write('languages', [
  { id: id('de'), createdAt: now, updatedAt: now, candidateId: id('jean'), language: 'German', level: 'A2' },
  { id: id('en'), createdAt: now, updatedAt: now, candidateId: id('jean'), language: 'English', level: 'B2' },
]);

write('qualifications', [
  {
    id: id('qual'),
    createdAt: now,
    updatedAt: now,
    candidateId: id('jean'),
    title: 'Vocational qualification — electrical installation',
    country: 'Rwanda',
    type: 'vocational',
    recognitionStatus: 'unknown',
  },
]);

write('jobs', [
  {
    id: id('job1'),
    createdAt: now,
    updatedAt: now,
    source: 'example',
    sourceId: 'EXAMPLE-1',
    url: 'https://www.arbeitsagentur.de/jobsuche/',
    title: 'Elektriker (m/w/d) — EXAMPLE DATA, not a real vacancy',
    employer: 'Example GmbH (not a real company)',
    location: 'München, Bayern',
    description:
      'EXAMPLE ONLY. Wir suchen einen Elektriker (m/w/d) für Installation und Wartung. Deutschkenntnisse mindestens B1 erforderlich. Vollzeit.',
    requirements: 'Abgeschlossene Berufsausbildung, Deutsch B1.',
    languageRequirement: 'B1',
    workingTime: 'full-time',
    kind: 'job',
    discoveredAt: now,
    checkedAt: now,
    active: true,
    scamFlags: [],
  },
]);

console.log(`Example data written to ${dir}.`);
console.log('It is clearly marked as an example — delete the folder to remove it.');
