# What I need you to do (in order of urgency)

Plain steps, most important first. Everything else the tool does by itself.
Each step ends with **how you know it worked**.

---

## Step 1 — Firebase: the database and your login (project `certifypm-pro`)

**The web app is already registered and its config is already in the code**
(`src/lib/firebase-config.ts`). Those six values are public identifiers, not
secrets — they ship inside the JavaScript every visitor downloads, and Google
documents them as safe to expose. What protects your data is the login plus the
database rules below.

I checked your project directly. What is already true:

* ✅ **Email/password sign-in is switched on.**
* ✅ Authorised domains include `localhost`, `certifypm-pro.firebaseapp.com`
  and `certifypm-pro.web.app`.
* ⚠️ **This project is already used by another app** — `databutton.com` and
  `certifypm_pro.databutton.app` are on the authorised list. See 1d.

### 1a. Switch on Google and Phone sign-in (3 minutes)

Firebase console → **certifypm-pro** → **Authentication → Sign-in method**:

| Method | What to do |
|---|---|
| **Google** | Enable → choose a **support email** → Save. This has to happen here: it is the moment Firebase creates the Google OAuth client. |
| **Phone** | Enable. The free SMS quota is small; Firebase will ask for billing if you need more. |

### 1b. Add your live web address (1 minute)

**Authentication → Settings → Authorised domains → Add domain**, and add the
address Vercel gives you (for example `germany-job-mission.vercel.app`).

Without this, Google and phone sign-in fail on the live site with "this domain
is not authorised" — `localhost` works, the real address does not, which is a
confusing way to find out.

### 1c. The service-account key (2 minutes)

The server needs it to read and write the database and your Drive folder.

1. Console → gear icon → **Project settings → Service accounts**.
2. **Generate new private key → Generate key**. A `.json` file downloads.
3. This one **is** a secret. It goes into Vercel as `FIREBASE_SERVICE_ACCOUNT_JSON`
   (step 4), never into a file in the repository.

Optional check, if you have the repository on a computer:

```bash
FIREBASE_SERVICE_ACCOUNT_JSON='<paste the whole JSON>' npm run firebase:setup
```

It confirms the web app, writes the config into `.env.local`, and switches on
Email/password and Phone for you.

### 1d. Because the project is shared with another app

`certifypm-pro` already serves something else (Databutton). Two consequences,
both handled, but you should know about them:

* **The data is kept apart.** Every collection this tool writes is named
  `gjm_…` (`gjm_candidates`, `gjm_jobs`, …), so it cannot mix with the other
  app's data. To change that, set `FIRESTORE_COLLECTION_PREFIX`.
* **`OWNER_UIDS` is not optional here.** If the project already has user
  accounts from the other app, this tool refuses every sign-in until you tell
  it which user id is yours (1f). That is deliberate: without it, anyone with
  an account in that project could open your tool.

### 1e. Firestore

**Build → Firestore Database**. If there is no database yet, **Create database**
→ **production mode** → location **europe-west3 (Frankfurt)**. Do **not** set up
Storage — this tool uses your Google Drive for files, so no card is needed.

### 1f. ✅ Already done — the database is locked

Published and verified on your project: **no browser can read or write the
database at all**, including anyone who signs up. That is stronger than the
usual "only my user id" rule and costs nothing here, because this app never
touches Firestore from the browser — every read and write goes through its own
server. Who may *use the app* is decided separately, by `OWNER_UIDS`.

Your account `arbeithilfede@gmail.com` (`CfWDd73AMaYe1dFR9AjiUUcPWVJ3`) is the
owner. Put that id in `OWNER_UIDS` in Vercel (step 4).

### 1g. If you ever need to redo the lock

1. Sign in **once with each method you want to use** (email, Google, phone).
2. Console → **Authentication → Users**. Copy the **User UID** of every row that
   is you. Google and email/password normally share one row; **a phone sign-in
   is always its own row with its own id**.
3. Add them to `OWNER_UIDS`, comma separated:
   `OWNER_UIDS=CfWDd73AMaYe1dFR9AjiUUcPWVJ3,the-phone-one`
4. `npm run deploy-rules` re-publishes the database lock (it does not need the
   ids — the lock is "no browser at all").

If a sign-in is refused, the screen shows you the exact user id to add.

**Optional, recommended:** restrict the web API key so it only works from your
own address — console.cloud.google.com → **APIs & Services → Credentials** →
the browser key → **Website restrictions**.

**How you know it worked:** you can sign in all three ways, and **Settings**
shows "Login (Firebase Auth) — connected" and "Owner lock — connected".

## Step 2 — Google Drive: where the documents live

You have already made the folder and sent me its link, so its ID is in place
here. Two things are left, and they both need the service-account key from step 1c.

1. **Turn on the Drive API.** console.cloud.google.com → pick the project
   **certifypm-pro** → **APIs & Services → Library** → search **Google Drive API**
   → **Enable**.
2. **Share the folder with the service account.** Open the folder in Drive →
   the folder name at the top → **Share** → paste this address:

   ```
   firebase-adminsdk-fbsvc@certifypm-pro.iam.gserviceaccount.com
   ```

   → set it to **Editor** → Send. Without this the app can see nothing in the
   folder: the link on its own gives it no access. **Editor, not Viewer** — it
   has to be able to put files in.
3. **Add the folder ID to Vercel** as `GOOGLE_DRIVE_FOLDER_ID` (step 4). It is
   deliberately not written into any file in the repository.

**Check the sharing yourself, once.** This folder will hold passport scans,
diplomas and contracts belonging to other people. In Drive, open **Share** and
make sure the top of the box says **Restricted** — *not* "Anyone with the link".

**How you know it worked:** on the app's **Settings** page press **Test the
Drive connection**. It must say `Connected to the Drive folder "…"`. It also
reads who the folder is shared with and warns you in red if it is open to
anyone with the link, or shared with a whole organisation, or with a crowd of
people.

## Step 3 — Anthropic: the thinking part

The key you gave me **works** — it authenticates fine. But the account has **no
credit**, so every AI call is refused:

> Your credit balance is too low to access the Anthropic API.

**What to do:** console.anthropic.com → **Plans & Billing** → add credit. This
is the one part of the setup that costs money, so it is your decision, not mine.

Until there is credit, the app tells you so in plain words and keeps working:
job search, matching scores, the tracker, the checklists and the Opportunity
Radar are all unaffected. What pauses is CV reading, writing applications,
company research and the assistant.

**How you know it worked:** on the Settings page, "AI (Anthropic API)" shows **connected**.
Without it the app still runs — CV reading, application writing and the assistant are simply switched off
and say NOT CONNECTED.

---

## Step 4 — Put it online with Vercel (10 minutes)

1. Open **vercel.com**, sign in with GitHub, press **Add New → Project** and import the repository
   `germany-job-mission`.
2. **Before** pressing Deploy, open **Environment Variables** and add these, one per line
   (names exactly as written). The six `NEXT_PUBLIC_FIREBASE_*` values are **not** needed —
   they are already in the code:

   | Name | Value |
   |---|---|
   | `FIREBASE_SERVICE_ACCOUNT_JSON` | the whole JSON from step 1c, as one line |
   | `OWNER_UIDS` | left empty for now — you fill it in after your first sign-in (step 1f) |
   | `GOOGLE_DRIVE_FOLDER_ID` | from step 2.4 |
   | `ANTHROPIC_API_KEY` | from step 3 |
   | `CRON_SECRET` | any long random word you invent |
   | `OWNER_EMAIL` | your own email address |

3. Press **Deploy**. When it finishes, Vercel shows an address like
   `https://germany-job-mission.vercel.app`. Copy it.
4. Add one more environment variable `APP_URL` with that address, and press **Redeploy**
   (Deployments → the three dots on the newest one → Redeploy).
5. Open the address on your phone or laptop. You see the login screen with three tabs:
   **Email**, **Google** and **Phone**. Sign in whichever way you like — with email, the first
   time offers **Create the first account** (sign-up switches itself off afterwards).
6. Add that address under **Authentication → Settings → Authorised domains** in Firebase,
   or Google and phone sign-in will refuse to run on it.
7. Go back to Firebase → **Authentication → Users** and copy the **User UID** of every row that
   is you. Add them in Vercel as `OWNER_UIDS` (comma separated), then **Redeploy** once more.
   From now on only your own account(s) can open the app.

**How you know it worked:** you can log in and see the dashboard "My Germany Job Mission".

---

## Step 5 — Lock the database (5 minutes)

Two ways, pick one.

**The easy way (in the browser):**
1. Firebase console → **Build → Firestore Database → Rules** tab.
2. Delete everything there and paste the content of the file `firestore.rules` from the repository.
3. Replace `'REPLACE_WITH_YOUR_OWNER_UID'` with your User UID(s) from step 4.7 — each
   in quotes, separated by commas, e.g. `['abc123', 'xyz789']`.
4. Press **Publish**.

**The automatic way (on a computer with the repository):** set `FIREBASE_SERVICE_ACCOUNT_JSON` and
`OWNER_UIDS` in `.env.local`, then run `npm run deploy-rules`.

**How you know it worked:** the Rules tab shows your UID(s) inside the rules and the date of publishing.

---

## Step 6 — The automatic runs (5 minutes)

Vercel runs the agents once a day (it is in `vercel.json`) as soon as the app is deployed.

**The hourly GitHub run is switched off on purpose while the tool is being built** — there is
nothing deployed for it to call, so it only produced a failed run every hour. Switch it on when the
app is live:

1. GitHub → your repository → **Settings → Secrets and variables → Actions → New repository secret**.
2. Add `APP_URL` (the Vercel address) and `CRON_SECRET` (the same random word as in step 4).
3. Edit `.github/workflows/agents.yml` and remove the `#` in front of these two lines:
   ```yaml
     # schedule:
     #   - cron: '17 * * * *'
   ```
4. Commit. From then on it runs at 17 minutes past every hour.

Until then you can still run it by hand whenever you want: **Actions → Hourly agent run → Run
workflow**.

**How you know it worked:** open the Actions tab an hour later — the run is green, and the app's
**Settings → Audit log** shows what the agents did.

---

## Step 7 — Sending emails (only when you want applications actually sent)

Until this is done, approved applications are kept as
*"Approved – waiting for email connection"*. Nothing is lost, nothing is faked.

**Resend is the simpler one** (no Google authorisation screen):
1. Open **resend.com**, create a free account, add and verify your domain or use the test sender they give you.
2. **API Keys → Create API Key**, copy it.
3. In Vercel add `RESEND_API_KEY` and `EMAIL_FROM` (the address applications are sent from). Redeploy.

**Gmail** (sends from your own Gmail address, and can read replies):
1. console.cloud.google.com → your project → **APIs & Services → Library** → enable **Gmail API**.
2. **APIs & Services → OAuth consent screen** → External → fill in the name and your email → add yourself as a test user.
3. **Credentials → Create credentials → OAuth client ID → Desktop app**. Copy the client ID and secret.
4. Get a refresh token once, using Google's OAuth Playground (developers.google.com/oauthplayground):
   press the gear, tick "Use your own OAuth credentials", paste the ID and secret,
   choose the scope `https://www.googleapis.com/auth/gmail.modify`, press **Authorize APIs**,
   press **Allow** on Google's screen, then **Exchange authorization code for tokens**, and copy the **refresh token**.
5. In Vercel add `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `GMAIL_SENDER` (your Gmail address)
   and `EMAIL_FROM`. Redeploy.

**How you know it worked:** Settings shows "Email sending — connected", and the review queue no longer
shows the NOT CONNECTED banner.

---

## Not connected, and that is fine

* **WhatsApp notifications** — the daily summary goes by email. To use WhatsApp you would connect a
  provider (WhatsApp Business API or Twilio) and add its credentials; the app labels it NOT CONNECTED until then.

## If something says NOT CONNECTED

That is the tool being honest: the feature exists, the outside service is missing. The banner always names
the step in this file. Nothing is ever invented to cover a missing connection.
