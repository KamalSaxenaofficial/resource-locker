# Locker — Resource Link Generator

Upload any file and instantly get a short, universal download link that
works on any device or browser. Users log in with an email and password,
and every link they generate is saved to their account.

## How it works

- **File hosting:** [Cloudinary](https://cloudinary.com) (free tier)
- **Uploads are signed server-side:** a small Vercel Serverless Function
  (`api/sign.js`) generates a short-lived signature so the browser never
  sees the Cloudinary API secret. The secret lives only in Vercel's
  environment variables — never in this repository.
- **Authentication:** Firebase Authentication (email/password)
- **Database:** Firebase Firestore — stores user accounts and each user's
  generated links (name, size, type, Cloudinary URL) under a short random ID
- **Short links:** each link is just `yourdomain.com/r/<12-character-code>`.
  `vercel.json` rewrites `/r/:id` to `d.html`, which looks the ID up in
  Firestore and shows a Download button — no login needed to receive a file.
- **Hosting:** Vercel (the serverless function and rewrite require Vercel,
  Netlify Functions, or similar — a purely static host like GitHub Pages
  won't run `api/sign.js` or `vercel.json` rewrites)

## Project structure

```
.
├── index.html          Main app (upload page) — requires login
├── login.html           Login / signup page
├── admin.html            Admin panel (restricted to the admin account)
├── d.html                 Public download page (no login required)
├── vercel.json             Rewrites short /r/:id links to d.html
├── api/
│   └── sign.js             Serverless function: signs Cloudinary uploads
├── css/
│   └── style.css           Shared stylesheet
├── js/
│   ├── firebase-config.js     Firebase config + admin email + short-ID generator
│   ├── auth.js                  Login/signup logic
│   ├── app.js                    Main app logic (upload, save, list links)
│   ├── admin.js                  Admin panel logic
│   └── download.js               Public download page logic
└── README.md
```

## What's safe to commit vs. what must stay secret

| Value | Safe on GitHub? | Where it lives |
|---|---|---|
| Firebase config (apiKey, authDomain, etc.) | Yes — Firebase keys are public identifiers by design, protected by Firestore Security Rules | `js/firebase-config.js` |
| Cloudinary cloud name / API key | Yes on their own | Vercel environment variables (kept out of the repo anyway, for cleanliness) |
| **Cloudinary API secret** | **Never** — this must stay private | Vercel environment variable only |

## Setting up your own copy

1. **Cloudinary** — create a free account and note your **Cloud name**,
   **API Key**, and **API Secret** (Settings → API Keys).
2. **Firebase** — create a project, enable **Authentication → Email/Password**,
   and create a **Firestore Database** (Standard edition, test mode is fine
   to start).
3. Copy your Firebase config into `js/firebase-config.js`, and set
   `ADMIN_EMAIL` to whichever address should have access to the admin panel.
4. Apply the Firestore security rules below in the Firebase console
   (Firestore → Rules).
5. In your **Vercel project settings → Environment Variables**, add:
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`

### Firestore security rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if request.auth != null &&
        (request.auth.uid == userId || request.auth.token.email == "kamalsaxena.it@gmail.com");
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    match /links/{linkId} {
      // Anyone holding the exact short link ID can fetch that one document —
      // this is what lets recipients download without logging in. The ID is
      // a random 12-character code, so it can't be guessed.
      allow get: if true;
      // Listing/querying multiple links (used by "your saved resources" and
      // the admin panel) still requires being the owner or the admin.
      allow list: if request.auth != null &&
        (resource.data.uid == request.auth.uid || request.auth.token.email == "kamalsaxena.it@gmail.com");
      allow create: if request.auth != null && request.resource.data.uid == request.auth.uid;
      allow delete: if request.auth != null && resource.data.uid == request.auth.uid;
      allow update: if false;
    }
  }
}
```

If you use a different admin email, replace `kamalsaxena.it@gmail.com` in
both places (and in `js/firebase-config.js`).

## Deploying (GitHub + Vercel)

```bash
git init
git add .
git commit -m "initial commit"
git branch -M main
git remote add origin <your-repo-url>
git push -u origin main
```

Import the repository into [Vercel](https://vercel.com), add the three
`CLOUDINARY_*` environment variables in the project's settings, then deploy.
`api/sign.js` and `vercel.json` are detected automatically — no extra
configuration needed.

## Limits to be aware of

| Type | Cloudinary free-plan limit |
|---|---|
| Image | 10 MB |
| Video | 100 MB |
| Raw (PDF, ZIP, DOC, XLS, etc.) | 10 MB |

## Security notes

- Passwords are never stored or displayed in plain text. Firebase
  Authentication hashes and manages them — even the admin panel cannot see
  them, by design.
- The admin panel only shows account metadata: email, sign-up date, last
  login, and number of links generated.
- Uploads are signed server-side (`api/sign.js`), so no Cloudinary secret is
  ever exposed to the browser or the public repository.
- Short link IDs are random 12-character codes (71 bits of entropy) — not
  sequential or guessable. Firestore rules only allow fetching one document
  at a time by its exact ID; browsing/listing all links is restricted to
  their owner or the admin.

## Troubleshooting: "a user signed up but doesn't show in the admin panel"

This means the Firebase Authentication account was created, but the
matching Firestore `users/{uid}` profile document failed to save (usually a
Firestore rules or timing issue). To debug:

1. Open the browser console (F12 → Console) *before* signing up.
2. Sign up with a new email and watch for a `[auth]` log line. A red
   `FAILED to save user profile` error will show the exact reason.
3. Make sure the Firestore rules above are published (Firebase console →
   Firestore → Rules → Publish) — a common cause is still being on the
   default test-mode rules from initial setup, or a stale rule that doesn't
   match the current `ADMIN_EMAIL`.
4. Compare Firebase console → Authentication → Users (the source of truth
   for accounts) against Firestore → `users` collection (the source of
   truth for admin-panel profiles) — the admin panel also shows a small
   debug line at the bottom of the user table with the live document count.
