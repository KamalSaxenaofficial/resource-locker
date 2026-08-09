import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { auth, db, ADMIN_EMAIL } from "./firebase-config.js";

onAuthStateChanged(auth, async (user) => {
  if(!user){
    window.location.href = 'login.html';
    return;
  }
  if(user.email !== ADMIN_EMAIL){
    // Not the admin account — send them back to the regular app.
    window.location.href = 'index.html';
    return;
  }
  renderShell(user);
  await loadData();
});

function fmtDate(ts){
  if(!ts) return '—';
  try{
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  }catch(e){ return '—'; }
}
function escapeHtml(s){ const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

function renderShell(user){
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
            <h1>Admin panel</h1>
            <div class="tagline">Users and account activity</div>
          </div>
        </div>
        <div class="header-actions">
          <span class="user-pill">${escapeHtml(user.email)}</span>
          <button class="btn-secondary" onclick="window.location.href='index.html'">Back to Locker</button>
          <button class="btn-secondary" id="logoutBtn">Log out</button>
        </div>
      </header>

      <div class="stat-row" id="statRow">
        <div class="stat-card"><div class="stat-value" id="statUsers">—</div><div class="stat-label">Total users</div></div>
        <div class="stat-card"><div class="stat-value" id="statLinks">—</div><div class="stat-label">Total links generated</div></div>
        <div class="stat-card"><div class="stat-value" id="statToday">—</div><div class="stat-label">Logged in last 24h</div></div>
      </div>

      <div class="list-title">All users</div>
      <div id="tableSlot"><div class="empty">Loading…</div></div>

      <footer class="footer">Passwords are securely hashed by Firebase Authentication and are never visible here, by design.</footer>
    </div>
  `;
  document.getElementById('logoutBtn').addEventListener('click', async ()=>{
    await signOut(auth);
    window.location.href = 'login.html';
  });
}

async function loadData(){
  try{
    const [usersSnap, linksSnap] = await Promise.all([
      getDocs(collection(db, 'users')),
      getDocs(collection(db, 'links'))
    ]);

    const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const links = linksSnap.docs.map(d => d.data());

    const linkCountByUid = {};
    links.forEach(l => { linkCountByUid[l.uid] = (linkCountByUid[l.uid] || 0) + 1; });

    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const loggedInToday = users.filter(u => {
      const t = u.lastLogin && u.lastLogin.toDate ? u.lastLogin.toDate().getTime() : 0;
      return (now - t) < dayMs;
    }).length;

    document.getElementById('statUsers').textContent = users.length;
    document.getElementById('statLinks').textContent = links.length;
    document.getElementById('statToday').textContent = loggedInToday;

    users.sort((a, b) => {
      const ta = a.createdAt && a.createdAt.toDate ? a.createdAt.toDate().getTime() : 0;
      const tb = b.createdAt && b.createdAt.toDate ? b.createdAt.toDate().getTime() : 0;
      return tb - ta;
    });

    const slot = document.getElementById('tableSlot');
    if(users.length === 0){
      slot.innerHTML = `<div class="empty">No users yet.</div>`;
      return;
    }
    slot.innerHTML = `
      <table class="admin-table">
        <thead>
          <tr>
            <th>Email</th>
            <th>Signed up</th>
            <th>Last login</th>
            <th>Links</th>
          </tr>
        </thead>
        <tbody>
          ${users.map(u => `
            <tr>
              <td>${escapeHtml(u.email)}</td>
              <td class="muted">${fmtDate(u.createdAt)}</td>
              <td class="muted">${fmtDate(u.lastLogin)}</td>
              <td>${linkCountByUid[u.id] || 0}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }catch(err){
    console.error(err);
    document.getElementById('tableSlot').innerHTML = `<div class="empty">Could not load data. Check Firestore rules.</div>`;
  }
}
