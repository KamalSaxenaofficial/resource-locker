// Public download page. No login is required: the short ID in the URL
// (e.g. /r/aB3xK9mZpQ7h) is looked up directly in Firestore. Firestore
// rules allow anyone to "get" a single link document by its exact ID, but
// not to list/browse all links — so this only works if you have the link.

import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./firebase-config.js";

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

function getIdFromUrl(){
  // Works both via the clean /r/<id> rewrite and a direct /d.html?id=<id> visit.
  const params = new URLSearchParams(window.location.search);
  if(params.get('id')) return params.get('id');
  const parts = window.location.pathname.split('/').filter(Boolean);
  const last = parts[parts.length - 1];
  return (last && last !== 'd.html') ? last : null;
}

function renderDownload(record){
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="dl-wrap">
      <div class="dl-card" id="dlCard">
        <div class="dl-icon" style="background:${badgeColor(record.type)};">${extBadge(record.name, record.type)}</div>
        <div class="dl-name">${escapeHtml(record.name)}</div>
        <div class="dl-meta">${fmtSize(record.size)} · ${record.type}</div>
        <button class="dl-btn" id="downloadBtn">Download</button>
      </div>
      <a class="dl-back" href="/index.html">← Go to Locker</a>
    </div>`;
  document.getElementById('downloadBtn').addEventListener('click', async ()=>{
    const btn = document.getElementById('downloadBtn');
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span>Preparing…`;
    try{
      const res = await fetch(record.url);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = record.name;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Download started');
    }catch(e){ showToast('Download failed'); }
    btn.disabled = false; btn.innerHTML = 'Download';
  });
}

function renderNotFound(){
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="dl-wrap">
      <div class="dl-card">
        <div class="dl-icon" style="background:linear-gradient(155deg, #C0392B, #96271B);">✕</div>
        <div class="dl-name">Resource not found</div>
        <div class="dl-meta">This link has expired or is invalid.</div>
      </div>
      <a class="dl-back" href="/index.html">← Go to Locker</a>
    </div>`;
}

function renderLoading(){
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="dl-wrap">
      <div class="dl-card">
        <div class="dl-icon" style="background:linear-gradient(155deg, #5B6572, #3E4650);">…</div>
        <div class="dl-name">Loading…</div>
      </div>
    </div>`;
}

async function main(){
  renderLoading();
  const id = getIdFromUrl();
  if(!id){ renderNotFound(); return; }
  try{
    const snap = await getDoc(doc(db, 'links', id));
    if(!snap.exists()){ renderNotFound(); return; }
    renderDownload(snap.data());
  }catch(e){
    console.error(e);
    renderNotFound();
  }
}
main();
