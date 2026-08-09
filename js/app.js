import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection, addDoc, deleteDoc, doc, getDocs,
  query, where, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { auth, db, ADMIN_EMAIL, MAX_FILE_BYTES } from "./firebase-config.js";

let currentUser = null;
let myLinks = []; // [{ id, url, name, type, size }]

// ---------- Auth guard ----------
onAuthStateChanged(auth, async (user) => {
  if(!user){
    window.location.href = 'login.html';
    return;
  }
  currentUser = user;
  renderApp();
  await loadMyLinks();
  renderList();
});

// ---------- Helpers ----------
function fmtSize(bytes){
  if(bytes < 1024) return bytes + ' B';
  if(bytes < 1024*1024) return (bytes/1024).toFixed(1) + ' KB';
  return (bytes/(1024*1024)).toFixed(2) + ' MB';
}
function extBadge(name, type){
  let ext = (name.split('.').pop() || '').slice(0,4);
  if(!ext || ext === name) ext = ((type||'').split('/')[1] || (type||'').split('/')[0] || 'file').slice(0,4);
  return ext.toUpperCase();
}
function badgeColor(type){
  type = type || '';
  if(type.startsWith('image/')) return 'linear-gradient(155deg, #0EA893, #0B7F6F)';
  if(type.startsWith('video/')) return 'linear-gradient(155deg, #2E86C1, #1B5E85)';
  if(type === 'application/pdf') return 'linear-gradient(155deg, #C0392B, #96271B)';
  if(type.startsWith('audio/')) return 'linear-gradient(155deg, #8E6FCE, #6B4FA3)';
  return 'linear-gradient(155deg, #5B6572, #3E4650)';
}
function escapeHtml(s){ const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(()=> t.classList.remove('show'), 1800);
}
// File metadata is packed straight into the URL hash — anyone opening the
// link can download the file without needing an account.
function buildLink(record){
  const packed = btoa(encodeURIComponent(JSON.stringify({ url: record.url, name: record.name, type: record.type, size: record.size })));
  return window.location.origin + window.location.pathname.replace('index.html','') + 'd.html#d=' + packed;
}
function copyLink(link){
  navigator.clipboard.writeText(link).then(()=> showToast('Link copied')).catch(()=> showToast('Copy failed, please select manually'));
}
window.copyLink = copyLink;
window.copyMyLink = (idx) => copyLink(buildLink(myLinks[idx]));
window.deleteMyLink = async (idx) => {
  const item = myLinks[idx];
  if(!item) return;
  try{
    await deleteDoc(doc(db, 'links', item.id));
    myLinks.splice(idx, 1);
    renderList();
    showToast('Removed from your account');
  }catch(e){
    console.error(e);
    showToast('Could not remove — try again');
  }
};

// ---------- Firestore: load / save links ----------
async function loadMyLinks(){
  try{
    const q = query(collection(db, 'links'), where('uid', '==', currentUser.uid), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    myLinks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }catch(e){
    console.error('Failed to load saved links', e);
    myLinks = [];
  }
}
async function saveLinkRecord(record){
  const docRef = await addDoc(collection(db, 'links'), {
    uid: currentUser.uid,
    url: record.url,
    name: record.name,
    type: record.type,
    size: record.size,
    createdAt: serverTimestamp()
  });
  return docRef.id;
}

// ---------- Rendering ----------
function renderApp(){
  const isAdmin = currentUser.email === ADMIN_EMAIL;
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="wrap">
      <header>
        <div class="brand">
          <div class="mark intro">
            <svg viewBox="0 0 24 24" fill="none">
              <rect class="body" x="4" y="11" width="16" height="10" rx="2" fill="currentColor"/>
              <path class="shackle" d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round"/>
            </svg>
          </div>
          <div>
            <h1>Locker</h1>
            <div class="tagline">Upload a file, get a universal download link</div>
          </div>
        </div>
        <div class="header-actions">
          <span class="user-pill">${escapeHtml(currentUser.email)}</span>
          ${isAdmin ? `<button class="btn-secondary" onclick="window.location.href='admin.html'">Admin</button>` : ''}
          <button class="btn-secondary" id="logoutBtn">Log out</button>
        </div>
      </header>

      <div class="dropzone" id="dropzone">
        <div class="icon">⇪</div>
        <p class="dz-title">Drop a file here, or click to choose</p>
        <p class="dz-sub">Images, PDFs, docs — anything. Each file gets its own link.</p>
        <input type="file" id="fileInput">
      </div>
      <div class="limit-note">Up to ~100 MB per file. The link works on any device or browser.</div>
      <div id="banner" class="banner"></div>
      <div id="progressSlot"></div>
      <div id="ticketSlot"></div>

      <section class="list-section">
        <div class="list-title">Your saved resources</div>
        <div id="list"><div class="empty">Loading…</div></div>
      </section>

      <footer class="footer">Files are securely hosted and reachable from anywhere via their link.</footer>
    </div>
  `;

  document.getElementById('logoutBtn').addEventListener('click', async ()=>{
    await signOut(auth);
    window.location.href = 'login.html';
  });

  const dz = document.getElementById('dropzone');
  const input = document.getElementById('fileInput');
  dz.addEventListener('click', ()=> input.click());
  input.addEventListener('change', e => { if(e.target.files[0]) handleFile(e.target.files[0]); });
  ['dragenter','dragover'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('drag'); }));
  ['dragleave','drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('drag'); }));
  dz.addEventListener('drop', e => { const f = e.dataTransfer.files[0]; if(f) handleFile(f); });
}

function banner(msg, type){
  const b = document.getElementById('banner');
  if(!b) return;
  if(!msg){ b.className = 'banner'; b.textContent=''; return; }
  b.className = 'banner ' + type; b.textContent = msg;
}
function setProgress(pct, label){
  const slot = document.getElementById('progressSlot');
  if(!slot) return;
  if(pct === null){ slot.innerHTML = ''; return; }
  slot.innerHTML = `<div class="progress-wrap">
    <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
    <div class="progress-label">${label}</div></div>`;
}

function handleFile(file){
  banner('', '');
  document.getElementById('ticketSlot').innerHTML = '';
  if(file.size > MAX_FILE_BYTES){
    banner(`"${file.name}" is too large (${fmtSize(file.size)}). Limit is 100 MB.`, 'error');
    return;
  }
  uploadWithSignature(file);
}

async function uploadWithSignature(file){
  setProgress(0, 'Preparing upload…');
  let auth;
  try{
    const signRes = await fetch('/api/sign');
    if(!signRes.ok) throw new Error('Could not authorize the upload');
    auth = await signRes.json();
    if(auth.error) throw new Error(auth.error);
  }catch(err){
    console.error(err);
    setProgress(null);
    banner('Upload failed: ' + err.message, 'error');
    return;
  }

  const form = new FormData();
  form.append('file', file);
  form.append('api_key', auth.apiKey);
  form.append('timestamp', auth.timestamp);
  form.append('signature', auth.signature);

  const xhr = new XMLHttpRequest();
  xhr.open('POST', `https://api.cloudinary.com/v1_1/${auth.cloudName}/auto/upload`);

  xhr.upload.onprogress = (e)=>{
    if(e.lengthComputable){
      const pct = Math.round((e.loaded / e.total) * 100);
      setProgress(pct, `Uploading… ${pct}%`);
    }
  };

  xhr.onload = async ()=>{
    setProgress(null);
    try{
      const data = JSON.parse(xhr.responseText);
      if(xhr.status < 200 || xhr.status >= 300 || data.error){
        throw new Error((data.error && data.error.message) || 'Upload failed');
      }
      const record = {
        url: data.secure_url,
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size
      };
      const id = await saveLinkRecord(record);
      record.id = id;
      myLinks.unshift(record);
      banner('', '');
      showTicket(record);
      renderList();
    }catch(err){
      console.error(err);
      banner('Upload failed: ' + err.message, 'error');
    }
  };

  xhr.onerror = ()=>{
    setProgress(null);
    banner('Upload failed. Please check your internet connection.', 'error');
  };

  setProgress(0, 'Starting upload…');
  xhr.send(form);
}

function showTicket(record){
  const slot = document.getElementById('ticketSlot');
  const link = buildLink(record);
  const bars = Array.from({length: 28}).map(()=> `<div style="height:${6+Math.random()*14}px"></div>`).join('');
  slot.innerHTML = `
    <div class="ticket">
      <div class="ticket-top">
        <div class="file-badge" style="background:${badgeColor(record.type)};">${extBadge(record.name, record.type)}</div>
        <div>
          <div class="file-name">${escapeHtml(record.name)}</div>
          <div class="file-meta">${fmtSize(record.size)} · link ready</div>
        </div>
      </div>
      <div class="perforation"></div>
      <div class="ticket-bottom">
        <div class="code-label">Download link</div>
        <div class="link-row">
          <div class="link-input">${link}</div>
          <button class="copy-btn" id="copyBtn">Copy</button>
        </div>
        <div class="bars">${bars}</div>
      </div>
    </div>`;
  document.getElementById('copyBtn').addEventListener('click', ()=> copyLink(link));
}

function renderList(){
  const list = document.getElementById('list');
  if(!list) return;
  if(myLinks.length === 0){
    list.innerHTML = `<div class="empty">No uploads yet. Add your first file above.</div>`;
    return;
  }
  list.innerHTML = myLinks.map((item, idx) => `
    <div class="item">
      <div class="file-badge" style="background:${badgeColor(item.type)};">${extBadge(item.name, item.type)}</div>
      <div class="item-info">
        <div class="file-name">${escapeHtml(item.name)}</div>
        <div class="file-meta">${fmtSize(item.size)}</div>
      </div>
      <div class="item-actions">
        <div class="icon-btn" title="Copy link" onclick="copyMyLink(${idx})">⧉</div>
        <div class="icon-btn" title="Remove from account" onclick="deleteMyLink(${idx})">✕</div>
      </div>
    </div>`).join('');
}
