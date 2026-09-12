# Architecture — Germany Job Mission

Written in answer to BUILD_PLAN.md "Prompt 1". Plain language first, detail after.
Everything here is implemented in the code that follows; nothing is aspirational.

---

## 1. Architecture in one picture

```
Browser (my phone / laptop)
   |  Firebase Auth (email + password, one user: me)
   v
Next.js App Router (Vercel)
   |-- /src/app/...            pages I click on
   |-- /src/app/api/...        server routes (the only place secrets exist)
   |-- /src/agents/...         the autopilot workers (Scout, Matcher, Writer, ...)
   |-- /src/services/...       the building blocks every page and agent uses
   |        db          one data layer -> Firestore (swappable)
   |        jobs        job sources (Bundesagentur für Arbeit first)
   |        matching    candidate <-> job score + AI explanation
   |        ai          Anthropic API calls (server only)
   |        email       Gmail / Resend behind one interface
   |        documents   private Google Drive folder
   |        immigration pathways, Chancenkarte, recognition, checklists
   |        tracking    application statuses, timeline, priorities
   |        policy      rules.md -> strict JSON policy + hard safety rails
   v
Firestore (data)   Google Drive (files)   Anthropic API (thinking)   Email provider (sending)
```

Rule that shapes everything: **secrets live only on the server.** Pages never talk to
Anthropic, Drive, the job API or the email provider directly; they call `/api/...`,
the route checks my Firebase ID token, then calls a service.

### Folders

| Folder | What lives there |
|---|---|
| `src/app` | Pages (dashboard, people, jobs, applications, companies, opportunities, tasks, inbox, settings, agent chat, candidate portal) |
| `src/app/api` | Server routes: candidates, documents, jobs, matches, applications, email, immigration, cron, agent |
| `src/services/db` | The single data layer. Driver-based: Firestore in production, a local file store for testing (always labelled) |
| `src/services/*` | One folder per domain, listed in the picture above |
| `src/agents` | One file per autopilot agent + a runtime that runs the due ones and writes an audit log |
| `src/components` | UI building blocks (cards, tables, status pills, banners) |
| `src/lib` | Small helpers: auth guard, dates, formatting, NOT-CONNECTED detection |
| `tests` | Unit tests (vitest) and a scripted click-through (Playwright) |

### How the AI is called

One place: `src/services/ai/client.ts` creates the Anthropic client from
`ANTHROPIC_API_KEY` (server only) and exposes two calls — `askText()` for writing
and `askJson()` for extraction (structured output validated against a Zod schema,
so a malformed answer is an error, never silently wrong data). Model:
`claude-sonnet-4-6` (override with `ANTHROPIC_MODEL`). If the key is missing every
AI feature returns a typed `NOT_CONNECTED` result and the UI shows the yellow
banner with a link to the setup step — it never guesses and never pretends.

---

## 2. Data model

Firestore, one collection per table in SPEC section 25. Every document gets
`id`, `createdAt`, `updatedAt` automatically from the data layer.

| Collection | Key fields | Points to |
|---|---|---|
| `candidates` | name, country, city, email, phone, birthYear, profession, status, track (A skilled / B apprenticeship), portalToken | — |
| `candidate_profiles` | summary, skills[], industries[], jobTitles[], yearsExperience, confirmed, needsConfirmation[] | candidateId |
| `education` | school, degree, field, country, graduationYear, level | candidateId |
| `qualifications` | title, issuer, country, year, type (vocational/academic/certificate) | candidateId |
| `work_experience` | employer, title, from, to, country, description | candidateId |
| `languages` | language, level (A1–C2 / native), certificate | candidateId |
| `documents` | type, filename, driveFileId, mimeType, size, uploadedAt | candidateId |
| `companies` | name, industry, location, website, careersUrl, applicationMethod, contactEvidenceUrl | — |
| `jobs` | source, sourceId, url, title, employer, location, description, requirements, salary, languageRequirement, discoveredAt, checkedAt, active, kind (job/apprenticeship) | companyId (optional) |
| `job_sources` | key, name, status, lastRunAt, lastError | — |
| `job_matches` | score, breakdown[], explanation[], recommendedAction, generatedAt | candidateId, jobId |
| `applications` | status, statusHistory[], appliedAt, lastContactAt, followUpCount | candidateId, jobId, companyId |
| `application_messages` | channel, language, subject, body, attachments[], approvedAt, sentAt | applicationId |
| `emails` | provider, messageId, threadId, direction, to, subject, body, sentAt | applicationId |
| `interviews` | scheduledAt, mode, notes, prepPackId | applicationId |
| `offers` / `contracts` | employer, jobTitle, grossSalary, hours, location, startDate, probation, extractedAt, pointsToVerify[] | candidateId, applicationId |
| `visa_pathways` | key, name, lawRef, conditions[], documents[], sourceUrl, checkedAt | — |
| `visa_requirements` | pathwayKey, text, label CONFIRMED / LIKELY / USER-SPECIFIC, sourceUrl, checkedAt | — |
| `visa_assessments` | pathwayKey, result, reasoning[], createdAt | candidateId |
| `opportunities` | name, type, organiser, url, targetCountries, requirements, window, nextDeadline, checkedAt, status | — |
| `tasks` | title, priority 🔴🟠🟢, due, owner (me/candidate/employer), state | candidateId (optional) |
| `notes`, `sources`, `audit_logs` | free notes; every fetched official source with date; every agent action (who/what/when/why) | — |
| `settings` | singleton: policy JSON, provider connection states, rules text hash | — |

**Drive folder structure** (one private folder I own, shared with the service account):

```
Germany Job Mission – Documents/
  <candidate name> (<candidateId>)/
      CV/            certificates/      diplomas/
      references/    language/          passport/      contracts/
```
Firestore stores only the Drive **file ID** — never a public link.

---

## 3. Candidate workflow

1. I add a person (name, country, profession) — 10 seconds, nothing else required.
2. I upload their CV. It goes to their Drive subfolder; the AI extracts profession,
   skills, education, experience, years, languages, certificates, industries and
   job titles **with a confidence per field**.
3. Anything low-confidence or missing becomes a yellow **"Needs confirmation"**
   item. Nothing enters the profile until I (or the person, in their portal) confirm it.
4. The profile builder fills the rest (languages, Germany preferences, documents).
5. The candidate page then shows: header (name · profession · country · German /
   English level · status), and the journey: profile → matches → applications →
   interviews → offer/contract → immigration → doors.

## 4. Job matching workflow

**First real source: the Bundesagentur für Arbeit "Jobsuche" API** — the Federal
Employment Agency's own public job search API
(`https://rest.arbeitsagentur.de/jobboerse/jobsuche-service`, endpoint
`/pc/v4/jobs`, header `X-API-Key`, and `/pc/v2/jobdetails/<base64 hash>` for the
detail). It is the right first source: it is official, free, covers the whole
German market including apprenticeships (`angebotsart=4`), and every result links
back to a real `arbeitsagentur.de/jobsuche/jobdetail/...` page.

Sources are pluggable behind one interface:

```ts
interface JobSource { key; name; search(query); fetchDetail(id); checkStillActive(job); }
```

If the API cannot be reached (blocked network, missing key, changed endpoint) the
Jobs page shows **SOURCE NOT CONNECTED** with the exact error and what to fix.
It never invents a vacancy.

Matching runs in two halves:
* **Rule-based score 0–100** (deterministic, testable, works without AI):
  profession/title match, years of experience, qualification level, German level
  vs. the level demanded in the ad, English, location & relocation, salary,
  working time. Each component contributes a weighted sub-score and a line of
  reasoning.
* **AI explanation** on top: reads the real job text and produces the ✓ / ⚠ list
  exactly as in SPEC section 4 plus APPLY / PREPARE FIRST / SKIP with one reason.
  Hard rule in the prompt and enforced in code: if the ad asks for a German level
  above the candidate's, a ⚠ line is always shown; it can never be hidden.

## 5. Email workflow

`draft → my review → approve → send → track`

1. The Writer produces a German email, an English email, a German Anschreiben and
   a short message — from confirmed profile facts only. A missing fact becomes
   `[NEEDS INFO: …]`; it is never invented.
2. The application lands in the review queue "Approve applications" with COMPANY,
   POSITION, WHY MATCH, EMAIL, MESSAGE, ATTACHMENTS and the buttons
   APPROVE & SEND / EDIT / SKIP.
3. APPROVE & SEND calls the email service. Two providers behind one interface:
   Gmail (OAuth, my own address) or Resend (API key). If neither is connected the
   application becomes "Approved – waiting for email connection" and the provider
   shows NOT CONNECTED. **Nothing is ever sent by a cron job.**
4. Sent messages are stored in `emails` + `application_messages`; the application
   moves to Applied. Gmail replies are polled per thread and set "Reply received".

## 6. Immigration workflow

Disabled until a real opportunity exists (an offer or contract, or — for the
Opportunity Card and Track B modules — an explicit assessment I start). Then:

profile + offer → pathway engine (`src/services/immigration/pathways.ts`, one
entry per pathway: §18a, §18b, §18g Blue Card, §19c, recognition partnership
§16d, Opportunity Card §20a, training §16a) → RECOMMENDED PATHWAY with reasons →
DOCUMENTS REQUIRED → NEXT STEPS → personalised checklist with owner and deadline.

Every single requirement carries `sourceUrl` + `checkedAt` + a label
**CONFIRMED / LIKELY-NEEDS-CONFIRMATION / USER-SPECIFIC**, and the values that
change (salary thresholds, blocked-account amount, fees) live in one dated table
with a "Re-check sources" button. The app never says "guaranteed" and always ends
with "verify with the authority / a lawyer".

## 7. Security model

* One human user. Firebase Auth email+password; **sign-up is refused once one
  account exists** (checked server-side against the Admin SDK user list).
* Every `/api` route verifies the Firebase ID token with `firebase-admin` before
  doing anything. The only routes with a different rule are the cron route
  (needs `CRON_SECRET`) and the candidate portal (needs the person's long random
  token, which I can revoke).
* Firestore rules deny everything by default and allow only my UID
  (`OWNER_UID`) — no public read, no public write, client writes are not needed
  because everything goes through the server.
* The service-account JSON, the Drive folder ID, the Anthropic key and the email
  credentials exist only as environment variables on the server. `.env.local` is
  git-ignored; `.env.local.example` lists the names and nothing else.
* Audit log: every agent action and every send is written to `audit_logs`.
* Safety rails that no rule sentence can switch off: never fabricate, never send
  to a contact flagged as a scam, never exceed the daily cap, never spend money,
  always write the audit entry, never send without approval unless my own rule
  explicitly allows it for that person.

## 8. MVP build order (each step is testable on its own)

1. Scaffold, login, data layer, Drive documents, empty shell  ← *check: I can log in*
2. Candidate profiles + CV extraction  ← *check: extracted fields appear as "needs confirmation"*
3. Job search against the Bundesagentur API  ← *check: real vacancies with working links*
4. Matching with honest ✓ / ⚠ explanations  ← *check: the German-level warning is there*
5. Application generator + review queue  ← *check: nothing sends, nothing invented*
6. Tracker, dashboard, today's priorities  ← *check: the numbers match what I entered*
7. Company discovery
8. Email connection (Gmail or Resend)
9. Follow-ups
10. Interview assistant
11. Contract analysis
12. Visa pathway engine + checklist
13. Opportunity Card module
14. Recognition assistant + fastest realistic path
15. Track B (apprenticeship route)
16. Opportunity Radar
17. Autopilot: agents, rules.md → policy, "Needs you" inbox, candidate portal
