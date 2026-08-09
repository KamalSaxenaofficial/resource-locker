# Locker — Resource Link Generator

Upload any file and instantly get a universal download link that works on any
device or browser. Users log in with an email and password, and every link
they generate is saved to their account.

## How it works

- **File hosting:** [Cloudinary](https://cloudinary.com) (free tier)
- **Uploads are signed server-side:** a small Vercel Serverless Function
  (`api/sign.js`) generates a short-lived signature so the browser never
  sees the Cloudinary API secret. The secret lives only in Vercel's
  environment variables — never in this repository.
- **Authentication:** Firebase Authentication (email/password)
- **Database:** Firebase Firestore (stores user accounts and each user's generated links)
- **Hosting:** Vercel (the one serverless function requires Vercel, Netlify Functions, or similar — a purely static host like GitHub Pages won't run `api/sign.js`)

## Project structure

```
.
├── index.html          Main app (upload page) — requires login
├── login.html           Login / signup page
├── admin.html            Admin panel (restricted to the admin account)
├── d.html                 Public download page (no login required)
├── api/
│   └── sign.js            Serverless function: signs Cloudinary uploads
├── css/
│   └── style.css          Shared stylesheet
├── js/
│   ├── firebase-config.js    Firebase configuration + admin email + file size cap
│   ├── auth.js                 Login/signup logic
│   ├── app.js                   Main app logic (upload, save, list links)
│   ├── admin.js                 Admin panel logic
│   └── download.js              Public download page logic
└── README.md
```

## What's safe to commit vs. what must stay secret

| Value | Safe on GitHub? | Where it lives |
|---|---|---|
| Firebase config (apiKey, authDomain, etc.) | Yes — Firebase keys are public identifiers by design, protected by Firestore Security Rules | `js/firebase-config.js` |
| Cloudinary cloud name / API key | Yes on their own | Vercel environment variables (kept out of the repo anyway, for cleanliness) |
| **Cloudinary API secret** | **Never** — this must stay private | Vercel environment variable only |

## How links work

When a file is uploaded, Cloudinary returns a hosted URL. That URL — along
with the file's name, size, and type — is packed into the link itself
(base64-encoded in the URL hash). This means:

- The recipient does **not** need an account to download a shared file.
- No database lookup is needed to resolve a link — it's fully self-contained.
- The link only stops working if the underlying Cloudinary file is deleted.

Each generated link is also saved to the uploader's account in Firestore, so
their upload history is visible next time they log in, from any device.

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

   These are read by `api/sign.js` at request time and are never exposed to
   the browser or committed to the repo.

### Firestore security rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if request.auth != null &&
        (request.auth.uid == userId || request.auth.token.email == "ADMIN_EMAIL_HERE");
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    match /links/{linkId} {
      allow read: if request.auth != null &&
        (resource.data.uid == request.auth.uid || request.auth.token.email == "ADMIN_EMAIL_HERE");
      allow create: if request.auth != null && request.resource.data.uid == request.auth.uid;
      allow delete: if request.auth != null && resource.data.uid == request.auth.uid;
      allow update: if false;
    }
  }
}
```

Replace `ADMIN_EMAIL_HERE` with your actual admin email in both places.

## Deploying (GitHub + Vercel)

```bash
git init
git add .
git commit -m "initial commit"
git branch -M main
git remote add origin <your-repo-url>
git push -u origin main
```

Import the repository into [Vercel](https://vercel.com) as a project, add
the three `CLOUDINARY_*` environment variables in the project's settings,
then deploy. `api/sign.js` is automatically detected and deployed as a
serverless function — no extra configuration needed.

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
- Uploads are signed server-side (see `api/sign.js`), so no Cloudinary
  secret is ever exposed to the browser or the public repository. If you
  previously used an **unsigned** upload preset, delete or disable it in
  Cloudinary now that signed uploads are in place.
