# Germany Job Mission — Build Plan & Claude Code Prompts

Private tool to help family and friends find a real German job and follow the correct legal path.
Stack: Next.js · TypeScript · Tailwind · Firebase (Firestore data + Auth login, free Spark plan) + Google Drive (documents, no card needed) · Anthropic API. Built step by step with Claude Code.

---

## Part A — Before you start (do this yourself, ~45 min)

1. **Create a folder** on your computer, e.g. `germany-job-mission`. Save the attached specification inside it as `SPEC.md` (the full document you gave me — unchanged).
2. **Firebase** (database + login, free): console.firebase.google.com → Add project `germany-job-mission` (Analytics off) → Build → Firestore Database → Create (production mode, region europe-west) → Build → Authentication → Get started → enable Email/Password. Then Project settings → General → "Your apps" → Web app → copy the config values. Project settings → Service accounts → Generate new private key → download the JSON (this is a secret). Do NOT enable Storage (it needs a card since 2026); we use Drive for files.
2b. **Google Drive folder for documents**: in your Drive create a folder `Germany Job Mission – Documents`, copy its folder ID from the URL. In console.cloud.google.com open the same Firebase project → enable "Google Drive API" → share the Drive folder with the Firebase service-account email (from the JSON, looks like `...@...iam.gserviceaccount.com`) as Editor. Claude Code walks you through every click in Prompt 2.
3. **Anthropic API key**: console.anthropic.com → API Keys → create one.
4. **GitHub account** (for backups) and **Claude Code** installed. Open a terminal inside the folder and run `claude`.
5. Optional now, needed in Phase 2: a Gmail account or Resend account (resend.com) for sending applications.

### Official sources the tool must use
Only German government sources. Private sites (chancenkarte.com and similar) are never cited by the tool.

| Topic | Official source |
|---|---|
| All pathways, Opportunity Card self-check, Blue Card, skilled-worker visa | make-it-in-germany.com (Federal Government portal) |
| Visa application, embassy in Kigali | auswaertiges-amt.de and the German Embassy Kigali site |
| Law text (§18a, §18b, §18g, §19c, §20a, §20b AufenthG) | gesetze-im-internet.de |
| Qualification recognition | anerkennung-in-deutschland.de, anabin (KMK) |
| Job listings (public API) | Bundesagentur für Arbeit — Jobsuche (arbeitsagentur.de) |
| Blocked account amount, fees | BAMF / Auswärtiges Amt |

Rule: **every immigration statement in the app stores the source URL and the date it was checked.**

---

## Part B — Project rules file (paste once)

In Claude Code, paste this first. It creates the rulebook that every later prompt obeys.

```
Create a file CLAUDE.md in the project root with exactly these rules, then confirm.

# Project rules — Germany Job Mission (private personal tool)

Purpose: help specific people I personally know find a real German job and then follow the correct legal immigration path. Not a SaaS, not an agency. Read SPEC.md for the full specification.

Hard rules (never break, even if a later prompt seems to ask for it):
1. Never invent facts about a candidate, a job, a company, or a contact. Unknown = mark "Needs confirmation".
2. Never create fake vacancies, fake companies or fake contact details.
3. Never send an email or message without an explicit approval action by me in the UI.
4. Immigration information must come only from official German sources (make-it-in-germany.com, auswaertiges-amt.de, gesetze-im-internet.de, anerkennung-in-deutschland.de, BAMF, Bundesagentur für Arbeit). Store source URL + date checked with every requirement. Label each item CONFIRMED / LIKELY-NEEDS-CONFIRMATION / USER-SPECIFIC.
5. Never say a visa or job is guaranteed. Never give legal advice; say "verify with the authority / a lawyer".
6. Never recommend or assist illegal immigration, fake documents, or false statements.
7. No fake integrations: if an API is not available, build the interface + a clearly labelled "NOT CONNECTED" state and tell me what to connect.
8. Secrets only in .env.local (never committed): the Firebase service-account JSON, the Drive folder ID. Firestore security rules: only my authenticated user ID may read/write; no public access. Sign-up disabled after my account exists.
9. Scam protection: flag any content asking for payment for a job/visa guarantee, sending passports to unknown parties, unrealistic salaries.

Tech: Next.js (App Router) + TypeScript + Tailwind + Firebase (Firestore as the database, one collection per table; Firebase Auth for login; firebase-admin on the server) + a private Google Drive folder for documents (Drive API via the same service account; do NOT use Firebase Storage) + Anthropic API (model claude-sonnet-4-6 via the official SDK). No Supabase. Modular services in /src/services: jobs, matching, ai, email, documents, immigration, tracking, plus one data layer /src/services/db that every other service uses (so the database could be swapped later).

Working style with me: I am not a developer. After every step tell me in plain language (1) what you built, (2) exactly what I should click/test, (3) what I need to provide next. Ask before deleting data. Keep the build order from SPEC.md section 28.
```

---

## Part C — Phase 1: Employment side (the heart)

### Prompt 1 — Architecture first (no code yet)

```
Read SPEC.md and CLAUDE.md fully. Before writing any code, explain in plain language (max 2 pages) :
1. Architecture (folders, services, how the AI is called)
2. Data model: Firestore collections for every table in SPEC section 25, key fields, how documents reference each other, and the Drive folder structure for files (one subfolder per person)
3. Candidate workflow
4. Job matching workflow (which real job source we start with — check whether the Bundesagentur für Arbeit Jobsuche API is publicly usable and describe it)
5. Email workflow (draft → my review → approve → send → track)
6. Immigration workflow (only triggered after a real job opportunity)
7. Security model (Firebase Auth single user, Firestore rules, service account only on the server, no secrets in the code)
8. MVP build order with a checkpoint after each step where I test

Then STOP and wait for my "go".
```

**You check:** does the plan start with the employment side, not the visa side? Does it name the Bundesagentur job API as the first real source? If yes, reply `go`.

### Prompt 2 — Scaffold, login, database

```
Step 1 of the MVP. Create the Next.js + TypeScript + Tailwind project in this folder. Add firebase, firebase-admin, googleapis and the Anthropic SDK.
- Create .env.local.example listing every variable I must fill: the NEXT_PUBLIC_FIREBASE_* web config values, FIREBASE_SERVICE_ACCOUNT_JSON (or path), GOOGLE_DRIVE_FOLDER_ID, ANTHROPIC_API_KEY.
- Build /src/services/db: a small data layer over Firestore (list, get, create, update, delete, with automatic IDs and timestamps) with typed collections for ALL tables in SPEC section 25. Every other service uses this layer.
- Write firestore.rules so only my authenticated user can read/write, and a script `npm run deploy-rules` (or tell me how to paste the rules in the Firebase console).
- Build /src/services/documents over the Google Drive API: upload into a per-person subfolder of my private Drive folder, download, delete. Do not use Firebase Storage.
- Build Firebase Auth email+password login; sign-up only works while no user exists, then it is disabled.
- Build the empty shell: sidebar with Dashboard, People, Jobs, Applications, Companies, Tasks, Settings. Clean, premium, calm design (dark sidebar, light content, one accent colour). Not a government site, not a CRM.
Then give me step-by-step click instructions to: (a) get the Firebase config and service-account key, (b) enable the Drive API and share my folder with the service account, (c) fill .env.local, (d) apply the Firestore rules, (e) start the app and create my one account.
```

**You check:** you can log in, see the empty sidebar, and after creating the test candidate in Prompt 3 you see it appear in Firebase console → Firestore.

### Prompt 3 — Candidate profiles + CV extraction

```
Step 2 and 3. Build "People I'm helping":
- Profile builder with the sections from SPEC section 2 (personal, professional, education, languages, Germany preferences, documents). Simple multi-step form, save at every step. Age only as year of birth. No passport number stored, only a document upload.
- Document upload into the person's subfolder in my private Drive folder, with type (CV, certificate, diploma, reference, language certificate, passport scan); the documents collection stores the Drive file ID, never a public link.
- CV analysis: when I upload a CV (PDF or DOCX), send it to the Anthropic API with a strict prompt that extracts profession, skills, education, experience, years of experience, languages, certificates, industries, job titles as JSON. Every field gets a confidence; low confidence or missing = "Needs confirmation" shown in yellow. I review and confirm before it becomes the profile. Never invent data.
- Candidate page header: name, profession, country, German/English level, status pill.
Test data: create one example candidate "Jean, Rwanda, Electrician, vocational qualification, 5 years, German A2, English good" so I can click through.
Tell me what to test.
```

**You check:** upload a real CV (of someone who agreed), see the extracted fields, confirm them, profile is saved.

### Prompt 4 — Job search with a real source

```
Step 4. Build the job search service with a pluggable source interface (JobSource: search, fetchDetail, checkStillActive). Implement the first real source: the Bundesagentur für Arbeit Jobsuche API (look up its current public documentation and required headers; it is a public API). If for any reason it cannot be called, do NOT fake results — show "SOURCE NOT CONNECTED" and tell me exactly what is missing.
- Every job stored with: source, original URL, date discovered, date checked, title, employer, location, description, requirements, salary if given, language requirement if detectable, active flag.
- Jobs page: search by candidate (uses their profession, preferred states, relocation flag) with filters. Button "Check if still active" per job.
- Daily automation hook (cron-ready route /api/cron/discover-jobs) that searches for every active candidate and stores new jobs — NOT sending anything.
Tell me how to test the search for Jean (electrician, any state).
```

**You check:** real vacancies appear with links to arbeitsagentur.de that open and match.

### Prompt 5 — Matching with explanations

```
Step 5. Build candidate ↔ job matching (service /src/services/matching):
- Rule-based score (0–100) from: profession match, years of experience, qualification level, German level vs. requirement in the ad, English, location/relocation, salary, full/part-time. Then the AI reads the job text and produces the explanation list (✓ / ⚠ items exactly as in SPEC section 4) and the recommended action APPLY / PREPARE FIRST / SKIP with one-sentence reason.
- Store in job_matches. Show on the candidate page sorted by score, with the explanation expandable.
- "Find matches" button per candidate and a nightly run in the cron route.
- Language rule: if the ad requires a German level above the candidate's, always show it as ⚠, never hide it.
Show me Jean's top 10 matches and tell me what to test.
```

**You check:** the ⚠ warnings are honest (e.g. employer wants B1, Jean has A2).

### Prompt 6 — Application generator + review queue

```
Step 6. Build the application generator:
- For a chosen match, generate: German application email, English application email, German cover letter (Anschreiben, German business standard, DIN-style), and a short LinkedIn-style message. Use ONLY the confirmed candidate profile; if a needed fact is missing, insert [NEEDS INFO: …] instead of inventing it. Subject line pattern: "Bewerbung als <Beruf> – Berufserfahrung aus <Land>".
- Review queue page "Approve applications": one card per application with COMPANY, POSITION, WHY MATCH, EMAIL, MESSAGE, ATTACHMENTS (choose from candidate documents). Buttons: APPROVE & SEND, EDIT (inline), SKIP.
- Since no email account is connected yet, APPROVE & SEND stores status "Approved – waiting for email connection" and shows the email provider as NOT CONNECTED. Do not fake sending.
- Scam-protection check runs over every job text before generation and shows a red banner if it hits the patterns from SPEC section 21.
Tell me what to test.
```

### Prompt 7 — Tracker, dashboard, priority queue

```
Step 7. Build the application tracker and my command center:
- Statuses from SPEC section 8; status change with date and note; timeline per application.
- Main dashboard "MY GERMANY JOB MISSION": People, Active applications, Interviews, Offers, Contracts. Below: "TODAY'S PRIORITIES" with 🔴🟠🟢 items computed from data (follow-ups due after 10 days without reply, applications waiting for approval, missing documents, interviews in the next 7 days, candidates with zero applications).
- People overview cards as in SPEC section 17; click opens the full journey (profile → matches → applications → later: interview, contract, visa).
- Tasks table wired to the priorities (done / snooze).
Then run a final check of Phase 1: list what works, what is NOT CONNECTED, and what I need to provide for Phase 2 (email).
```

**You check:** the numbers on the dashboard match what you entered. Phase 1 done — commit to GitHub (`ask Claude Code: "commit everything to git and push to a private GitHub repo, guide me"`).

---

## Part D — Phase 2: Companies, email, follow-up, interviews

### Prompt 8 — Company discovery
```
Step 8. Build company discovery: for a candidate's profession, propose the industry categories (e.g. electrician → electrical contractors, construction, industrial, facility management, renewable energy) and let me run searches per category and region using web search from the Anthropic API. Store companies with name, industry, location, website, careers page URL, application method, contact only if found on the company's own website (store the page URL as evidence). If no public contact is found, leave it empty — never guess. Link vacancies to companies. Company page with "generate speculative application" using the same review queue.
```

### Prompt 9 — Email integration
```
Step 9. Connect email. Implement the email service with two providers behind one interface: (a) Gmail API via OAuth for my own Gmail, (b) Resend as an alternative. Tell me which one is simpler for me and guide me through the setup screens step by step. Sending happens only from the APPROVE & SEND button. Attach selected candidate documents. Store every sent message in emails + application_messages, set status "Applied". For Gmail, poll the thread for replies and set "Reply received". Nothing is ever sent by cron.
```

### Prompt 10 — Follow-up system
```
Step 10. Follow-ups: for applications with status Applied and no reply after N days (default 10, configurable), create a 🔴 task "Follow up with <company>", generate a short polite German follow-up email, and put it in the review queue. Same approve-before-send rule. Max one follow-up per application unless I create another manually.
```

### Prompt 11 — Interview assistant
```
Step 11. When an application reaches "Interview": create an interview prep page generated from the real job text and the confirmed profile: likely questions (German + English), suggested answers strictly based on the candidate's real experience, German technical vocabulary for the profession, questions to ask the employer, and a short "how German interviews work" note. Export as PDF for the candidate.
```

---

## Part E — Phase 3: Contract and immigration

### Prompt 12 — Contract analysis
```
Step 12. Contract stage: upload offer/contract (PDF). Extract employer, job title, gross salary, hours, location, duration, start date, probation, notice period, other terms. Show "Important points to verify" with plain explanations. Big disclaimer: not legal advice, no statement about validity. Save to offers/contracts.
```

### Prompt 13 — Visa pathway engine
```
Step 13. Immigration pathway engine, only enabled once an offer or contract exists. Build a rules file /src/services/immigration/pathways.ts where each pathway (skilled worker with vocational qualification §18a, with academic degree §18b, EU Blue Card §18g, experienced worker/§19c-type route, recognition partnership, Opportunity Card §20a, vocational training) has: conditions, required documents, official source URL, date checked, and a label CONFIRMED / LIKELY / USER-SPECIFIC per requirement. Research the current values (salary thresholds, language levels, blocked-account amount) from make-it-in-germany.com, auswaertiges-amt.de and gesetze-im-internet.de TODAY and store them with the date. Show RECOMMENDED PATHWAY with reasons, DOCUMENTS REQUIRED, NEXT STEPS, and links. Add a "Re-check sources" button that re-fetches and highlights changes.
```

### Prompt 14 — Visa checklist
```
Step 14. Personalized visa checklist from the chosen pathway: each item with status, owner (me / candidate / employer), deadline, notes, upload. Show ✓ / ⚠ overview on the candidate journey.
```

### Prompt 15 — Opportunity Card module
```
Step 15. Opportunity Card (Chancenkarte) assessment as ONE module, using the official points criteria (§20a/§20b AufenthG and make-it-in-germany.com self-check; fetch and store the current table with source + date). Show the reasoning per criterion, the base requirements (2-year vocational training or degree recognised in the home country; German A1 or English B2; financial proof), the points total, and the fixed result sentence: "Your information suggests that you may qualify, but final eligibility must be confirmed by the German authorities." Never output "guaranteed".
```

### Prompt 16 — Recognition assistant + "Fastest realistic path"
```
Step 16. (a) Recognition assistant: from profession + qualification + issuing country, use anerkennung-in-deutschland.de to find whether the profession is regulated, the likely competent authority, required documents, and link the official page. Mark everything LIKELY unless the official page states it. (b) The big button FIND MY FASTEST REALISTIC PATH TO GERMANY: rank pathways for the candidate as in SPEC section 16 (LEGAL, REALISTIC, FAST, EMPLOYMENT-FIRST), with reason and next action per path. (c) Weekly report email to me (SPEC section 26). (d) Natural-language "Germany Job Agent" chat over my data, with confirmation dialog before any consequential action.
```

---

## Part F — Working rhythm

- One prompt per session. After each: test what Claude Code tells you, then type `commit and push` before the next prompt.
- If something breaks, paste the error and write: `Fix this. Explain in one sentence what went wrong.`
- Once a month: `Re-check all immigration sources and list what changed.` Rules change (thresholds, blocked-account amount); the date-checked column is your safety net.
- Never enter a candidate's data without their consent; keep passports as uploads only, and delete a person's data when they ask (`Delete candidate X completely, including storage files`).

---

## Part G — Track B: people WITHOUT a vocational qualification (young, strong, no job at home)

Reality the tool must state plainly: Germany issues no work visa for unskilled "helper" jobs to East African nationals, and no tool can promise a visa percentage. The legal route for this group is a paid apprenticeship (Ausbildung, §16a AufenthG). Build this as its own track.

### Prompt 17 — Track B module

```
Add "Track B – Apprenticeship route" for candidates flagged "no vocational qualification / no degree":
1. Eligibility screen: age, school-leaving certificate (upload), current German level, English level, money situation (own funds / sponsor / none). No promises – show the sentence "There is no visa for unskilled jobs; the realistic legal path is a paid apprenticeship."
2. Apprenticeship search: use the Bundesagentur für Arbeit API for Ausbildungsstellen (training vacancies) in shortage fields (construction, logistics, hospitality, care assistance, crafts, driving, food industry). Store like jobs. Flag employers that state they take international applicants.
3. Outreach: same review/approve queue, but templates for an apprenticeship application (German B1-level wording, honest about current language level and planned language course).
4. German plan: per person, a plan from current level to B1 with a target date, Goethe/telc/ÖSD exam options in their country, and the alternative "language-course visa (§16f) then apprenticeship" path. Store as tasks with deadlines.
5. §16a visa checklist from official sources (make-it-in-germany.com, auswaertiges-amt.de, the responsible German embassy page): training contract, B1 certificate or employer confirmation/language-course registration, school certificate, financial proof (training pay vs. current required amount – fetch and store with date), health insurance, passport. Include a sponsor calculator: if training pay is below the required amount, show the monthly gap and that a Verpflichtungserklärung makes the sponsor liable.
6. Bridges for 18–26: au pair, FSJ/BFD voluntary service, visa to search for a training place (up to 6 months) – each with official source and label LIKELY/CONFIRMED.
7. In "Fastest realistic path": for this group rank Apprenticeship first, and show "Unskilled work visa: NOT AVAILABLE for this nationality (source: …)".
Keep every rule from CLAUDE.md. Tell me what to test.
```

**You check:** for a test person with no qualification, the tool never shows a percentage and never shows a "helper job visa" option.

---

## Part H — Opportunity Radar: all other legal doors (programs, scholarships, exchanges, family, events)

Rules for this module: short-stay visitor visas (events, meetings, conferences) are networking chances only, never a way to stay; family reunification for parents is shown as "very limited – hardship cases only"; every program is stored with an official link, deadline and date checked.

### Prompt 18 — Opportunity Radar

```
Build "Opportunity Radar":
1. Collection opportunities: name, type (program / scholarship / exchange / volunteer / study / family / event / labour agreement), organiser, official URL, target countries, requirements (age, language, education), application window open/close, next deadline, date checked, status (open / closed / watching).
2. Seed it by researching these with web search and storing only what the official page says: GIZ Programm Migration & Diaspora and CIM; ZAV placement projects; Triple Win (nursing); Hand in Hand for International Talents; government labour agreements (Kenya–Germany exists; watch Rwanda, Uganda, Tanzania, Burundi); DAAD scholarships; Studienkolleg and student visa (§16b); language-course visa (§16f); weltwärts South-North; FSJ/BFD; au pair; Rhineland-Palatinate–Rwanda partnership projects; Goethe-Institut Kigali; Make it in Germany job fairs; German Embassy Kigali events; family reunification (§28–§30, §32, §36 – label parents route "very limited"). Mark anything not confirmed on an official page as NEEDS CONFIRMATION.
3. Weekly cron: re-check each source page, detect changes and new deadlines, create a 🟠 priority "Open call: <program> – deadline <date> – fits: <names>".
4. Matching: for every person, list which opportunities they fit and what is missing (e.g. "needs B1", "age limit 26", "requires bachelor").
5. Person page: "Doors for <name>" ranked by realism and speed, with the honest note for short-stay visas and the parents route.
6. Everything read-only and informational; applying still goes through the review/approve queue.
Tell me what to test.
```

**You check:** each opportunity opens an official page; no program appears without a source; visitor visas are never listed as a residence path.

---

## Part I — Autopilot: agents do the work, I only decide

Goal: after setup, the tool runs by itself. Agents search, match, write, send (within my rules), follow up, read replies and prepare the visa file. I get one daily summary and a short list of real decisions. The candidate gets her own to-do list for the few things only she can do.

### Prompt 19 — Agent runtime + plain-English rules + inbox

```
Build the Autopilot layer on top of everything built so far:
1. Agent runtime: /src/agents with one agent per job: Scout (job discovery + link checks), Matcher, Writer, Sender, Chaser (follow-ups), Reader (incoming replies → status update + drafted answer), Radar (programs/deadlines), Immigration (pathway + checklist + recognition file as soon as an offer exists), Coach (interview pack). Each agent has a run() that logs what it did to an audit collection (who, what, when, why) and never repeats work already done.
2. Scheduling: a single /api/cron/run route that runs the due agents; wire it to Vercel Cron (daily) and give me a GitHub Actions workflow that calls it hourly as well. Explain which one I need to enable.
3. rules.md in the project root, written in plain English, read by the agents at every run via the Anthropic API and converted to a strict JSON policy (thresholds, per-person review counts, daily caps, blocked recipient types, what to notify). Show me the parsed policy on a Settings page so I can see how my sentences were understood. Start with this content:
   "Send applications automatically when the match is 85% or higher. For a new person, show me the first 5 applications before sending, then go automatic. Follow up after 10 days, once. Never send to recruiters or agencies, only directly to employers. Never send more than 8 applications per person per day. Anything that costs money waits for me. Tell me only about replies, interviews, offers, deadlines, and things that need money."
4. Inbox: a page "Needs you" with only items the policy requires me to decide, each with one-tap Approve / Edit / Skip; plus a daily summary sent to me by email (and optionally WhatsApp via a provider I can connect later – label NOT CONNECTED until then).
5. Candidate portal: a simple mobile-friendly page per person with a private link (long random token, revocable) where she can confirm facts marked "Needs confirmation", upload documents, see her to-do list (language exam, interview date, embassy appointment), and read interview packs. The Chaser agent reminds her by email when a to-do is overdue.
6. Safety rails that no rule can switch off: never fabricate, never send to a flagged scam contact, never exceed the daily cap, never spend money, always keep the audit log.
Tell me what to test, and give me three example rule sentences I could add later.
```

**You check:** change a sentence in rules.md, reload Settings, and confirm the parsed policy changed. Watch one full cron run in the audit log: search → match → draft → (review or send) with nothing invented.

**Hosting for the schedule:** deploy on Vercel (free Hobby plan runs daily cron jobs); the GitHub Actions workflow adds hourly runs at no cost. Claude Code guides both.
