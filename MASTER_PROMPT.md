# Master build instructions — read fully before doing anything

You are building the complete "Germany Job Mission" tool described in SPEC.md, following BUILD_PLAN.md exactly, under the rules in CLAUDE.md. The owner is not technical and is not present; work autonomously.

## How to work
1. At the start of every session: read CLAUDE.md, STATUS.md, then the step in BUILD_PLAN.md you are on. Never restart from scratch; continue.
2. Execute the prompts in BUILD_PLAN.md in this order: Prompt 1 (write the architecture into ARCHITECTURE.md, do not wait for "go"), Prompts 2–7 (Phase 1), Prompt 8, Prompt 10, Prompt 11, Prompts 12–18, Prompt 9 (email) and Prompt 19 (Autopilot) last. Where a prompt says "tell me what to test", write it into TESTING.md instead and run the tests yourself (unit tests + a scripted click-through with Playwright).
3. After every prompt: run lint, typecheck, build and tests; fix everything; commit with a clear message; push; update STATUS.md (done / next / blocked).
4. Secrets: never write them into the repo. Read them from environment variables. Keep .env.local.example current. If a step cannot be fully verified without a secret I have not provided, build it, mark it "NEEDS MY KEY" in STATUS.md, and move on to the next step.
5. Cloud setup is done by the owner's browser agent using CHROME_SETUP_PROMPT.md; when STATUS.md says it is done and the secrets exist in GitHub Actions secrets / Vercel, use the service-account JSON (Owner role) with the gcloud and firebase CLIs to finish any remaining project configuration yourself (Firestore rules and indexes, Auth settings, APIs). Anything the owner must click (create Firebase project, get keys, connect Vercel, authorize Gmail, add a card) goes into SETUP_FOR_ME.md as numbered, plain-English click instructions with screenshots described in words. Keep that file short and in order of urgency.
6. Deployment: prepare the project for Vercel (vercel.json with the daily cron, build settings) and a GitHub Actions workflow for the hourly agent run. Write the exact Vercel click steps into SETUP_FOR_ME.md.
7. Quality bar: it must actually run. No placeholders, no fake data, no "TODO" in shipped features. Where an external service is not connected, the UI must show NOT CONNECTED with a link to the SETUP_FOR_ME.md step.
8. When every prompt is done and STATUS.md shows no open items except keys I must provide, write FINAL_README.md: how to log in, how to add a person, how the autopilot runs, how to change rules.md, and how to delete a person's data.

## What to do if I write "continue"
Read STATUS.md and carry on from "Next". Nothing else.

## What to do if I paste keys or say something is connected
Update .env handling instructions, test the affected feature end to end, clear the item from STATUS.md "Blocked on me", and continue.
