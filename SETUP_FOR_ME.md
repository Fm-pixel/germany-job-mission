# What I need you to do (in order of urgency)

Plain steps, most important first. Everything else the tool does by itself.
Each step ends with **how you know it worked**.

---

## Step 1 — Firebase: the database and your login (15 minutes)

1. Open **console.firebase.google.com** and sign in with your Google account.
2. Press **Add project**. Name it `germany-job-mission`. Switch **Google Analytics off**. Press **Create project**.
3. In the left menu: **Build → Firestore Database → Create database**.
   Choose **production mode** and the location **europe-west3 (Frankfurt)**. Press Enable.
4. In the left menu: **Build → Authentication → Get started**.
   In the list of sign-in methods click **Email/Password**, switch the first toggle on, press **Save**.
5. Do **not** set up Storage. This tool uses your Google Drive for files instead, so no card is needed.
6. Press the **gear icon → Project settings**. Scroll down to **Your apps**, press the **`</>`** (web) icon.
   Name it `gjm-web`, press **Register app**. A grey box of code appears with six values
   (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId). Copy all six — you need them below.
7. Still in Project settings, open the tab **Service accounts** → press **Generate new private key** → **Generate key**.
   A `.json` file downloads. Open it in a text editor and copy **the whole content**. This is a secret: never put it in a file inside the repository.

**How you know it worked:** the Firestore page shows an empty database and Authentication shows "Email/Password — Enabled".

---

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
   | `FIREBASE_SERVICE_ACCOUNT_JSON` | the whole JSON from step 1.7, as one line |
   | `GOOGLE_DRIVE_FOLDER_ID` | from step 2.4 |
   | `ANTHROPIC_API_KEY` | from step 3 |
   | `CRON_SECRET` | any long random word you invent |
   | `OWNER_EMAIL` | your own email address |

3. Press **Deploy**. When it finishes, Vercel shows an address like
   `https://germany-job-mission.vercel.app`. Copy it.
4. Add one more environment variable `APP_URL` with that address, and press **Redeploy**
   (Deployments → the three dots on the newest one → Redeploy).
5. Open the address on your phone or laptop. You see the login screen.
   Because no account exists yet, it offers **Create the first account**. Create it with your email
   and a password of at least 8 characters. **Sign-up switches itself off afterwards.**
6. Go back to Firebase → **Authentication → Users**, click your user, copy the **User UID**.
   Add it in Vercel as the environment variable `OWNER_UID`, then **Redeploy** once more.
   From now on only your account can open the app.

**How you know it worked:** you can log in and see the dashboard "My Germany Job Mission".

---

## Step 5 — Lock the database (5 minutes)

Two ways, pick one.

**The easy way (in the browser):**
1. Firebase console → **Build → Firestore Database → Rules** tab.
2. Delete everything there and paste the content of the file `firestore.rules` from the repository.
3. Replace `REPLACE_WITH_YOUR_OWNER_UID` with your User UID from step 4.6.
4. Press **Publish**.

**The automatic way (on a computer with the repository):** set `FIREBASE_SERVICE_ACCOUNT_JSON` and
`OWNER_UID` in `.env.local`, then run `npm run deploy-rules`.

**How you know it worked:** the Rules tab shows your UID inside the rules and the date of publishing.

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
