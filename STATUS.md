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

Tests: 118 unit tests (vitest) and a 10-case Playwright click-through that runs against the real app. `npm run check` runs lint,
typecheck, tests and build.

## Blocked on me (only you can do these)

1. **Firebase (project `certifypm-pro`): the service-account key** — `SETUP_FOR_ME.md` step 1a.
   With it, `npm run firebase:setup` registers the web app, writes the config into `.env.local` and
   switches on Email/password and Phone sign-in. **Google sign-in has to be enabled in the console
   once** (Firebase creates its OAuth client at that moment), and the live web address has to be added
   under Authentication → Settings → Authorised domains.
2. **Google Drive folder + Drive API** — step 2. Until then documents cannot be stored.
3. **Anthropic API key** — step 3. Until then CV reading, application writing, company research, the
   Opportunity Radar research, the Chancenkarte criteria and the assistant are switched off (the pages
   say so and the rule-based parts keep working).
4. **Vercel deployment and `OWNER_UIDS`** — step 4, then step 5 to publish the database rules.
   Sign in with each method once and record every user id: a phone sign-in is always a separate
   Firebase user from the email/Google one.
5. **`CRON_SECRET` + GitHub secrets** — step 6, for the hourly agent run.
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
