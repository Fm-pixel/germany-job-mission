# Instruction for Claude in Chrome (paste this once you are logged in to Google, GitHub and Vercel in Chrome)

You are setting up the cloud services for my private "Germany Job Mission" tool. Repository: github.com/<my-username>/germany-job-mission. Do every step yourself in the browser; I am logged in. Stop and ask me only for a password, a phone code, or anything involving a card or payment. Show me each secret only once, on screen, then store it where instructed. Never paste secrets into the GitHub repository files.

1. console.firebase.google.com → Add project → name "germany-job-mission" → Google Analytics OFF → Create.
2. Build → Firestore Database → Create database → location europe-west3 (Frankfurt) → production mode.
3. Build → Authentication → Get started → Sign-in method → enable "Email/Password".
4. Do NOT set up Storage.
5. Project settings → General → "Your apps" → Add app → Web (</>) → name "gjm-web" → Register → copy the six firebaseConfig values.
6. Project settings → Service accounts → "Generate new private key" → download the JSON. Open it and copy its full content.
7. console.cloud.google.com → select project "germany-job-mission" → APIs & Services → Library → enable "Google Drive API". Then IAM & Admin → IAM → find the service account from step 6 (firebase-adminsdk-…) and make sure it has the role "Owner" (add it if missing) so Claude Code can configure the project later.
8. drive.google.com → New folder "Germany Job Mission – Documents" → open it → Share → add the service-account email (from the JSON, "client_email") as Editor → copy the folder ID from the URL.
9. vercel.com → Add New → Project → Import the GitHub repo "germany-job-mission" → before deploying, open Environment Variables and add:
   NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, NEXT_PUBLIC_FIREBASE_PROJECT_ID, NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET, NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID, NEXT_PUBLIC_FIREBASE_APP_ID (from step 5),
   FIREBASE_SERVICE_ACCOUNT_JSON (the whole JSON from step 6, as one line),
   GOOGLE_DRIVE_FOLDER_ID (step 8),
   ANTHROPIC_API_KEY (ask me for it, or open console.anthropic.com → API Keys → Create and copy it).
   Then Deploy.
10. github.com → the repo → Settings → Secrets and variables → Actions → New repository secret: add the same FIREBASE_SERVICE_ACCOUNT_JSON, GOOGLE_DRIVE_FOLDER_ID and ANTHROPIC_API_KEY, plus VERCEL_URL (the address Vercel gave the app).
11. Finally, edit STATUS.md in the repo on GitHub and append the line: "Cloud setup done by Claude in Chrome on <today's date>: Firebase project, Firestore, Auth, service account (Owner), Drive API, Drive folder, Vercel env vars, GitHub secrets." Commit.
Report back with a short list of what was done and the Vercel app address.
