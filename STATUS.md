# Build status (maintained by Claude Code — do not edit by hand)

Current step: BUILD_PLAN prompts 1–19 are implemented. Waiting for the cloud accounts and keys
(see "Blocked on me" below) before the connected parts can be tested against the real services.

## Done

| Prompt | What was built |
|---|---|
| 1 | `ARCHITECTURE.md` — architecture, data model, workflows, security model, MVP order |
| 2 | Next.js + TypeScript + Tailwind scaffold; `/src/services/db` data layer over Firestore with typed collections for every table in SPEC section 25; Firebase Auth login with sign-up closing after the first account; `firestore.rules` + `npm run deploy-rules`; Google Drive documents service; the app shell |
| 3 | People: profile builder, document upload into per-person Drive subfolders, CV analysis with a confidence per field and a "needs confirmation" review step before anything is saved |
| 4 | Job search with a pluggable `JobSource` interface and the Bundesagentur für Arbeit Jobsuche API as the first real source; source URL and date checked on every vacancy; "check if still active"; `/api/cron/discover-jobs` |
| 5 | Matching: rule-based 0–100 score with a visible breakdown plus an AI explanation of the real advert; APPLY / PREPARE FIRST / SKIP; a German-level gap is always shown as ⚠ |
| 6 | Application generator (German email, English email, Anschreiben, short message) and the review queue with APPROVE & SEND / EDIT / SKIP; scam protection over every advert |
| 7 | Tracker with the SPEC section 8 statuses and timeline; dashboard; "Today's priorities"; tasks |
| 8 | Company discovery by industry and region; contacts only with the page they were found on as evidence; agencies flagged; speculative applications |
| 9 | Email service with Gmail and Resend behind one interface; sending only from the approve button; replies read from the Gmail thread |
| 10 | Follow-ups after the configured days, drafted and queued, never sent unapproved |
| 11 | Interview assistant from the real advert and the confirmed profile; printable; also shown on the candidate's own page |
| 12 | Contract stage: extraction of the terms and the "important points to verify", with the not-legal-advice disclaimer |
| 13 | Pathway engine (§18a, §18b, §18g, §19c, §16d, §20a, §16a, §17) — every requirement with its official source, a CONFIRMED / LIKELY-NEEDS-CONFIRMATION / USER-SPECIFIC label, and a "Re-check sources" button that really fetches the official page |
| 14 | Personalised visa checklist with status, owner, deadline, notes and source |
| 15 | Opportunity Card module — refuses to compute points until the official table has been read; fixed result sentence; never "guaranteed" |
| 16 | Recognition assistant; FIND MY FASTEST REALISTIC PATH; weekly report; the natural-language agent over my data with confirmation before anything consequential |
| 17 | Track B — apprenticeship route, the plain "there is no unskilled work visa" statement, Ausbildung search, German plan to B1, §16a checklist, sponsor-gap calculator, bridges for 18–26 |
| 18 | Opportunity Radar — 17 official programmes with their official pages, weekly re-check, per-person fit, honest notes on short-stay visas and the parents route |
| 19 | Autopilot — nine agents (Scout, Matcher, Writer, Sender, Chaser, Reader, Radar, Immigration, Coach), `/api/cron/run` wired to Vercel Cron and a GitHub Actions hourly workflow, `rules.md` → strict JSON policy shown on Settings, the "Needs you" inbox, the candidate portal on a private revocable link, and safety rails no rule can switch off |

Tests: 129 unit tests (vitest) and a 10-case Playwright click-through that runs against the real app. `npm run check` runs lint,
typecheck, tests and build.

## Connected and verified (tested against the live project, not assumed)

* **Firestore** — the app's own data layer created, read, listed and deleted a record in
  `gjm_candidates`. Works.
* **Database rules** — published and verified live: `allow read, write: if false`. No browser can
  touch the data; only this app's server, through the Admin SDK. The previous rules let **any**
  signed-in account read and write everything, which with open sign-up meant anyone at all.
* **Firebase Auth** — one account, `arbeithilfede@gmail.com` / `CfWDd73AMaYe1dFR9AjiUUcPWVJ3`,
  recorded as the owner.
* **Drive API** — enabled, the service account authenticates.
* **Anthropic API** — the key authenticates, but the account has no credit, so AI calls are refused.

## Blocked on me (only you can do these)

1. **Firebase (project `certifypm-pro`)** — the web app config is in the code and was checked
   against the live project: email/password sign-in is already on. Still yours to do
   (`SETUP_FOR_ME.md` step 1): enable **Google** and **Phone** sign-in in the console, add the live
   Vercel address to the authorised domains, and download the **service-account key** for the server.
2. **Share the Drive folder** — step 2. Tested live: the Drive API is on and the service account
   works, but it can see **zero files**, so the folder is not shared with it yet. Open the folder →
   Share → `firebase-adminsdk-fbsvc@certifypm-pro.iam.gserviceaccount.com` → **Editor**. "Test the Drive connection" on the Settings page then
   both proves it works and warns if the folder is readable by anyone with the link.
3. **Anthropic credit** — step 3. The key works; the account balance is zero, so every AI call comes
   back refused. Add credit at console.anthropic.com → Plans & Billing. This is the only part that
   costs money, so it waits for you.
4. **Vercel deployment and `OWNER_UIDS`** — step 4, then step 5 to publish the database rules.
   Sign in with each method once and record every user id: a phone sign-in is always a separate
   Firebase user from the email/Google one.
5. **`CRON_SECRET` + GitHub secrets** — step 6, for the hourly agent run. The hourly schedule is
   switched off in the workflow while the tool is being built (it had nothing to call, so every run
   failed); step 6 says which two lines to uncomment once the app is live.
6. **An email provider (Resend or Gmail)** — step 7. Until then approved applications wait as
   "Approved – waiting for email connection". Gmail needs you to press "Allow" once.

NEEDS MY KEY: every item above. Nothing in the build is blocked on anything else.

## Next

1. You work through `SETUP_FOR_ME.md`.
2. Then start a session with the word `continue`: the connected parts get tested end to end against the
   real services (Drive upload, a real CV extraction, a real Bundesagentur search, a first application),
   and anything that fails gets fixed.
3. Then: run "Re-check sources" once so the immigration requirements carry a real checked-on date, and
   "Re-check every programme" so the Opportunity Radar fills in its deadlines.

## Security review (done after the first merge, no keys needed)

Reviewed the whole app against the way it will really be used: one owner, other people's identity
documents, a portal link that lives outside the login, and cron routes reachable from the internet.
Fixed:

* **An uploaded file could have been rendered as a page on the app's own address.** Documents are now
  served with a safe content type, as a download unless they are a PDF, an image or plain text, with
  `nosniff` and a locked-down content-security-policy.
* **The test login had a default password.** It now refuses to work at all unless a password is set,
  and the whole local mode is off without one.
* **The cron secret was compared character by character.** It is now compared in constant time.
* **A private portal link could have been indexed** if it ever leaked. The portal is marked noindex and
  the whole site is disallowed in `robots.txt`.
* **Researched links were stored as given.** Only `http(s)` links are stored or shown now, so a
  `javascript:` link from a web page can never become a link in the app.
* **Content from outside now looks like content, not orders.** Job adverts, employer emails and fetched
  official pages are wrapped in an `<untrusted-...>` block, and the house rules tell the model it may
  quote and report on them but never follow instructions inside them.

## Housekeeping (done in the same session)

* A start-up hook (`.claude/hooks/session-start.sh`) installs the dependencies when a session opens, so
  the checks can run immediately. It takes effect for every session once it is on `main`.
* The linter moved to the current ESLint configuration (`next lint` is being removed in Next.js 16).
  The stricter run found three real problems, now fixed: the company routes were not actually checking
  the evidence link, a request timer in the job source was never cleared, and two dead imports.

## Firebase sign-in (asked for after the first merges)

Checked against the live project with the web key: email/password is on, and the authorised domains
are localhost, certifypm-pro.firebaseapp.com, certifypm-pro.web.app, databutton.com and
certifypm_pro.databutton.app — so **this Firebase project already serves another application**.
Two things follow, both handled: every Firestore collection this tool writes is prefixed `gjm_` so the
two apps cannot share a collection, and `OWNER_UIDS` is effectively required here, because a project
with other people's accounts must not let them into this tool.


The app is wired to the project `certifypm-pro` with three ways in — email and password, Google, and a
phone code — behind one login screen. Because a phone sign-in is a different Firebase user from an
email or Google one, the owner is now a **list** of user ids (`OWNER_UIDS`, with the old `OWNER_UID`
still honoured), and the Firestore rules take that list too. `npm run firebase:setup` does the parts
that can be done through the API; what is left is named exactly, in SETUP_FOR_ME.md step 1.

## Written while waiting for the keys

The three pieces that only run once an account exists had never been executed even once, so they were
covered with tests against fakes: the Firestore driver, the Drive folder and upload logic, and the
message Gmail sends. Two things came out of writing them — the Gmail message builder moved into its own
file (`src/services/email/mime.ts`), and the Drive helpers now accept a client so they can be tested.

## Notes

* The build machine has no outbound access to `rest.arbeitsagentur.de` or the official German sites, so
  the live source calls could not be exercised here. The adapters are written against the real APIs and
  fail loudly with SOURCE NOT CONNECTED instead of inventing anything; they are covered by unit tests
  with recorded responses.
* No immigration threshold, amount, points table or language level is written into the code from memory.
  Those values only ever appear after "Re-check sources" has really read the official page, and they are
  stored with that page's URL and the date.

## The live deployment answered (13 September)

The address `https://germany-job-mission.vercel.app/login` returned the login screen and the sign-in
attempt reached Firebase, which refused it with `auth/unauthorized-domain`. That is three separate
things confirmed at once: the deployment is live, the Firebase variables reached it, and the login
screen's plain-language error handling works — the sentence shown is this app's own wording for that
Firebase code, not a crash.

Nothing to fix in the code. What is left is one click in the Firebase console: add the host name
`germany-job-mission.vercel.app` under **Authentication → Settings → Authorised domains**. SETUP_FOR_ME.md
step 1b now names that exact address instead of calling it an example.
