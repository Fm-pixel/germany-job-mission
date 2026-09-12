# Germany Job Mission

A private personal tool for helping specific people I know find a real job in Germany and then follow
the correct legal immigration path. Not a SaaS, not an agency.

* **Start here:** `SETUP_FOR_ME.md` — what to click, in order.
* **How to use it:** `FINAL_README.md`.
* **How it is built:** `ARCHITECTURE.md`.
* **How to test it:** `TESTING.md`.
* **The rules the agents obey:** `rules.md` (plain English, edit freely).
* **The specification:** `SPEC.md`, built according to `BUILD_PLAN.md` under the rules in `CLAUDE.md`.

```bash
npm install
cp .env.local.example .env.local   # then fill it in, see SETUP_FOR_ME.md
npm run dev
```

Stack: Next.js (App Router) · TypeScript · Tailwind · Firebase (Firestore + Auth) · Google Drive for
documents · Anthropic API · Bundesagentur für Arbeit job API.
