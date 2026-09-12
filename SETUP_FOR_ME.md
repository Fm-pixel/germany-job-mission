# What I need you to do (in order of urgency)

Plain steps, most important first. Everything else the tool does by itself.
Each step ends with **how you know it worked**.

---

## Step 1 — Firebase: the database and your login (project `certifypm-pro`)

You already have the project, so this is mostly switching things on.

### 1a. Get the service-account key (2 minutes)

1. Open **console.firebase.google.com** and choose the project **certifypm-pro**.
2. Press the **gear icon → Project settings → Service accounts** tab.
3. Press **Generate new private key → Generate key**. A `.json` file downloads.
   This is a secret: never put it in a file inside the repository.

### 1b. Let the app register itself (1 minute)

With that file, one command does the rest — it registers the web app in
`certifypm-pro` (or reuses the one that is already there), reads its config, writes it into
`.env.local`, and switches on Email/password and Phone sign-in:

```bash
FIREBASE_SERVICE_ACCOUNT_JSON='<paste the whole JSON here>' npm run firebase:setup
```

If it says the service account may not manage the project, open
**console.cloud.google.com → IAM & Admin → IAM**, find the service account
(it ends in `@certifypm-pro.iam.gserviceaccount.com`) and give it the role
**Firebase Admin**, then run the command again.

Prefer to do it by hand? Project settings → General → **Your apps** → the `</>`
(web) icon → name it `gjm-web` → Register, then copy the six `firebaseConfig`
values into `.env.local`.

### 1c. Switch on the three ways to sign in

**Authentication → Sign-in method**, in the Firebase console:

| Method | What to do |
|---|---|
| **Email/Password** | Enable the first toggle. (The setup command does this for you.) |
| **Google** | Enable, choose a **support email**, Save. This one must be done here — Firebase creates the Google OAuth client for you at that moment. |
| **Phone** | Enable. (The setup command does this for you.) Free quota is small; Firebase may ask you to add billing for higher volume. |

### 1d. Allow your web address

**Authentication → Settings → Authorised domains → Add domain**, and add the
address the app runs on (for example `germany-job-mission.vercel.app`).
`localhost` is already on the list. Without this, Google and phone sign-in
refuse to run with the error "this domain is not authorised".

### 1e. Firestore

**Build → Firestore Database**. If the project has no database yet, press
**Create database**, choose **production mode** and the location
**europe-west3 (Frankfurt)**. Do **not** set up Storage — this tool uses your
Google Drive for files, so no card is needed.

### 1f. Lock it to you (do this right after your first sign-in)

1. Open the app and sign in once — with **each** method you intend to use.
2. Firebase console → **Authentication → Users**. Copy the **User UID** of every
   row that is you. Google and email/password usually share one row; **a phone
   sign-in is always a separate row with its own id**.
3. Put them all in `OWNER_UIDS`, comma separated, e.g.
   `OWNER_UIDS=abc123...,xyz789...`
4. Run `npm run deploy-rules` (or paste `firestore.rules` in the console and
   replace `'REPLACE_WITH_YOUR_OWNER_UID'` with your ids, each in quotes).

Until `OWNER_UIDS` is set, the app only lets somebody in while the project has a
single user — and the sign-in screen tells you the user id to add.

**How you know it worked:** you can sign in all three ways, and the app's
**Settings** page shows "Login (Firebase Auth) — connected" and "Owner lock — connected".

## Step 2 — Google Drive: where the documents live (5 minutes)

1. Open **console.cloud.google.com**, top left choose the project **germany-job-mission**.
2. **APIs & Services → Library**, search for **Google Drive API**, open it, press **Enable**.
3. Open **drive.google.com**. Press **New → New folder**, call it `Germany Job Mission – Documents`.
4. Open the folder. Look at the address bar: the long code after `folders/` is the **folder ID**. Copy it.
5. Press the folder name at the top → **Share**. Paste the `client_email` value from the JSON of step 1
   (it looks like `firebase-adminsdk-xxxxx@germany-job-mission.iam.gserviceaccount.com`),
   set it to **Editor**, press **Send**.

**How you know it worked:** after the app is running, open **Settings → "Test the Drive connection"**.
It must say "Connected to the Drive folder …".

---

## Step 3 — Anthropic key: the thinking part (3 minutes)

1. Open **console.anthropic.com → API keys → Create key**. Copy it (it starts with `sk-ant-`).
2. You need a small amount of credit on the account for the tool to use it.

**How you know it worked:** on the Settings page, "AI (Anthropic API)" shows **connected**.
Without it the app still runs — CV reading, application writing and the assistant are simply switched off
and say NOT CONNECTED.

---

## Step 4 — Put it online with Vercel (10 minutes)

1. Open **vercel.com**, sign in with GitHub, press **Add New → Project** and import the repository
   `germany-job-mission`.
2. **Before** pressing Deploy, open **Environment Variables** and add these, one per line
   (names exactly as written):

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_FIREBASE_API_KEY` | from step 1.6 |
   | `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | from step 1.6 |
   | `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | from step 1.6 |
   | `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | from step 1.6 |
   | `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | from step 1.6 |
   | `NEXT_PUBLIC_FIREBASE_APP_ID` | from step 1.6 |
   | `FIREBASE_SERVICE_ACCOUNT_JSON` | the whole JSON from step 1a, as one line |
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

Vercel already runs the agents once a day (it is in `vercel.json`). For an hourly run as well:

1. GitHub → your repository → **Settings → Secrets and variables → Actions → New repository secret**.
2. Add `APP_URL` (the Vercel address) and `CRON_SECRET` (the same random word as in step 4).
3. GitHub → the **Actions** tab → "Hourly agent run" → **Enable workflow**.

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
