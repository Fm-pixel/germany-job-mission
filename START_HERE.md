# Start here — building online, no computer needed (about 20 minutes of clicking, once)

1. GitHub (github.com, free account) → "New repository" → name `germany-job-mission` → Private → Create.
   Then "Add file → Upload files" and upload ALL files from this zip: SPEC.md, BUILD_PLAN.md, CLAUDE.md, MASTER_PROMPT.md, STATUS.md, rules.md, START_HERE.md, CHROME_SETUP_PROMPT.md. Commit.
2. Go to claude.ai/code (needs Claude Pro, Max or Team). Connect your GitHub account when asked and pick the repository `germany-job-mission`.
3. Start a session and send exactly this message:

   Read MASTER_PROMPT.md and build the whole tool. Work autonomously.

4. Let it run. It pushes a branch; when a session finishes, open the pull request it made on GitHub and press "Merge" (green button), then start a new session with the single word:

   continue

   Repeat "merge → continue" until STATUS.md says everything is done except items under "Blocked on me".
5. Cloud accounts — let the browser agent do it: install "Claude in Chrome", log in to Google, GitHub and Vercel in Chrome, open the repo file CHROME_SETUP_PROMPT.md, copy its text into Claude in Chrome and let it click through Firebase, Google Cloud, Drive, Vercel and GitHub for you (you only type passwords/phone codes if asked). This can be done before or during the build. Afterwards send "continue" in claude.ai/code so Claude Code tests the connected parts.
   Gmail sending (Prompt 9) needs you to press "Allow" once in Google's authorization screen; Claude Code puts the exact link in SETUP_FOR_ME.md.
6. Your app is then live at the Vercel address. Log in from your phone. Add your sister as the first person, upload her CV, and the autopilot takes over according to rules.md.

Changing behaviour later: edit rules.md on GitHub (pencil icon), commit. Done.
Getting help later: start a session at claude.ai/code and describe the problem in plain English.
