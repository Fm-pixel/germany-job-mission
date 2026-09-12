# Testing

Two kinds of test, both runnable without any account or key.

```bash
npm run lint        # code style
npm run typecheck   # types
npm test            # unit tests (vitest)
npm run build       # the production build
npm run check       # all four in order
```

## Unit tests — `tests/unit`

They cover the parts where a mistake would hurt a real person:

| File | What it protects |
|---|---|
| `matching.test.ts` | The score, and the promise that a German-level gap is **always** shown as a ⚠ and never hidden. |
| `scam.test.ts` | Every pattern from SPEC section 21 is caught, and an ordinary German advert is not falsely flagged. |
| `policy.test.ts` | `rules.md` is read correctly, and the safety rails cannot be loosened by any sentence in it. |
| `db.test.ts` | The data layer: create / read / update / delete, filtering, sorting, and that every SPEC section 25 table exists. |
| `jobs.test.ts` | The Bundesagentur adapter parses a real answer, and **fails loudly instead of inventing vacancies** when the API cannot be reached. |
| `immigration.test.ts` | Employment routes stay blocked until a real job offer exists; nothing claims to be CONFIRMED before a source was actually read; Track B ranks the apprenticeship first. |
| `agents.test.ts` | The automatic-send rails: threshold, daily cap, review-first count, scam flags, missing facts, paused people. |

## The scripted click-through — `tests/e2e`

This replaces "tell me what to test" while the build runs unattended. It starts the real app in
**local test mode** and clicks through it.

```bash
# 1. example person (never touches Firestore — it refuses without the flag)
GJM_DB_DRIVER=local-file node scripts/seed-example.mjs

# 2. build and run the click-through
npm run build
npm run e2e
```

If your machine has a prepared Chromium instead of Playwright's own download:

```bash
PLAYWRIGHT_CHROMIUM_PATH=/path/to/chrome npm run e2e
```

What it checks: the dashboard and every sidebar page load; the example person opens with their journey,
profile and matches; matching shows the honest "employer asks for German B1, candidate has A2" warning;
the review queue says nothing is sent without approval and shows email as NOT CONNECTED; the job search
reports the source state truthfully instead of inventing vacancies; the immigration page refuses to start
before a real job offer; Settings shows how `rules.md` was understood and the rails that cannot be
switched off; the Opportunity Radar states its honest limits; Track B says plainly that no unskilled work
visa exists.

## Local test mode

Three environment variables, for testing only. They are never set in production:

```
GJM_DB_DRIVER=local-file   # data in ./.gjm-data instead of Firestore
GJM_LOCAL_MODE=1           # the test login (refuses to work once a real service account is present)
GJM_LOCAL_PASSWORD=...     # the password for it
```

While either of the first two is active, a **LOCAL TEST MODE** banner is shown on every page, so it can
never be mistaken for the real thing.

## Testing by hand, once it is deployed

1. Log in. The dashboard shows five numbers and "Today's priorities".
2. **People → Add a person.** Name, country, profession is enough.
3. Open them → **Documents & CV** → upload a real CV (of someone who agreed) → **Read this CV**.
   Check the yellow "needs confirmation" items, then **Confirm and save to the profile**.
4. **Jobs** → choose the person → search. Open one vacancy link: it must open a real advert that matches.
5. The person's **Matches** → **Find matches**. Read the ⚠ lines: they must be honest.
6. **Write the application** on one match → **Applications → Review queue**. Read it. Nothing has been sent.
7. **Settings** → change a sentence in `rules.md`, commit, press **Re-read rules.md**, and watch the
   "Understood as" column change.
