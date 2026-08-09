import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, setDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { auth, db } from "./firebase-config.js";

const form = document.getElementById('authForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const submitBtn = document.getElementById('authSubmit');
const modeTitle = document.getElementById('modeTitle');
const modeTagline = document.getElementById('modeTagline');
const switchLine = document.getElementById('switchLine');
const switchBtn = document.getElementById('switchBtn');
const errorBanner = document.getElementById('authError');

let mode = 'login'; // 'login' | 'signup'

// If already logged in, skip straight to the app.
onAuthStateChanged(auth, (user) => {
  if (user) window.location.href = 'index.html';
});

function setMode(next){
  mode = next;
  if(mode === 'login'){
    modeTitle.textContent = 'Log in to Locker';
    modeTagline.textContent = 'Upload files and manage your links';
    submitBtn.textContent = 'Log in';
    switchLine.textContent = "Don't have an account?";
    switchBtn.textContent = 'Sign up';
  } else {
    modeTitle.textContent = 'Create your account';
    modeTagline.textContent = 'Takes less than a minute';
    submitBtn.textContent = 'Sign up';
    switchLine.textContent = 'Already have an account?';
    switchBtn.textContent = 'Log in';
  }
  showError('');
}

switchBtn.addEventListener('click', () => setMode(mode === 'login' ? 'signup' : 'login'));

function showError(msg){
  if(!msg){ errorBanner.style.display = 'none'; errorBanner.textContent = ''; return; }
  errorBanner.style.display = 'block';
  errorBanner.textContent = msg;
}

function friendlyError(err){
  const code = err && err.code || '';
  if(code.includes('email-already-in-use')) return 'An account with this email already exists. Try logging in instead.';
  if(code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) return 'Incorrect email or password.';
  if(code.includes('weak-password')) return 'Password should be at least 6 characters.';
  if(code.includes('invalid-email')) return 'Please enter a valid email address.';
  return 'Something went wrong. Please try again.';
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  showError('');
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span class="spinner"></span>Please wait…`;

  try{
    if(mode === 'signup'){
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, 'users', cred.user.uid), {
        email: cred.user.email,
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp()
      });
    } else {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const ref = doc(db, 'users', cred.user.uid);
      const snap = await getDoc(ref);
      if(snap.exists()){
        await setDoc(ref, { lastLogin: serverTimestamp() }, { merge: true });
      } else {
        // Safety net: user exists in Auth but has no Firestore record yet.
        await setDoc(ref, { email: cred.user.email, createdAt: serverTimestamp(), lastLogin: serverTimestamp() });
      }
    }
    window.location.href = 'index.html';
  }catch(err){
    console.error(err);
    showError(friendlyError(err));
    submitBtn.disabled = false;
    submitBtn.textContent = mode === 'login' ? 'Log in' : 'Sign up';
  }
});
