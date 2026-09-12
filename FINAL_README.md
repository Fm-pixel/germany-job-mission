# Germany Job Mission — how to use it

A private tool for helping specific people you know find a real job in Germany and then follow the
correct legal path to get there. Not a business, not an agency, not for strangers.

## How to log in

Open your Vercel address (for example `https://germany-job-mission.vercel.app`) on your phone or laptop
and sign in with the email and password you created in `SETUP_FOR_ME.md` step 4.

Only your account can open it. Sign-up switched itself off the moment your account existed, and the
database rules only allow your user ID.

## How to add a person

1. **People → Add a person.** Name, country and profession are enough to start.
   Only add someone who knows about it and agreed — the form asks you to confirm that.
2. Open them and go to **Documents & CV**. Upload their CV (PDF is best).
3. Press **Read this CV.** The tool shows what it found, with everything uncertain marked yellow.
   Nothing is saved until you press **Confirm and save to the profile**. It never fills a gap by guessing.
4. Fill in the rest under **Profile**: languages, education, Germany preferences.
5. **Jobs** → pick the person → **Search the Bundesagentur.** Real vacancies appear, each with its
   original link and the date it was checked.
6. Back on the person: **Matches → Find matches.** Every match explains itself:
   ✓ what fits, ⚠ what does not. A German-language gap is always shown — never hidden to make a
   match look better.
7. **Write the application** on a good match. It lands in **Applications → Review queue**, where you
   read it and press **APPROVE & SEND**, **EDIT** or **SKIP**.

## How the autopilot runs

Nine agents do the routine work. They run daily through Vercel and hourly through GitHub Actions.

| Agent | What it does |
|---|---|
| Scout | Searches the job sources for every active person; re-checks whether stored vacancies are still live. |
| Matcher | Scores every vacancy against every person and explains the strongest ones. |
| Writer | Writes the applications for matches recommended as APPLY and puts them in the review queue. |
| Sender | Sends **only** what your rules allow, and only through the safety rails. |
| Chaser | Prepares follow-ups for silent employers and reminds the person about their own overdue to-dos. |
| Reader | Reads employer replies, updates the status, and drafts an answer for you. |
| Radar | Re-checks the official programme pages weekly and raises open calls with their deadline. |
| Immigration | The moment a real offer exists, works out the pathway and builds the visa checklist. |
| Coach | Prepares the interview pack whenever an application reaches the interview stage. |

**"Needs you"** in the sidebar is your whole job: only the decisions your own rules say you must make.
Everything the agents did is in **Settings → Audit log** — who, what, when and why.

## How to change the rules

Open `rules.md` on GitHub, press the pencil, write plain English sentences, commit.
Then open **Settings** in the app and press **Re-read rules.md**. The page shows, in your own words,
how each sentence was understood — and lists any sentence it could not turn into a rule.

Three sentences you could add later:

* "Never apply to companies with fewer than 10 employees."
* "For Aline, always show me every application before sending."
* "If someone has had no reply for 30 days, tell me so we can change the plan."

Six rails can never be switched off by any sentence: never invent a fact; never send to a contact the
scam protection flagged; never exceed the daily cap; never spend money; never send a draft that still has
a missing fact; always write to the audit log.

## How to delete a person's data

Open the person, go to **Profile**, and use the delete action — or ask in a Claude Code session:
*"Delete candidate X completely, including the files."* It removes the profile, education,
qualifications, work history, languages, matches, applications, messages, emails, interviews,
assessments, checklists, tasks and notes, and deletes their files from your Drive folder.
The deletion itself is written to the audit log. Do it as soon as they ask.

## What this tool will never do

* Promise a job or a visa. Nobody can.
* Give legal advice. Every immigration statement carries its official source, the date it was checked,
  and a label: CONFIRMED / LIKELY-NEEDS-CONFIRMATION / USER-SPECIFIC.
* Invent a vacancy, a company, a contact, a salary or a requirement. Where something is missing it says
  "Needs confirmation" or writes `[NEEDS INFO: …]` into the draft.
* Send anything you did not approve, unless your own rule in `rules.md` allows it for that person.
* Help with illegal routes, fake documents or false statements.

If an outside service is not connected, the page says **NOT CONNECTED** and names the step in
`SETUP_FOR_ME.md` — it never pretends.

## Where things are

| File | What it is |
|---|---|
| `SETUP_FOR_ME.md` | The click-by-click setup, in order of urgency. |
| `rules.md` | Your rules, in plain English. |
| `TESTING.md` | How to test it, by hand and automatically. |
| `ARCHITECTURE.md` | How it is built, in plain language. |
| `STATUS.md` | What is done, what is next, what is waiting for you. |
