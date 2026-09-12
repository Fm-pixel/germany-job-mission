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

AUTONOMOUS MODE: I am not sitting at the keyboard. Read MASTER_PROMPT.md and STATUS.md at the start of every session and continue the build without asking me questions unless you are blocked by something only I can provide (a key, a login, a payment). Record progress in STATUS.md after every step.
