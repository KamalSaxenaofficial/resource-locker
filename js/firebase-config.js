// Shared Firebase initialization used by every page.
// Auth handles login/signup. Firestore stores user records and each user's
// generated links. Actual files are hosted on Cloudinary (see app.js).

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDKjBkMIM_yIFz2JsV4HSGeIf_qSSUDK78",
  authDomain: "resource-locker-b3c4a.firebaseapp.com",
  projectId: "resource-locker-b3c4a",
  storageBucket: "resource-locker-b3c4a.firebasestorage.app",
  messagingSenderId: "200620189178",
  appId: "1:200620189178:web:8da19faa4ead3a1ec7043",
  measurementId: "G-0QEFEZDB4K"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// The one account allowed into the admin panel.
export const ADMIN_EMAIL = "kamalsaxena.it@gmail.com";

// File size cap enforced on the client before an upload even starts.
// Actual Cloudinary credentials now live server-side only, in
// /api/sign.js, read from Vercel environment variables — never in this file.
export const MAX_FILE_BYTES = 100 * 1024 * 1024; // 100 MB app-side cap
