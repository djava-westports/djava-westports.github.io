// ============================================================
// Task Tracker — Frontend Logic
// ============================================================

const STAGES = [
  'Requested / Reported',
  'Troubleshooting / Investigation',
  'Requires Fix / Development',
  'Pending URS',
  'Pending Mandays Estimation',
  'Pending Revised Mandays',
  'Pending Mandays / CR Approval',
  'Pending Development',
  'Development In Progress',
  'Pending Testing',
  'Testing In Progress',
  'Plan for Release',
  'Pending CAB Approval',
  'Implementation In Progress',
  'Resolved',
  'Rolled Back',
  'Hold'
];

const STAGE_PCT = {
  'Requested / Reported': 5,
  'Troubleshooting / Investigation': 12,
  'Requires Fix / Development': 18,
  'Pending URS': 24,
  'Pending Mandays Estimation': 30,
  'Pending Revised Mandays': 36,
  'Pending Mandays / CR Approval': 42,
  'Pending Development': 48,
  'Development In Progress': 55,
  'Pending Testing': 62,
  'Testing In Progress': 70,
  'Plan for Release': 78,
  'Pending CAB Approval': 85,
  'Implementation In Progress': 92,
  'Resolved': 100,
  'Rolled Back': 100,
  'Hold': 0
};

const MS_CONFIGS = {
  stage:    { placeholder: 'All Stages',   options: [...STAGES, 'Not set'] },
  type:     { placeholder: 'All Types',    options: ['Support Ticket','Email Request','Verbal Request','Development CR','Testing','Others'] },
  status:   { placeholder: 'All Status',   options: ['Open','In Progress','Pending','Resolved','Closed'] },
  priority: { placeholder: 'All Priority', options: ['Critical','High','Medium','Low'] }
};
const msState = {};

const DEVS  = ['Akmal','Indra','Mahmood','Razin','Jay','Joseph','Justin'];
const IMPLS = ['Sharron - warfile','Yusuf - DB','Fikri - DB'];

const JIRA_APP_MAP = {
  'WPSCSSSUP': 'SCSS',
  'CARGOMOVE': 'SCSS',
  'WPCRONJOBS': 'CronJob',
  'WPSWDCSUP': 'WDC',
  'WPCBASSUP': 'CBAS',
  'WPEDICSUP': 'EDIC',
  'WPETPSUP':  'ETP',
};

const CAB_CHANGE_TYPES = ['Warfile Deployment','Data Patch','DB Change','New .exe File Installation'];

let chartDev = null, chartStage = null, chartStatus = null;

const DEFAULT_API_URL = 'https://script.google.com/macros/s/AKfycbxSGGK0OvAmcxa-jPhJrGjlDo29olZ6ooIwCujlfWb6a352dlJ9w8cMUNMJDg_KOQZ6eQ/exec';

let API_URL      = localStorage.getItem('tracker_api_url') || DEFAULT_API_URL;
let hideResolved = localStorage.getItem('tracker_hide_resolved') !== 'false';
let tickets = [], assignees = [], currentDetailId = null, filteredTickets = [];
let sortCol = null, sortDir = 'asc';

const DEFAULT_SLA = {
  'Troubleshooting / Investigation': 3,
  'Requires Fix / Development': 1,
  'Pending Development': 3,
  'Development In Progress': 7,
  'Pending Testing': 2,
  'Testing In Progress': 3,
  'Pending CAB Approval': 3,
  'Implementation In Progress': 1
};
let slaDays = JSON.parse(localStorage.getItem('tracker_sla') || 'null') || { ...DEFAULT_SLA };

const DEV_STAGES = new Set([
  'Pending Development', 'Development In Progress',
  'Pending Testing', 'Testing In Progress'
]);
const DEV_PHASE_STAGES  = new Set(['Pending Development', 'Development In Progress']);
const TEST_PHASE_STAGES = new Set(['Pending Testing', 'Testing In Progress']);
const SUPPORT_STAGES = new Set([
  'Requested / Reported', 'Troubleshooting / Investigation'
]);

// ============================================================
// Auth
// ============================================================

function getCurrentUser() {
  try {
    const raw = localStorage.getItem('tracker_user');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function isAdmin() {
  const u = getCurrentUser();
  return u && u.role && u.role.toLowerCase() === 'admin';
}

function togglePassword() {
  const inp = document.getElementById('login-password');
  const eye = document.getElementById('pw-eye');
  const show = inp.type === 'password';
  inp.type = show ? 'text' : 'password';
  eye.innerHTML = show
    ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>'
    : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
}

async function doLogin() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const loginBtn = document.getElementById('login-btn');
  const errEl    = document.getElementById('login-error');

  if (!username || !password) { showLoginError('Please enter username and password.'); return; }

  if (!API_URL) { showLoginError('No API URL configured. Expand "API Configuration" below and enter your Apps Script URL first.'); return; }

  loginBtn.textContent = 'Signing in…'; loginBtn.disabled = true;
  errEl.classList.add('hidden');

  try {
    const res = await apiPost({ action: 'login', username, password });
    if (res.error) { showLoginError(res.error); return; }
    localStorage.setItem('tracker_user', JSON.stringify({
      username:    res.username,
      displayName: res.displayName,
      role:        res.role
    }));
    initApp();
  } catch(err) {
    showLoginError('Cannot connect to server: ' + err.message);
  } finally {
    loginBtn.textContent = 'Sign In'; loginBtn.disabled = false;
  }
}

function showLoginError(msg) {
  const el = document.getElementById('login-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}

function saveLoginApiUrl() {
  const url = document.getElementById('login-api-url').value.trim();
  if (!url) return;
  API_URL = url;
  localStorage.setItem('tracker_api_url', url);
  const st = document.getElementById('login-url-status');
  st.textContent = '✓ URL saved. You can now sign in.';
}

function logout() {
  localStorage.removeItem('tracker_user');
  document.getElementById('app').classList.add('hidden');
  document.getElementById('login-overlay').classList.remove('hidden');
  document.getElementById('login-username').value = '';
  document.getElementById('login-password').value = '';
  document.getElementById('login-error').classList.add('hidden');
}

function renderUserBadge() {
  const u = getCurrentUser();
  if (!u) return;
  document.getElementById('user-badge').innerHTML =
    `<span class="user-info"><span class="user-avatar">${u.displayName[0]}</span><span class="user-name">${x(u.displayName)}</span><span class="user-role-chip ${u.role}">${u.role}</span></span>
     <button class="btn btn-outline btn-sm" onclick="logout()">Logout</button>`;

  // Hide settings from non-admin users
  if (!isAdmin()) {
    const btn = document.getElementById('btn-settings');
    if (btn) btn.classList.add('hidden');
  }
}

function initApp() {
  document.getElementById('login-overlay').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');

  renderUserBadge();

  if (!API_URL) show('config-banner');
  else { loadTickets(); loadAssignees(); }

  initMultiSelects();
  initImplMultiSelect('f-pic-dev',  DEVS);
  initImplMultiSelect('f-pic-test', DEVS);
  initImplMultiSelect('f-pic-impl');
  initImplMultiSelect('p-pic-dev',  DEVS);
  initImplMultiSelect('p-pic-test', DEVS);
  initImplMultiSelect('p-pic-impl');
  syncHideResolvedBtn();

  document.querySelectorAll('.stat-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.stat-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      const val = card.dataset.filter;
      clearMs('status');
      if (val !== 'all') setMs('status', val);
      applyFilters();
    });
  });

  document.querySelectorAll('.modal-overlay').forEach(o =>
    o.addEventListener('click', e => { if (e.target === o) closeModal(o.id); })
  );
}

// ============================================================
// DOM Ready
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  // Pre-fill API URL in login form
  if (API_URL) {
    const el = document.getElementById('login-api-url');
    if (el) el.value = API_URL;
  }

  const user = getCurrentUser();
  if (user) {
    initApp();
  } else {
    document.getElementById('login-overlay').classList.remove('hidden');
  }
});

// ============================================================
// API
// ============================================================

async function apiGet(params) {
  if (!API_URL) throw new Error('Not connected. Open Settings.');
  const url = new URL(API_URL);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res  = await fetch(url.toString(), { redirect: 'follow' });
  const text = await res.text();
  try { return JSON.parse(text); }
  catch { throw new Error('Bad response from server.'); }
}

async function apiPost(data) {
  if (!API_URL && data.action !== 'login') throw new Error('Not connected. Open Settings.');
  const url = API_URL || data._url || '';
  const res  = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(data), redirect: 'follow'
  });
  const text = await res.text();
  try { return JSON.parse(text); }
  catch { throw new Error('Bad response from server.'); }
}

// ============================================================
// Load
// ============================================================

async function loadTickets() {
  document.getElementById('loading').classList.remove('hidden');
  document.getElementById('ticket-table').classList.add('hidden');
  document.getElementById('empty-state').classList.add('hidden');
  hideBanner('jira-warning');

  try {
    const data = await apiGet({ action: 'getAllTickets' });
    if (data.error) throw new Error(data.error);
    tickets = data.tickets ? data.tickets : (Array.isArray(data) ? data : []);
    tickets.forEach(t => {
      if (!t.Application && t['Jira Ref']) t.Application = detectAppFromJiraRef(t['Jira Ref']);
      if (!t.Application && t.ID) t.Application = detectAppFromJiraRef(t.ID);
      // GAS email-auto-created tickets come in as 'Manual' — remap to match new naming
      if (t.Source === 'Manual') t.Source = 'ManageEngine';
      // Null/empty source tickets that match email RE-/SR- patterns are also ManageEngine
      if (!t.Source && t.Title && /\bRE-\d+\b|\bSR-/i.test(t.Title)) t.Source = 'ManageEngine';
    });
    if (data.jiraError) showBanner('jira-warning', '⚠️', 'Jira issue: ' + data.jiraError, '#FEF3C7', '#92400E');
    renderTable(tickets);
    renderStats(tickets);
    refreshAssigneeDropdown();
  } catch (err) {
    document.getElementById('loading').classList.add('hidden');
    const es = document.getElementById('empty-state');
    es.querySelector('h3').textContent = 'Could not load tickets';
    es.querySelector('p').textContent  = err.message;
    es.querySelector('.btn-new').classList.add('hidden');
    es.classList.remove('hidden');
  }
}

// ============================================================
// Render Table
// ============================================================

function renderTable(list) {
  filteredTickets = list;

  // Sort
  if (sortCol) {
    list = [...list].sort((a, b) => {
      let va, vb;
      if (sortCol === 'age') {
        va = a['Created Date'] ? new Date(a['Created Date']).getTime() : Infinity;
        vb = b['Created Date'] ? new Date(b['Created Date']).getTime() : Infinity;
      } else {
        va = a['Updated Date'] ? new Date(a['Updated Date']).getTime() : 0;
        vb = b['Updated Date'] ? new Date(b['Updated Date']).getTime() : 0;
      }
      return sortDir === 'asc' ? va - vb : vb - va;
    });
  }

  // Row count
  const countEl = document.getElementById('row-count');
  if (countEl) countEl.textContent = `Showing ${list.length} of ${tickets.length} ticket${tickets.length !== 1 ? 's' : ''}`;

  document.getElementById('loading').classList.add('hidden');
  const table = document.getElementById('ticket-table');
  const empty = document.getElementById('empty-state');

  if (!list.length) {
    table.classList.add('hidden');
    empty.querySelector('h3').textContent = 'No tickets found';
    empty.querySelector('p').textContent  = 'Create a new ticket or clear your filters.';
    empty.querySelector('.btn-new').classList.remove('hidden');
    empty.classList.remove('hidden');
    return;
  }

  table.classList.remove('hidden');
  empty.classList.add('hidden');

  document.getElementById('ticket-tbody').innerHTML = list.map(t => {
    const isJira = t.Source === 'Jira';
    const isME   = t.Source === 'ManageEngine';
    const sCls   = 's-' + slug(t.Status   || '');
    const pCls   = 'p-' + slug(t.Priority || '');

    const srcBadge = isJira ? '<span class="src-badge src-jira">Jira</span>'
      : isME                ? '<span class="src-badge src-me">ME</span>'
      :                       '<span class="src-badge src-manual">Tracker</span>';
    const idCell = isJira
      ? `<a class="jira-id" href="${x(t.URL)}" target="_blank">${x(t.ID)}</a>${srcBadge}`
      : `<span class="manual-id">${x(t.ID)}</span>${srcBadge}`;

    const stage = t.Stage || '';
    const stageHtml = stage
      ? `<span class="stage-badge" title="${x(stage)}">${x(stage)}</span>`
      : `<span style="color:#9CA3AF;font-size:12px">Not set</span>`;

    const trackBtn = `<button class="act-btn act-progress" onclick="openProgressModal('${x(t.ID)}')">${t.HasProgress ? '✏ Progress' : '+ Track'}</button>`;
    const actions = isJira
      ? `<button class="act-btn act-view" onclick="viewTicket('${x(t.ID)}')">View</button>
         ${trackBtn}
         <a class="act-btn act-jira" href="${x(t.URL)}" target="_blank">↗ Jira</a>`
      : `<button class="act-btn act-view" onclick="viewTicket('${x(t.ID)}')">View</button>
         ${trackBtn}
         <button class="act-btn act-edit"   onclick="editTicket('${x(t.ID)}')">Edit</button>
         <button class="act-btn act-delete" onclick="deleteTicket('${x(t.ID)}')">Del</button>`;

    const ageDays = (() => {
      if (!t['Created Date']) return null;
      const d = new Date(t['Created Date']);
      if (isNaN(d)) return null;
      return Math.floor((Date.now() - d) / 86400000);
    })();

    const slaTarget  = slaDays[t.Stage];
    const slaBreached = (() => {
      if (!slaTarget || !t['Updated Date']) return false;
      const upd = new Date(t['Updated Date']);
      return !isNaN(upd) && Math.floor((Date.now() - upd) / 86400000) > slaTarget;
    })();

    const ageClass = ageDays === null ? '' : ageDays > 14 ? 'age-old' : ageDays > 7 ? 'age-warn' : 'age-ok';
    const ageBadge = ageDays === null
      ? '<span style="color:#9CA3AF">—</span>'
      : `<span class="age-badge ${ageClass}${slaBreached ? ' sla-breach' : ''}"
              title="${slaBreached ? `⚠ No update for >${slaTarget}d (SLA for this stage)` : ageDays + 'd old'}">
           ${ageDays}d${slaBreached ? ' ⚠' : ''}
         </span>`;

    const updCell = (() => {
      if (!t['Updated Date']) return '<span style="color:#9CA3AF">—</span>';
      const d = new Date(t['Updated Date']);
      if (isNaN(d)) return '<span style="color:#9CA3AF">—</span>';
      const days = Math.floor((Date.now() - d) / 86400000);
      if (days === 0) return `<span style="color:#059669;font-size:12px">Today</span>`;
      if (days === 1) return `<span style="font-size:12px">Yesterday</span>`;
      return `<span style="font-size:12px;color:#6B7280">${days}d ago</span>`;
    })();

    return `<tr>
      <td class="id-cell">${idCell}</td>
      <td>
        <div class="t-title" onclick="viewTicket('${x(t.ID)}')">${x(t.Title)}</div>
        ${t.Requester   ? `<div class="t-sub">by ${x(t.Requester)}</div>` : ''}
        ${t['Jira Ref'] ? `<div class="t-sub">🔗 ${x(t['Jira Ref'])}</div>` : ''}
      </td>
      <td>${stageHtml}</td>
      <td><span class="badge ${pCls}">${x(t.Priority || '—')}</span></td>
      <td><span class="badge ${sCls}">${x(t.Status   || '—')}</span></td>
      <td>${t.Assignee ? x(t.Assignee) : '<span style="color:#9CA3AF">—</span>'}</td>
      <td>${updCell}</td>
      <td>${ageBadge}</td>
      <td><div class="act-btns">${actions}</div></td>
    </tr>`;
  }).join('');
}

function setSortCol(col) {
  if (sortCol === col) { sortDir = sortDir === 'asc' ? 'desc' : 'asc'; }
  else { sortCol = col; sortDir = col === 'updated' ? 'desc' : 'asc'; }
  updateSortHeaders();
  applyFilters();
}

function updateSortHeaders() {
  document.querySelectorAll('th[data-sort]').forEach(th => {
    const col = th.dataset.sort;
    th.classList.toggle('sort-active', col === sortCol);
    const arrow = th.querySelector('.sort-arrow');
    if (arrow) arrow.textContent = col !== sortCol ? '⇅' : sortDir === 'asc' ? '↑' : '↓';
  });
}

function renderStats(list) {
  const n = s => list.filter(t => t.Status === s).length;
  document.getElementById('s-total').textContent  = list.length;
  document.getElementById('s-open').textContent   = n('Open');
  document.getElementById('s-ip').textContent     = n('In Progress');
  document.getElementById('s-pend').textContent   = n('Pending');
  document.getElementById('s-res').textContent    = n('Resolved');
  document.getElementById('s-closed').textContent = n('Closed');
}

// ============================================================
// Filters
// ============================================================

function applyFilters() {
  const q  = document.getElementById('search').value.toLowerCase();
  const sr = document.getElementById('filter-source').value;
  const sg = msState.stage    || new Set();
  const ty = msState.type     || new Set();
  const st = msState.status   || new Set();
  const pr = msState.priority || new Set();
  const as = document.getElementById('filter-assignee').value;
  const ap = document.getElementById('filter-app').value;

  renderTable(tickets.filter(t => {
    if (hideResolved && st.size === 0 && (t.Status === 'Resolved' || t.Status === 'Closed')) return false;
    if (q  && !['Title','Description','ID','Requester','Notes','Project','Jira Ref','Change Ticket No','Application'].some(k => (t[k]||'').toLowerCase().includes(q))) return false;
    if (sr && t.Source      !== sr) return false;
    if (sg.size && !sg.has(t.Stage    || 'Not set')) return false;
    if (ty.size && !ty.has(t.Type     || '')) return false;
    if (st.size && !st.has(t.Status   || '')) return false;
    if (pr.size && !pr.has(t.Priority || '')) return false;
    if (as && t.Assignee    !== as) return false;
    if (ap && t.Application !== ap) return false;
    return true;
  }));
}

function clearFilters() {
  document.getElementById('search').value = '';
  document.getElementById('filter-source').value = '';
  document.getElementById('filter-assignee').value = '';
  document.getElementById('filter-app').value = '';
  ['stage','type','status','priority'].forEach(k => clearMs(k));
  document.querySelectorAll('.stat-card').forEach(c => c.classList.remove('active'));
  applyFilters();
}

function exportCSV() {
  if (!filteredTickets.length) { alert('No tickets to export.'); return; }
  const cols = ['ID','Source','Title','Type','Priority','Status','Stage','Requester','Assignee','Due Date','Jira Ref','Change Ticket No','Project','Notes','Description'];
  const esc  = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const rows = [cols.map(esc).join(',')];
  filteredTickets.forEach(t => rows.push(cols.map(c => esc(t[c])).join(',')));
  const blob = new Blob(['﻿' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'tickets_' + new Date().toISOString().slice(0,10) + '.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

function toggleHideResolved() {
  hideResolved = !hideResolved;
  localStorage.setItem('tracker_hide_resolved', hideResolved);
  syncHideResolvedBtn();
  applyFilters();
}

function syncHideResolvedBtn() {
  const btn = document.getElementById('btn-hide-resolved');
  if (!btn) return;
  const eyeOn  = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
  const eyeOff = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
  btn.innerHTML = hideResolved ? eyeOn + 'Show Resolved' : eyeOff + 'Hide Resolved';
  btn.classList.toggle('active-filter-btn', hideResolved);
}

// ============================================================
// Multi-Select Filters (header bar)
// ============================================================

function initMultiSelects() {
  Object.entries(MS_CONFIGS).forEach(([key, cfg]) => {
    msState[key] = new Set();
    const wrap = document.getElementById('ms-' + key);
    if (!wrap) return;
    wrap.innerHTML =
      `<div class="ms-btn" onclick="toggleMs('${key}')">` +
        `<span class="ms-lbl" id="mslbl-${key}">${cfg.placeholder}</span>` +
        `<span class="ms-arrow">▾</span>` +
      `</div>` +
      `<div class="ms-drop hidden" id="msdrop-${key}">` +
        cfg.options.map(o =>
          `<label class="ms-opt"><input type="checkbox" value="${x(o)}" onchange="onMsChange('${key}')">${x(o)}</label>`
        ).join('') +
      `</div>`;
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('.ms-wrap') && !e.target.closest('.form-ms-wrap'))
      document.querySelectorAll('.ms-drop').forEach(d => d.classList.add('hidden'));
  });
}

function toggleMs(key) {
  const drop = document.getElementById('msdrop-' + key);
  const isHidden = drop.classList.contains('hidden');
  document.querySelectorAll('.ms-drop').forEach(d => d.classList.add('hidden'));
  if (isHidden) drop.classList.remove('hidden');
}

function onMsChange(key) {
  const drop = document.getElementById('msdrop-' + key);
  const checked = [...drop.querySelectorAll('input:checked')].map(i => i.value);
  msState[key] = new Set(checked);
  const lbl = document.getElementById('mslbl-' + key);
  lbl.textContent = checked.length === 0 ? MS_CONFIGS[key].placeholder
    : checked.length === 1 ? checked[0]
    : checked.length + ' selected';
  applyFilters();
}

function setMs(key, val) {
  msState[key] = new Set([val]);
  const drop = document.getElementById('msdrop-' + key);
  if (drop) drop.querySelectorAll('input').forEach(i => { i.checked = i.value === val; });
  const lbl = document.getElementById('mslbl-' + key);
  if (lbl) lbl.textContent = val;
}

function clearMs(key) {
  msState[key] = new Set();
  const drop = document.getElementById('msdrop-' + key);
  if (drop) drop.querySelectorAll('input').forEach(i => { i.checked = false; });
  const lbl = document.getElementById('mslbl-' + key);
  if (lbl) lbl.textContent = MS_CONFIGS[key].placeholder;
}

// ============================================================
// PIC Implementor Multi-Select (form-level)
// ============================================================

function initImplMultiSelect(containerId, options) {
  const opts      = options || IMPLS;
  const container = document.getElementById(containerId);
  if (!container) return;
  container.className = 'form-ms-wrap';
  const key = 'fms-' + containerId;
  container.innerHTML =
    `<div class="ms-btn" onclick="toggleFormMs('${key}','${containerId}')">
      <span class="ms-lbl" id="mslbl-${key}">— Select —</span>
      <span class="ms-arrow">▾</span>
    </div>
    <div class="ms-drop hidden" id="msdrop-${key}">
      ${opts.map(o =>
        `<label class="ms-opt"><input type="checkbox" value="${x(o)}" onchange="onFormMsChange('${key}')">${x(o)}</label>`
      ).join('')}
    </div>`;
}

function toggleFormMs(key, containerId) {
  const drop = document.getElementById('msdrop-' + key);
  const isHidden = drop.classList.contains('hidden');
  document.querySelectorAll('.ms-drop').forEach(d => d.classList.add('hidden'));
  if (isHidden) {
    drop.classList.remove('hidden');
    // Position the dropdown correctly
    const container = document.getElementById(containerId);
    if (container) {
      const rect = container.getBoundingClientRect();
      drop.style.minWidth = Math.max(180, rect.width) + 'px';
    }
  }
}

function onFormMsChange(key) {
  const drop    = document.getElementById('msdrop-' + key);
  const checked = [...drop.querySelectorAll('input:checked')].map(i => i.value);
  const lbl     = document.getElementById('mslbl-' + key);
  lbl.textContent = checked.length === 0 ? '— Select —'
    : checked.length === 1 ? checked[0]
    : checked.length + ' selected';
}

function getFormMs(containerId) {
  const key  = 'fms-' + containerId;
  const drop = document.getElementById('msdrop-' + key);
  if (!drop) return '';
  return [...drop.querySelectorAll('input:checked')].map(i => i.value).join(', ');
}

function setFormMs(containerId, value) {
  const key  = 'fms-' + containerId;
  const drop = document.getElementById('msdrop-' + key);
  if (!drop) return;
  const vals = value ? value.split(',').map(v => v.trim()).filter(Boolean) : [];
  drop.querySelectorAll('input').forEach(i => { i.checked = vals.includes(i.value); });
  onFormMsChange(key);
}

// ============================================================
// Create / Edit (Manual)
// ============================================================

function detectAppFromJiraRef(ref) {
  const prefix = (ref || '').trim().toUpperCase().split('-')[0];
  return JIRA_APP_MAP[prefix] || '';
}

function onJiraRefInput() {
  const ref = document.getElementById('f-jira-ref').value;
  const app = detectAppFromJiraRef(ref);
  if (app) document.getElementById('f-application').value = app;
}

function openCreateModal() {
  if (!API_URL) { openSettings(); return; }
  document.getElementById('modal-title').textContent = 'New Ticket';
  document.getElementById('ticket-id').value = '';
  document.getElementById('ticket-form').reset();
  document.getElementById('f-status').value        = 'Open';
  document.getElementById('f-stage').value         = 'Requested / Reported';
  document.getElementById('f-priority').value      = 'Medium';
  setCabChangeType('f-cab-change-type-wrap', '');
  setFormMs('f-pic-dev',  '');
  setFormMs('f-pic-test', '');
  setFormMs('f-pic-impl', '');
  fillAssigneeSelect('f-assignee', '');
  openModal('ticket-modal');
}

function editTicket(id) {
  const t = tickets.find(t => t.ID === id);
  if (!t) return;
  if (t.Source === 'Jira') { alert('Jira tickets are read-only. Use "Track Progress" instead.'); return; }
  document.getElementById('modal-title').textContent      = 'Edit Ticket';
  document.getElementById('ticket-id').value              = t.ID;
  document.getElementById('f-title').value                = t.Title              || '';
  document.getElementById('f-type').value                 = t.Type               || '';
  document.getElementById('f-priority').value             = t.Priority           || 'Medium';
  document.getElementById('f-status').value               = t.Status             || 'Open';
  document.getElementById('f-stage').value                = t.Stage              || 'Requested / Reported';
  document.getElementById('f-requester').value            = t.Requester          || '';
  document.getElementById('f-description').value          = t.Description        || '';
  document.getElementById('f-notes').value                = t.Notes              || '';
  document.getElementById('f-due-date').value             = toDatetimeLocal(t['Due Date']);
  document.getElementById('f-jira-ref').value             = t['Jira Ref']        || '';
  document.getElementById('f-application').value          = t.Application        || detectAppFromJiraRef(t['Jira Ref']);
  setFormMs('f-pic-dev',  t['PIC Dev']  || '');
  setFormMs('f-pic-test', t['PIC Test'] || '');
  setFormMs('f-pic-impl', t['PIC Impl'] || '');
  document.getElementById('f-release-date').value         = toDatetimeLocal(t['Release Date']);
  document.getElementById('f-release-version').value      = t['Release Version'] || '';
  document.getElementById('f-change-ticket').value        = t['Change Ticket No']|| '';
  setCabChangeType('f-cab-change-type-wrap', t['CAB Change Type'] || '');
  document.getElementById('f-cab-date').value             = toDatetimeLocal(t['CAB Date']);
  document.getElementById('f-cab-status').value           = t['CAB Status']      || '';
  fillAssigneeSelect('f-assignee', t.Assignee || '');
  openModal('ticket-modal');
}

async function saveTicket() {
  const id    = document.getElementById('ticket-id').value;
  const title = document.getElementById('f-title').value.trim();
  const type  = document.getElementById('f-type').value;
  const prio  = document.getElementById('f-priority').value;
  if (!title) { alert('Title is required');    return; }
  if (!type)  { alert('Type is required');     return; }
  if (!prio)  { alert('Priority is required'); return; }

  const ticket = {
    id,
    'Source':           id ? undefined : 'Tracker',
    'Title':            title,
    'Type':             type,
    'Priority':         prio,
    'Status':           document.getElementById('f-status').value,
    'Stage':            document.getElementById('f-stage').value,
    'Assignee':         document.getElementById('f-assignee').value,
    'Requester':        document.getElementById('f-requester').value.trim(),
    'Due Date':         document.getElementById('f-due-date').value,
    'Jira Ref':         document.getElementById('f-jira-ref').value.trim(),
    'Application':      document.getElementById('f-application').value,
    'PIC Dev':          getFormMs('f-pic-dev'),
    'PIC Test':         getFormMs('f-pic-test'),
    'PIC Impl':         getFormMs('f-pic-impl'),
    'Release Date':     document.getElementById('f-release-date').value,
    'Release Version':  document.getElementById('f-release-version').value.trim(),
    'Change Ticket No': document.getElementById('f-change-ticket').value.trim(),
    'CAB Change Type':  getCabChangeType('f-cab-change-type-wrap'),
    'CAB Date':         document.getElementById('f-cab-date').value,
    'CAB Status':       document.getElementById('f-cab-status').value,
    'Description':      document.getElementById('f-description').value.trim(),
    'Notes':            document.getElementById('f-notes').value.trim()
  };

  const btn = document.querySelector('#ticket-modal .btn-primary');
  btn.textContent = 'Saving…'; btn.disabled = true;
  try {
    const res = await apiPost({ action: id ? 'updateTicket' : 'createTicket', ticket });
    if (res.error) throw new Error(res.error);
    closeModal('ticket-modal');
    await loadTickets();
  } catch (err) { alert('Error: ' + err.message); }
  finally { btn.textContent = 'Save Ticket'; btn.disabled = false; }
}

// ============================================================
// Progress Tracking (for Jira tickets)
// ============================================================

function openProgressModal(id) {
  const t = tickets.find(t => t.ID === id);
  if (!t) return;
  currentDetailId = id;

  document.getElementById('prog-jira-id').textContent  = t.ID + ' — ' + t.Title;
  document.getElementById('p-stage').value              = t.Stage              || 'Requested / Reported';
  setFormMs('p-pic-dev',  t['PIC Dev']  || '');
  setFormMs('p-pic-test', t['PIC Test'] || '');
  setFormMs('p-pic-impl', t['PIC Impl'] || '');
  document.getElementById('p-release-date').value       = toDatetimeLocal(t['Release Date']);
  document.getElementById('p-release-version').value    = t['Release Version'] || '';
  document.getElementById('p-change-ticket').value      = t['Change Ticket No']|| '';
  setCabChangeType('p-cab-change-type-wrap', t['CAB Change Type'] || '');
  document.getElementById('p-cab-date').value           = toDatetimeLocal(t['CAB Date']);
  document.getElementById('p-cab-status').value         = t['CAB Status']      || '';
  document.getElementById('p-notes').value              = t.Notes              || '';

  document.getElementById('p-delete-btn').style.display = t.HasProgress ? '' : 'none';

  closeModal('detail-modal');
  openModal('progress-modal');
}

async function saveProgress() {
  const id = currentDetailId;
  const progress = {
    'Jira ID':          id,
    'Stage':            document.getElementById('p-stage').value,
    'PIC Dev':          getFormMs('p-pic-dev'),
    'PIC Test':         getFormMs('p-pic-test'),
    'PIC Impl':         getFormMs('p-pic-impl'),
    'Release Date':     document.getElementById('p-release-date').value,
    'Release Version':  document.getElementById('p-release-version').value.trim(),
    'Change Ticket No': document.getElementById('p-change-ticket').value.trim(),
    'CAB Change Type':  getCabChangeType('p-cab-change-type-wrap'),
    'CAB Date':         document.getElementById('p-cab-date').value,
    'CAB Status':       document.getElementById('p-cab-status').value,
    'Notes':            document.getElementById('p-notes').value.trim()
  };

  const btn = document.querySelector('#progress-modal .btn-primary');
  btn.textContent = 'Saving…'; btn.disabled = true;
  try {
    const res = await apiPost({ action: 'saveProgress', progress });
    if (res.error) throw new Error(res.error);
    closeModal('progress-modal');
    await loadTickets();
  } catch (err) { alert('Error: ' + err.message); }
  finally { btn.textContent = 'Save Progress'; btn.disabled = false; }
}

async function deleteProgress() {
  if (!confirm('Remove progress tracking for this ticket?')) return;
  try {
    const res = await apiPost({ action: 'deleteProgress', jiraId: currentDetailId });
    if (res.error) throw new Error(res.error);
    closeModal('progress-modal');
    await loadTickets();
  } catch (err) { alert('Error: ' + err.message); }
}

// ============================================================
// View Detail
// ============================================================

function viewTicket(id) {
  const t = tickets.find(t => t.ID === id);
  if (!t) return;
  currentDetailId = id;
  const isJira = t.Source === 'Jira';

  document.getElementById('detail-id-badge').innerHTML = isJira
    ? `<a class="jira-id" href="${x(t.URL)}" target="_blank">${x(t.ID)}</a> <span class="src-badge src-jira">Jira</span>`
    : `<span class="manual-id">${x(t.ID)}</span> <span class="src-badge src-manual">Manual</span>`;
  document.getElementById('detail-title').textContent = t.Title;

  document.getElementById('detail-footer').innerHTML = isJira
    ? `<button class="btn btn-outline" onclick="openProgressModal('${x(t.ID)}')" style="margin-right:auto">
         📊 ${t.HasProgress ? 'Update Progress' : 'Track Progress'}
       </button>
       <button class="btn btn-outline" onclick="closeModal('detail-modal')">Close</button>
       <a class="btn btn-primary" href="${x(t.URL)}" target="_blank">↗ Open in Jira</a>`
    : `<button class="btn btn-danger"  onclick="confirmDelete()">Delete</button>
       <button class="btn btn-outline" onclick="closeModal('detail-modal')">Close</button>
       <button class="btn btn-primary" onclick="editFromDetail()">Edit</button>`;

  const currentIdx = STAGES.indexOf(t.Stage || '');
  const pipeline = STAGES.map((s, i) => {
    const cls = i < currentIdx ? 'done' : i === currentIdx ? 'active' : '';
    return `<div class="pipeline-step ${cls}">
      <div class="pipeline-dot">${i < currentIdx ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' : i + 1}</div>
      <div class="pipeline-label">${x(s)}</div>
    </div>`;
  }).join('');

  const fmt = d => {
    if (!d) return '—';
    const hasTime = d.length > 10;
    const dt = new Date(hasTime ? d : d + 'T00:00:00');
    if (isNaN(dt)) return d;
    const dateStr = dt.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
    return hasTime ? dateStr + ' ' + dt.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}) : dateStr;
  };
  const cabCls = t['CAB Status']==='Approved' ? 'cab-approved' : t['CAB Status']==='Rejected' ? 'cab-rejected' : 'cab-pending';

  const implDisplay = t['PIC Impl']
    ? t['PIC Impl'].split(',').map(v => `<span class="pic-chip impl">${x(v.trim())}</span>`).join(' ')
    : '—';

  document.getElementById('detail-body').innerHTML = `
    ${t.Stage || t.HasProgress ? `<div class="pipeline">${pipeline}</div>` : ''}

    <div class="detail-section-title">Overview</div>
    <div class="detail-grid">
      <div class="detail-field"><label>Status</label>
        <div class="val">
          <span class="badge s-${slug(t.Status||'')}">${x(t.Status||'—')}</span>
          ${isJira && t['Jira Status'] ? `<span style="font-size:11px;color:#9CA3AF;margin-left:6px">(Jira: ${x(t['Jira Status'])})</span>` : ''}
        </div></div>
      <div class="detail-field"><label>Priority</label>
        <div class="val"><span class="badge p-${slug(t.Priority||'')}">${x(t.Priority||'—')}</span></div></div>
      <div class="detail-field"><label>Type</label>
        <div class="val"><span class="badge badge-type">${x(t.Type||'—')}</span></div></div>
      <div class="detail-field"><label>Project</label>
        <div class="val">${x(t.Project||'—')}</div></div>
      <div class="detail-field"><label>Assignee</label>
        <div class="val">${x(t.Assignee||'—')}</div></div>
      <div class="detail-field"><label>Requester</label>
        <div class="val">${x(t.Requester||'—')}</div></div>
      <div class="detail-field"><label>Due Date</label>
        <div class="val">${fmt(t['Due Date'])}</div></div>
      <div class="detail-field"><label>Created</label>
        <div class="val">${fmt(t['Created Date'])}</div></div>
      ${!isJira && t['Jira Ref'] ? `
      <div class="detail-field"><label>Jira Reference</label>
        <div class="val"><a href="https://privasia.atlassian.net/browse/${x(t['Jira Ref'])}" target="_blank" style="color:#2563EB">${x(t['Jira Ref'])}</a></div></div>` : ''}
      ${t.Application ? `
      <div class="detail-field"><label>Application</label>
        <div class="val"><span class="app-chip">${x(t.Application)}</span></div></div>` : ''}
    </div>

    ${(t['PIC Dev'] || t['PIC Test'] || t['PIC Impl']) ? `
    <div class="detail-section-title">Person in Charge</div>
    <div class="detail-grid">
      <div class="detail-field"><label>PIC Developer</label><div class="val">${t['PIC Dev'] ? t['PIC Dev'].split(',').map(v=>`<span class="pic-chip">${x(v.trim())}</span>`).join(' ') : '—'}</div></div>
      <div class="detail-field"><label>PIC Tester</label><div class="val">${t['PIC Test'] ? t['PIC Test'].split(',').map(v=>`<span class="pic-chip">${x(v.trim())}</span>`).join(' ') : '—'}</div></div>
      <div class="detail-field"><label>PIC Implementor</label><div class="val">${implDisplay}</div></div>
    </div>` : ''}

    ${(t['Release Date'] || t['Release Version'] || t['Change Ticket No'] || t['CAB Status']) ? `
    <div class="detail-section-title">Release &amp; CAB</div>
    <div class="detail-grid">
      <div class="detail-field"><label>Release Date</label><div class="val">${fmt(t['Release Date'])}</div></div>
      <div class="detail-field"><label>Release Version</label><div class="val">${x(t['Release Version']||'—')}</div></div>
      <div class="detail-field"><label>Change Ticket No</label><div class="val">${x(t['Change Ticket No']||'—')}</div></div>
      <div class="detail-field"><label>CAB Change Type</label><div class="val">${t['CAB Change Type'] ? t['CAB Change Type'].split(',').map(v => `<span class="cab-change-type-badge">${x(v.trim())}</span>`).join('') : '—'}</div></div>
      <div class="detail-field"><label>CAB Date</label><div class="val">${fmt(t['CAB Date'])}</div></div>
      <div class="detail-field"><label>CAB Status</label>
        <div class="val">${t['CAB Status'] ? `<span class="badge ${cabCls}">${x(t['CAB Status'])}</span>` : '—'}</div></div>
    </div>` : ''}

    <div class="detail-section-title">Description</div>
    <div class="detail-text" style="margin-bottom:12px">${x(t.Description||'—')}</div>

    ${t.Notes ? `<div class="detail-section-title">Notes</div>
    <div class="detail-text" style="margin-bottom:12px">${x(t.Notes)}</div>` : ''}

    <div class="detail-section-title">Status History</div>
    <div id="detail-status-log"><p style="color:#9CA3AF;font-size:12px;padding:6px 0">Loading…</p></div>

    <div class="detail-section-title">Documents</div>
    <div id="detail-docs-list"></div>
    <div class="doc-upload-row" style="margin-top:10px">
      <select id="doc-type-select" class="filter-select" style="font-size:12px;padding:6px 8px">
        <option>URS</option>
        <option>Test Document</option>
        <option>Test Result with Signoff</option>
        <option>DB Script</option>
        <option>MOP</option>
        <option>Operational Risk Assessment (ORA)</option>
        <option>Release Note</option>
        <option>Sign-off</option>
        <option>Others</option>
      </select>
      <label class="doc-file-label">
        📎 Choose file
        <input type="file" id="doc-file-input" style="display:none" onchange="updateFileName(this)">
      </label>
      <span id="doc-file-name" style="font-size:12px;color:#6B7280;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"></span>
      <button id="doc-upload-btn" class="btn btn-primary btn-sm" onclick="handleFileUpload('${x(t.ID)}')">↑ Upload</button>
    </div>
  `;

  openModal('detail-modal');
  loadDocuments(t.ID);
  loadStatusLog(t.ID);
}

function editFromDetail() { closeModal('detail-modal'); editTicket(currentDetailId); }

// ============================================================
// Status Log
// ============================================================

async function loadStatusLog(ticketId) {
  const section = document.getElementById('detail-status-log');
  if (!section) return;
  try {
    const logs = await apiGet({ action: 'getStatusLog', ticketId });
    if (!Array.isArray(logs) || logs.length === 0) {
      section.innerHTML = '<p style="color:#9CA3AF;font-size:12px;padding:6px 0">No history yet.</p>';
      return;
    }
    const fieldColor = f => f === 'Status' ? '#4F46E5' : '#059669';
    section.innerHTML = `<div class="status-log-list">${logs.map(l => {
      const arrow = l['Old Value']
        ? `<span class="log-old">${x(l['Old Value'])}</span> → <span class="log-new">${x(l['New Value'])}</span>`
        : `<span class="log-new">${x(l['New Value'])}</span>`;
      return `<div class="log-entry">
        <span class="log-field" style="color:${fieldColor(l['Field'])}">${x(l['Field'])}</span>
        <span class="log-arrow">${arrow}</span>
        <span class="log-ts">${x(l['Timestamp'])}</span>
      </div>`;
    }).join('')}</div>`;
  } catch(e) {
    section.innerHTML = `<p style="color:#9CA3AF;font-size:12px;padding:6px 0">Could not load history.</p>`;
  }
}

// ============================================================
// Documents
// ============================================================

async function loadDocuments(ticketId) {
  const section = document.getElementById('detail-docs-list');
  if (!section) return;
  section.innerHTML = '<p style="color:#9CA3AF;font-size:12px;padding:8px 0">Loading…</p>';
  try {
    const docs = await apiGet({ action: 'getDocuments', ticketId });
    if (!Array.isArray(docs) || docs.length === 0) {
      section.innerHTML = '<p style="color:#9CA3AF;font-size:12px;padding:8px 0">No documents yet.</p>';
      return;
    }
    section.innerHTML = docs.map(d => {
      const icon = docIcon(d['Doc Type']);
      const kb   = d['Size (KB)'] ? d['Size (KB)'] + ' KB' : '';
      return `<div class="doc-item">
        <span class="doc-icon">${icon}</span>
        <div class="doc-info">
          <div class="doc-name">${x(d['File Name'])}</div>
          <div class="doc-meta"><span class="doc-type-tag">${x(d['Doc Type'])}</span> ${kb ? `<span style="color:#9CA3AF">${kb}</span>` : ''}</div>
        </div>
        <div class="doc-actions">
          <a class="doc-btn doc-view" href="${x(d['View URL'])}" target="_blank">View</a>
          <a class="doc-btn doc-dl"   href="${x(d['Download URL'])}" target="_blank">↓ Download</a>
          <button class="doc-btn doc-del" onclick="deleteDocument('${x(d['ID'])}','${x(ticketId)}')">✕</button>
        </div>
      </div>`;
    }).join('');
  } catch(e) {
    section.innerHTML = `<p style="color:#EF4444;font-size:12px;padding:8px 0">Could not load documents: ${x(e.message)}</p>`;
  }
}

async function handleFileUpload(ticketId) {
  const input   = document.getElementById('doc-file-input');
  const docType = document.getElementById('doc-type-select').value || 'Others';
  const file    = input.files[0];
  if (!file) { alert('Please select a file first.'); return; }
  if (file.size > 8 * 1024 * 1024) { alert('File is too large. Maximum size is 8MB.'); return; }

  const uploadBtn = document.getElementById('doc-upload-btn');
  uploadBtn.textContent = 'Uploading…'; uploadBtn.disabled = true;

  try {
    const base64 = await toBase64(file);
    const res = await apiPost({
      action:   'uploadDocument',
      ticketId: ticketId,
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      docType:  docType,
      base64:   base64,
      size:     file.size
    });
    if (res.error) throw new Error(res.error);
    input.value = '';
    document.getElementById('doc-file-name').textContent = '';
    await loadDocuments(ticketId);
  } catch(err) {
    alert('Upload failed: ' + err.message);
  } finally {
    uploadBtn.textContent = '↑ Upload'; uploadBtn.disabled = false;
  }
}

async function deleteDocument(docId, ticketId) {
  if (!confirm('Delete this document? It will be removed from Google Drive.')) return;
  try {
    const res = await apiPost({ action: 'deleteDocument', docId });
    if (res.error) throw new Error(res.error);
    await loadDocuments(ticketId);
  } catch(err) { alert('Error: ' + err.message); }
}

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function updateFileName(input) {
  const label = document.getElementById('doc-file-name');
  if (label) label.textContent = input.files[0] ? input.files[0].name : '';
}

function docIcon(type) {
  const map = {
    'URS': '📄', 'Test Document': '🧪', 'Test Result with Signoff': '✅',
    'DB Script': '🗄️', 'MOP': '📋',
    'Operational Risk Assessment (ORA)': '⚠️',
    'Release Note': '📝', 'Sign-off': '✍️'
  };
  return map[type] || '📎';
}

async function confirmDelete() {
  if (!confirm('Delete this ticket? This cannot be undone.')) return;
  try {
    const res = await apiPost({ action: 'deleteTicket', id: currentDetailId });
    if (res.error) throw new Error(res.error);
    closeModal('detail-modal'); await loadTickets();
  } catch (err) { alert('Error: ' + err.message); }
}

async function deleteTicket(id) {
  if (!confirm('Delete this ticket?')) return;
  try {
    const res = await apiPost({ action: 'deleteTicket', id });
    if (res.error) throw new Error(res.error);
    await loadTickets();
  } catch (err) { alert('Error: ' + err.message); }
}

// ============================================================
// Email → RE-ID Tickets
// ============================================================

async function checkEmailTickets() {
  const btn      = document.getElementById('btn-check-email');
  const statusEl = document.getElementById('email-check-status');
  if (btn) { btn.textContent = '📧 Checking…'; btn.disabled = true; }
  try {
    const res = await apiPost({ action: 'checkEmailTickets' });
    if (res.error) throw new Error(res.error);
    const msg = `✓ Created: ${res.created}  Closed: ${res.closed || 0}  Skipped: ${res.skipped}` +
                (res.errors && res.errors.length ? '  Errors: ' + res.errors.join(', ') : '');
    if (statusEl) { statusEl.textContent = msg; statusEl.style.color = '#059669'; }
    if (res.created > 0 || res.closed > 0) await loadTickets();
  } catch(err) {
    if (statusEl) { statusEl.textContent = '✗ ' + err.message; statusEl.style.color = '#EF4444'; }
    else alert('Email check failed: ' + err.message);
  } finally {
    if (btn) { btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>Check Email'; btn.disabled = false; }
  }
}

async function setupEmailTrigger() {
  const statusEl = document.getElementById('email-check-status');
  const interval = document.getElementById('email-interval-select').value;
  try {
    const res = await apiPost({ action: 'setupEmailTrigger', intervalMinutes: parseInt(interval) });
    if (res.error) throw new Error(res.error);
    if (statusEl) { statusEl.textContent = '✓ ' + res.message; statusEl.style.color = '#059669'; }
    else alert(res.message);
  } catch(err) {
    if (statusEl) { statusEl.textContent = '✗ ' + err.message; statusEl.style.color = '#EF4444'; }
    else alert('Error: ' + err.message);
  }
}

// ============================================================
// Assignees
// ============================================================

async function loadAssignees() {
  if (!API_URL) return;
  try {
    const data = await apiGet({ action: 'getAssignees' });
    if (Array.isArray(data)) { assignees = data; renderAssigneesList(); refreshAssigneeDropdown(); }
  } catch (e) { console.warn('Assignees:', e.message); }
}

function refreshAssigneeDropdown() {
  const sel = document.getElementById('filter-assignee'), cur = sel.value;
  const names = [...new Set(tickets.filter(t => t.Assignee).map(t => t.Assignee))].sort();
  sel.innerHTML = '<option value="">All Assignees</option>' +
    names.map(n => `<option value="${x(n)}">${x(n)}</option>`).join('');
  sel.value = names.includes(cur) ? cur : '';
}

function fillAssigneeSelect(selId, selected) {
  document.getElementById(selId).innerHTML = '<option value="">Unassigned</option>' +
    assignees.map(a => `<option value="${x(a.name)}"${a.name===selected?' selected':''}>${x(a.name)}</option>`).join('');
}

function renderAssigneesList() {
  document.getElementById('assignees-list').innerHTML = assignees.map(a =>
    `<span class="assignee-tag">${x(a.name)}${a.email?` <span style="color:#9CA3AF">&lt;${x(a.email)}&gt;</span>`:''}
     <button onclick="removeAssignee('${x(a.name)}')" title="Remove">✕</button></span>`
  ).join('');
}

async function addAssignee() {
  const name  = document.getElementById('new-assignee-name').value.trim();
  const email = document.getElementById('new-assignee-email').value.trim();
  if (!name) { alert('Name is required'); return; }
  try {
    const res = await apiPost({ action: 'addAssignee', name, email });
    if (res.error) throw new Error(res.error);
    document.getElementById('new-assignee-name').value  = '';
    document.getElementById('new-assignee-email').value = '';
    await loadAssignees();
  } catch (err) { alert('Error: ' + err.message); }
}

async function removeAssignee(name) {
  if (!confirm(`Remove "${name}"?`)) return;
  try {
    const res = await apiPost({ action: 'removeAssignee', name });
    if (res.error) throw new Error(res.error);
    await loadAssignees();
  } catch (err) { alert('Error: ' + err.message); }
}

// ============================================================
// User Management (admin only)
// ============================================================

async function loadUsers() {
  try {
    const data = await apiPost({ action: 'getUsers' });
    if (!Array.isArray(data)) return;
    document.getElementById('users-list').innerHTML = data.map(u =>
      `<span class="assignee-tag">
        ${x(u['Display Name'] || u['Username'])}
        <span class="user-role-chip ${x(u['Role'])}" style="font-size:10px;padding:1px 6px;border-radius:4px;margin-left:4px">${x(u['Role'])}</span>
        ${u['Username'] !== 'admin' ? `<button onclick="removeUser('${x(u['Username'])}')" title="Remove">✕</button>` : ''}
      </span>`
    ).join('');
  } catch(e) { console.warn('Users:', e.message); }
}

async function addUser() {
  const username = document.getElementById('new-user-username').value.trim();
  const password = document.getElementById('new-user-password').value;
  const display  = document.getElementById('new-user-display').value.trim();
  const role     = document.getElementById('new-user-role').value;
  if (!username || !password) { alert('Username and password are required'); return; }
  try {
    const res = await apiPost({ action: 'addUser', user: { username, password, displayName: display, role } });
    if (res.error) throw new Error(res.error);
    document.getElementById('new-user-username').value = '';
    document.getElementById('new-user-password').value = '';
    document.getElementById('new-user-display').value  = '';
    await loadUsers();
  } catch (err) { alert('Error: ' + err.message); }
}

async function removeUser(username) {
  if (!confirm(`Remove user "${username}"?`)) return;
  try {
    const res = await apiPost({ action: 'removeUser', username });
    if (res.error) throw new Error(res.error);
    await loadUsers();
  } catch (err) { alert('Error: ' + err.message); }
}

// ============================================================
// Settings
// ============================================================

function openSettings() {
  if (!isAdmin()) { alert('Settings are only accessible to admin users.'); return; }
  document.getElementById('api-url').value = API_URL;
  document.getElementById('conn-status').textContent = '';
  document.getElementById('conn-status').className   = 'conn-status';
  renderAssigneesList();
  loadUsers();
  renderSLAForm();
  openModal('settings-modal');
}

function renderSLAForm() {
  const el = document.getElementById('sla-form');
  if (!el) return;
  el.innerHTML = Object.entries(DEFAULT_SLA).map(([stage, def]) => `
    <div class="sla-row">
      <label class="sla-label">${x(stage)}</label>
      <input type="number" class="sla-input" id="sla-${slug(stage)}" value="${slaDays[stage] || def}" min="1" max="90">
      <span class="sla-unit">days</span>
    </div>`).join('');
}

function saveSLA() {
  Object.keys(DEFAULT_SLA).forEach(stage => {
    const el = document.getElementById('sla-' + slug(stage));
    if (el) slaDays[stage] = parseInt(el.value) || DEFAULT_SLA[stage];
  });
  localStorage.setItem('tracker_sla', JSON.stringify(slaDays));
  const st = document.getElementById('sla-status');
  if (st) { st.textContent = '✓ SLA targets saved'; setTimeout(() => { st.textContent = ''; }, 3000); }
  applyFilters();
}

function resetSLA() {
  slaDays = { ...DEFAULT_SLA };
  localStorage.removeItem('tracker_sla');
  renderSLAForm();
  const st = document.getElementById('sla-status');
  if (st) { st.textContent = '✓ Reset to defaults'; setTimeout(() => { st.textContent = ''; }, 3000); }
  applyFilters();
}

async function setupReminderTrigger() {
  const statusEl = document.getElementById('reminder-status');
  const hour = parseInt(document.getElementById('reminder-hour').value);
  statusEl.style.color = '#6B7280';
  statusEl.textContent = 'Setting up…';
  try {
    const res = await apiPost({ action: 'setupDailyReminder', hour });
    if (res.error) throw new Error(res.error);
    statusEl.textContent = '✓ ' + (res.message || 'Daily reminder enabled at ' + hour + ':00');
    statusEl.style.color = '#059669';
  } catch(err) {
    statusEl.textContent = '✗ ' + err.message;
    statusEl.style.color = '#EF4444';
  }
}

function saveApiUrl() {
  const url = document.getElementById('api-url').value.trim();
  API_URL   = url;
  localStorage.setItem('tracker_api_url', url);
  document.getElementById('config-banner').classList.toggle('hidden', !!url);
  setStatus('Saved.', 'ok');
  if (url) { loadTickets(); loadAssignees(); }
}

async function testConnection() {
  const url = document.getElementById('api-url').value.trim();
  if (!url) { alert('Enter a URL first'); return; }
  setStatus('Testing…', '');
  try {
    const u = new URL(url); u.searchParams.set('action', 'getAllTickets');
    const data = JSON.parse(await (await fetch(u.toString(), { redirect: 'follow' })).text());
    if (data.error) throw new Error(data.error);
    const list = data.tickets || (Array.isArray(data) ? data : []);
    const j = list.filter(t => t.Source === 'Jira').length;
    const m = list.filter(t => t.Source !== 'Jira').length;
    if (data.jiraError) setStatus(`⚠ Connected — Jira error: ${data.jiraError}`, 'err');
    else setStatus(`✓ Connected — ${j} Jira + ${m} local`, 'ok');
  } catch (err) { setStatus('✗ ' + err.message, 'err'); }
}

function setStatus(msg, cls) {
  const el = document.getElementById('conn-status');
  el.textContent = msg; el.className = 'conn-status' + (cls ? ' ' + cls : '');
}

// ============================================================
// Banners
// ============================================================

function showBanner(id, icon, msg, bg, color) {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('div'); el.id = id;
    el.style.cssText = 'border-radius:8px;padding:10px 14px;margin-bottom:12px;font-size:13px;display:flex;gap:8px;align-items:center;border:1px solid rgba(0,0,0,0.08)';
    document.querySelector('.main').insertBefore(el, document.querySelector('.ticket-container'));
  }
  el.style.background = bg; el.style.color = color;
  el.innerHTML = `<span>${icon}</span><span>${x(msg)}</span>`;
}

function hideBanner(id) { const el = document.getElementById(id); if (el) el.remove(); }

// ============================================================
// View Switching
// ============================================================

function showView(view) {
  ['tickets','dashboard','cab','versions'].forEach(v => {
    document.getElementById('view-' + v).classList.toggle('hidden', view !== v);
    document.getElementById('tab-'  + v).classList.toggle('active', view === v);
  });
  if (view === 'dashboard') renderDashboard();
  if (view === 'cab')       loadCabDashboard();
  if (view === 'versions')  initVersionsView();
}

// ============================================================
// CAB Dashboard
// ============================================================

async function loadCabDashboard() {
  const loadEl  = document.getElementById('cab-loading');
  const tableEl = document.getElementById('cab-table');
  const emptyEl = document.getElementById('cab-empty');
  loadEl.classList.remove('hidden');
  tableEl.classList.add('hidden');
  emptyEl.classList.add('hidden');

  try {
    const data = await apiGet({ action: 'getCabDashboard' });
    if (data.error) throw new Error(data.error);
    const list = (Array.isArray(data) ? data : []).filter(t => t.Status !== 'Resolved');
    loadEl.classList.add('hidden');
    renderCabSummary(list);
    renderCabTable(list, tableEl, emptyEl);
  } catch(err) {
    loadEl.classList.add('hidden');
    emptyEl.querySelector('h3').textContent = 'Could not load CAB data';
    emptyEl.querySelector('p').textContent  = err.message;
    emptyEl.classList.remove('hidden');
  }
}

function renderCabSummary(list) {
  const total   = list.length;
  const ready   = list.filter(t => t['CAB Ready']).length;
  const pending = list.filter(t => t['CAB Status'] === 'Pending').length;
  const approved= list.filter(t => t['CAB Status'] === 'Approved').length;
  const missDocs= list.filter(t => !t['CAB Ready']).length;

  document.getElementById('cab-summary').innerHTML = [
    { n: total,    l: 'CAB Tickets',     c: '' },
    { n: ready,    l: 'CAB Ready',       c: 'c-res' },
    { n: missDocs, l: 'Missing Docs',    c: 'c-crit' },
    { n: pending,  l: 'Pending CAB',     c: 'c-pend' },
    { n: approved, l: 'CAB Approved',    c: 'c-res' }
  ].map(s => `
    <div class="dash-sum-card">
      <div class="dash-sum-num ${s.c}">${s.n}</div>
      <div class="dash-sum-lbl">${s.l}</div>
    </div>`).join('');
}

function renderCabTable(list, tableEl, emptyEl) {
  if (!list.length) { emptyEl.classList.remove('hidden'); return; }
  tableEl.classList.remove('hidden');

  const svgCheck = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
  const svgCross = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

  const doc = (has, label) =>
    `<span class="cab-doc-check ${has ? 'ok' : 'miss'}" title="${has ? label + ' uploaded' : label + ' missing'}">
      ${has ? svgCheck : svgCross}
    </span>`;

  const cabCls = s => s === 'Approved' ? 'cab-approved' : s === 'Rejected' ? 'cab-rejected' : s ? 'cab-pending' : '';

  const fmt = d => {
    if (!d) return '—';
    const dt = new Date(d.length > 10 ? d : d + 'T00:00:00');
    return isNaN(dt) ? d : dt.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
  };

  document.getElementById('cab-tbody').innerHTML = list.map(t => {
    const isJira = t.Source === 'Jira';
    const idCell = isJira
      ? `<a class="jira-id" href="${x(t.URL)}" target="_blank">${x(t.ID)}</a>`
      : `<span class="manual-id">${x(t.ID)}</span>`;

    return `<tr>
      <td class="id-cell">${idCell} ${isJira ? '<span class="src-badge src-jira">Jira</span>' : '<span class="src-badge src-manual">Manual</span>'}</td>
      <td>
        <div class="t-title" onclick="viewTicket('${x(t.ID)}');showView('tickets')">${x(t.Title)}</div>
        <div class="t-sub">${x(t.Stage || '')}</div>
      </td>
      <td>${t['CAB Change Type']
        ? t['CAB Change Type'].split(',').map(v => `<span class="cab-change-type-badge">${x(v.trim())}</span>`).join('')
        : '<span style="color:#9CA3AF">—</span>'}</td>
      <td>${x(t['Change Ticket No'] || '—')}</td>
      <td>${fmt(t['CAB Date'])}</td>
      <td style="text-align:center">${doc(t['Doc MOP'], 'MOP')}</td>
      <td style="text-align:center">${doc(t['Doc Test Result'], 'Test Result + Signoff')}</td>
      <td style="text-align:center">${doc(t['Doc ORA'], 'ORA Form')}</td>
      <td style="text-align:center">
        ${t['CAB Ready']
          ? `<span class="cab-ready-badge ok">${svgCheck} Ready</span>`
          : `<span class="cab-ready-badge miss">${svgCross} Not Ready</span>`}
      </td>
      <td>${t['CAB Status'] ? `<span class="badge ${cabCls(t['CAB Status'])}">${x(t['CAB Status'])}</span>` : '<span style="color:#9CA3AF">—</span>'}</td>
      <td>${(() => {
        const missing = [];
        if (!t['Doc MOP'])         missing.push('MOP');
        if (!t['Doc Test Result']) missing.push('Test Signoff');
        if (!t['Doc ORA'])         missing.push('ORA Form');
        if (!t['CAB Date'])        missing.push('CAB Date');
        if (!t['Change Ticket No']) missing.push('Change Ticket No');
        return missing.length
          ? missing.map(m => `<span class="miss-item">${m}</span>`).join(' ')
          : `<span class="miss-item-ok">${svgCheck} Complete</span>`;
      })()}</td>
    </tr>`;
  }).join('');
}

// ============================================================
// Dashboard
// ============================================================

function renderDashboard() {
  const active = tickets.filter(t => t.Status !== 'Closed' && t.Status !== 'Resolved');
  renderDashSummary(active);
  renderDevCards(active);
  renderSupportCards(active);
  renderProgressTable(active);
  renderCharts(active);
}

function renderDashSummary(active) {
  const now      = new Date();
  const in7days  = new Date(now.getTime() + 7 * 86400000);
  const total    = tickets.length;
  const open     = tickets.filter(t => t.Status === 'Open').length;
  const inprog   = tickets.filter(t => t.Status === 'In Progress').length;
  const pending  = tickets.filter(t => t.Status === 'Pending').length;
  const overdue  = tickets.filter(t => {
    if (!t['Due Date'] || t.Status === 'Closed' || t.Status === 'Resolved') return false;
    return new Date(t['Due Date'] + 'T00:00:00') < now;
  }).length;
  const dueWeek  = active.filter(t => {
    if (!t['Due Date']) return false;
    const d = new Date(t['Due Date'] + 'T00:00:00');
    return !isNaN(d) && d >= now && d <= in7days;
  }).length;
  const aging14  = active.filter(t => {
    if (!t['Created Date']) return false;
    const d = new Date(t['Created Date']);
    return !isNaN(d) && (now - d) / 86400000 > 14;
  }).length;
  const cabReady   = active.filter(t => t['CAB Ready']).length;
  const pendingCAB = active.filter(t => t.Stage === 'Pending CAB Approval').length;
  const missDocs   = active.filter(t => t['Change Ticket No'] && (!t['Doc MOP'] || !t['Doc Test Result'] || !t['Doc ORA'])).length;

  document.getElementById('dash-summary').innerHTML = [
    { n: total,      l: 'Total Tickets',       c: '' },
    { n: open,       l: 'Open',                c: 'c-open' },
    { n: inprog,     l: 'In Progress',         c: 'c-ip' },
    { n: pending,    l: 'Pending',             c: 'c-pend' },
    { n: overdue,    l: 'Overdue',             c: 'c-crit' },
    { n: dueWeek,    l: 'Due This Week',       c: overdue > 0 ? 'c-warn' : '' },
    { n: aging14,    l: 'Aging > 14 Days',     c: aging14  > 0 ? 'c-warn' : '' },
    { n: cabReady,   l: 'CAB Ready',           c: 'c-res'  },
    { n: pendingCAB, l: 'Pending CAB',         c: pendingCAB > 0 ? 'c-pend' : '' },
    { n: missDocs,   l: 'Missing Docs (CAB)',  c: missDocs > 0 ? 'c-crit' : '' }
  ].map(s => `
    <div class="dash-sum-card">
      <div class="dash-sum-num ${s.c}">${s.n}</div>
      <div class="dash-sum-lbl">${s.l}</div>
    </div>`).join('');
}

function renderDevCards(active) {
  const grid = document.getElementById('dash-dev-cards');
  const cards = DEVS.map(dev => {
    const devTickets = active.filter(t => {
      const devList  = (t['PIC Dev']  || '').split(',').map(v => v.trim());
      const testList = (t['PIC Test'] || '').split(',').map(v => v.trim());
      const implList = (t['PIC Impl'] || '').split(',').map(v => v.trim());
      return (devList.includes(dev)  && DEV_PHASE_STAGES.has(t.Stage))
          || (testList.includes(dev) && TEST_PHASE_STAGES.has(t.Stage))
          || (implList.includes(dev) && DEV_STAGES.has(t.Stage));
    });
    if (!devTickets.length) return `
      <div class="dev-card dev-card-empty">
        <div class="dev-avatar">${dev[0]}</div>
        <div class="dev-name">${dev}</div>
        <div class="dev-count">No dev/test tickets</div>
      </div>`;

    const rows = devTickets.slice(0, 5).map(t => {
      const devList  = (t['PIC Dev']  || '').split(',').map(v => v.trim());
      const testList = (t['PIC Test'] || '').split(',').map(v => v.trim());
      const pct  = STAGE_PCT[t.Stage] || 0;
      const role = (devList.includes(dev)  && DEV_PHASE_STAGES.has(t.Stage))  ? 'Dev'
                 : (testList.includes(dev) && TEST_PHASE_STAGES.has(t.Stage)) ? 'Test'
                 : (t['PIC Impl'] || '').split(',').map(v => v.trim()).includes(dev) ? 'Impl'
                 : 'Assigned';
      const pCls = 'p-' + slug(t.Priority || '');
      return `
        <div class="dev-ticket" onclick="viewTicket('${x(t.ID)}');showView('tickets')">
          <div class="dev-ticket-top">
            <span class="dev-ticket-id">${x(t.ID)}</span>
            <span class="badge ${pCls}" style="font-size:10px">${x(t.Priority||'')}</span>
            <span class="dev-role-tag">${role}</span>
          </div>
          <div class="dev-ticket-title">${x(t.Title)}</div>
          <div class="dev-ticket-stage">${x(t.Stage||'Not set')}</div>
          <div class="prog-bar-wrap">
            <div class="prog-bar-fill" style="width:${pct}%"></div>
          </div>
          <div class="prog-pct">${pct}%</div>
        </div>`;
    }).join('');

    const more = devTickets.length > 5
      ? `<div style="font-size:11px;color:#9CA3AF;padding:6px 0;text-align:center">+${devTickets.length - 5} more</div>`
      : '';

    return `
      <div class="dev-card">
        <div class="dev-card-header">
          <div class="dev-avatar">${dev[0]}</div>
          <div>
            <div class="dev-name">${dev}</div>
            <div class="dev-count">${devTickets.length} dev/test ticket${devTickets.length !== 1 ? 's' : ''}</div>
          </div>
        </div>
        <div class="dev-tickets">${rows}${more}</div>
      </div>`;
  }).join('');

  grid.innerHTML = cards;
}

function renderSupportCards(active) {
  const grid = document.getElementById('dash-support-cards');
  if (!grid) return;
  const supportTickets = active.filter(t => SUPPORT_STAGES.has(t.Stage));
  const cards = DEVS.map(dev => {
    const myTickets = supportTickets.filter(t => t.Assignee === dev);
    if (!myTickets.length) return `
      <div class="dev-card dev-card-empty">
        <div class="dev-avatar">${dev[0]}</div>
        <div class="dev-name">${dev}</div>
        <div class="dev-count">No investigation tickets</div>
      </div>`;

    const rows = myTickets.slice(0, 5).map(t => {
      const pCls = 'p-' + slug(t.Priority || '');
      const ageDays = t['Created Date'] ? Math.floor((Date.now() - new Date(t['Created Date'])) / 86400000) : null;
      return `
        <div class="dev-ticket" onclick="viewTicket('${x(t.ID)}');showView('tickets')">
          <div class="dev-ticket-top">
            <span class="dev-ticket-id">${x(t.ID)}</span>
            <span class="badge ${pCls}" style="font-size:10px">${x(t.Priority||'')}</span>
            ${ageDays !== null ? `<span class="age-badge ${ageDays>14?'age-old':ageDays>7?'age-warn':'age-ok'}" style="font-size:10px;padding:2px 6px">${ageDays}d</span>` : ''}
          </div>
          <div class="dev-ticket-title">${x(t.Title)}</div>
          <div class="dev-ticket-stage">${x(t.Stage||'Not set')}</div>
        </div>`;
    }).join('');

    const more = myTickets.length > 5
      ? `<div style="font-size:11px;color:#9CA3AF;padding:6px 0;text-align:center">+${myTickets.length - 5} more</div>`
      : '';

    return `
      <div class="dev-card">
        <div class="dev-card-header">
          <div class="dev-avatar">${dev[0]}</div>
          <div>
            <div class="dev-name">${dev}</div>
            <div class="dev-count">${myTickets.length} investigation ticket${myTickets.length !== 1 ? 's' : ''}</div>
          </div>
        </div>
        <div class="dev-tickets">${rows}${more}</div>
      </div>`;
  }).join('');

  grid.innerHTML = cards;
}

function renderProgressTable(active) {
  const tbody  = document.getElementById('dash-progress-tbody');
  const sorted = [...active].sort((a, b) => (STAGE_PCT[b.Stage] || 0) - (STAGE_PCT[a.Stage] || 0));

  if (!sorted.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#9CA3AF;padding:20px">No active tickets</td></tr>`;
    return;
  }

  tbody.innerHTML = sorted.map(t => {
    const pct    = STAGE_PCT[t.Stage] || 0;
    const sCls   = 's-' + slug(t.Status || '');
    const isJira = t.Source === 'Jira';
    const idHtml = isJira
      ? `<a class="jira-id" href="${x(t.URL)}" target="_blank">${x(t.ID)}</a>`
      : `<span class="manual-id">${x(t.ID)}</span>`;

    const implChips = t['PIC Impl']
      ? t['PIC Impl'].split(',').map(v => `<span class="pic-chip impl" style="font-size:10px">${x(v.trim())}</span>`).join(' ')
      : '<span style="color:#9CA3AF">—</span>';

    return `
      <tr>
        <td class="id-cell">${idHtml}</td>
        <td>
          <div class="t-title" onclick="viewTicket('${x(t.ID)}');showView('tickets')">${x(t.Title)}</div>
          <div class="t-sub"><span class="badge ${sCls}" style="font-size:10px">${x(t.Status||'')}</span></div>
        </td>
        <td>${t['PIC Dev']  ? t['PIC Dev'].split(',').map(v=>`<span class="pic-chip" style="font-size:10px">${x(v.trim())}</span>`).join(' ')  : '<span style="color:#9CA3AF">—</span>'}</td>
        <td>${t['PIC Test'] ? t['PIC Test'].split(',').map(v=>`<span class="pic-chip" style="font-size:10px">${x(v.trim())}</span>`).join(' ') : '<span style="color:#9CA3AF">—</span>'}</td>
        <td>${implChips}</td>
        <td><span class="stage-badge">${x(t.Stage || 'Not set')}</span></td>
        <td>
          <div style="display:flex;align-items:center;gap:8px">
            <div class="prog-bar-wrap" style="flex:1">
              <div class="prog-bar-fill ${pct === 100 ? 'done' : pct >= 70 ? 'near' : ''}" style="width:${pct}%"></div>
            </div>
            <span style="font-size:12px;font-weight:700;color:${pct===100?'#059669':pct>=70?'#D97706':'#4F46E5'};min-width:32px">${pct}%</span>
          </div>
        </td>
      </tr>`;
  }).join('');
}

function renderCharts(active) {
  if (chartDev)    { chartDev.destroy();    chartDev    = null; }
  if (chartStage)  { chartStage.destroy();  chartStage  = null; }
  if (chartStatus) { chartStatus.destroy(); chartStatus = null; }

  const devCounts = DEVS.map(dev =>
    active.filter(t => {
      const devList  = (t['PIC Dev']  || '').split(',').map(v => v.trim());
      const testList = (t['PIC Test'] || '').split(',').map(v => v.trim());
      const implList = (t['PIC Impl'] || '').split(',').map(v => v.trim());
      return (devList.includes(dev)  && DEV_PHASE_STAGES.has(t.Stage))
          || (testList.includes(dev) && TEST_PHASE_STAGES.has(t.Stage))
          || (implList.includes(dev) && DEV_STAGES.has(t.Stage));
    }).length
  );
  chartDev = new Chart(document.getElementById('chart-dev'), {
    type: 'bar',
    data: {
      labels: DEVS,
      datasets: [{ label: 'Dev/Test Tickets', data: devCounts, backgroundColor: '#4F46E5', borderRadius: 6 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
    }
  });

  const stageCounts = STAGES.map(s => active.filter(t => t.Stage === s).length);
  const noStageCnt  = active.filter(t => !t.Stage).length;
  const stageColors = [
    '#E0E7FF','#C7D2FE','#A5B4FC','#818CF8','#6366F1',
    '#4F46E5','#4338CA','#3730A3','#312E81','#1E1B4B',
    '#059669','#10B981','#34D399','#6EE7B7','#065F46','#F59E0B','#64748B','#9CA3AF'
  ];
  chartStage = new Chart(document.getElementById('chart-stage'), {
    type: 'bar',
    data: {
      labels: [...STAGES, 'Not Set'],
      datasets: [{ label: 'Tickets', data: [...stageCounts, noStageCnt], backgroundColor: stageColors, borderRadius: 4 }]
    },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true, ticks: { stepSize: 1 } },
        y: { ticks: { font: { size: 11 }, autoSkip: false } }
      }
    }
  });

  const statusLabels = ['Open','In Progress','Pending','Resolved','Closed'];
  const statusColors = ['#3B82F6','#F59E0B','#8B5CF6','#10B981','#9CA3AF'];
  const statusData   = statusLabels.map(s => tickets.filter(t => t.Status === s).length);
  chartStatus = new Chart(document.getElementById('chart-status'), {
    type: 'doughnut',
    data: {
      labels: statusLabels,
      datasets: [{ data: statusData, backgroundColor: statusColors, borderWidth: 2 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } }
    }
  });
}

// ============================================================
// Modal & Utils
// ============================================================

function openModal(id)  { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
function show(id)       { document.getElementById(id).classList.remove('hidden'); }
function slug(s)        { return s.toLowerCase().replace(/\s+/g, '-'); }

function setCabChangeType(wrapperId, value) {
  const wrap = document.getElementById(wrapperId);
  if (!wrap) return;
  const vals = (value || '').split(',').map(v => v.trim()).filter(Boolean);
  wrap.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.checked = vals.includes(cb.value);
  });
}

function getCabChangeType(wrapperId) {
  const wrap = document.getElementById(wrapperId);
  if (!wrap) return '';
  return Array.from(wrap.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value).join(', ');
}

function toDatetimeLocal(val) {
  if (!val) return '';
  if (val.length > 10 && val.includes('T')) return val.slice(0, 16);
  return val + 'T00:00';
}

function dueFmt(d) {
  if (!d) return '<span style="color:#9CA3AF">—</span>';
  const hasTime = d.length > 10;
  const dt = new Date(hasTime ? d : d + 'T00:00:00');
  if (isNaN(dt)) return '<span style="color:#9CA3AF">—</span>';
  const now = new Date();
  const today = new Date(); today.setHours(0,0,0,0);
  const dtDay = new Date(dt); dtDay.setHours(0,0,0,0);
  const diff  = (dtDay - today) / 86400000;
  const dateStr = dt.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
  const timeStr = hasTime ? ' ' + dt.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}) : '';
  const lbl = dateStr + timeStr;
  if (hasTime ? dt < now : diff < 0) return `<span class="due overdue">⚠ ${lbl}</span>`;
  if (diff === 0) return `<span class="due today">${hasTime ? lbl : 'Today'}</span>`;
  if (diff <= 3)  return `<span class="due soon">${lbl}</span>`;
  return `<span class="due ok">${lbl}</span>`;
}

function setSelectOrFirst(id, value) {
  const sel = document.getElementById(id);
  if (!sel) return;
  const exists = Array.from(sel.options).some(o => o.value === value);
  sel.value = exists ? value : '';
}

function x(s) {
  return String(s ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

// ============================================================
// App Versions View
// ============================================================

const APP_VERSIONS = {
  'ver-cbas-web':  '2.75.2',
  'ver-cbas-vm':   '2.73.0',
  'ver-scss-wdc':  '5.54.5',
  'ver-scss-rgs':  '5.55.2',
  'ver-scss-ags':  '5.6.2',
  'ver-scss-swim': '5.55.2',
  'ver-scss-cm':   '5.54.2',
  'ver-scss-web':  '5.54.2',
  'ver-cronjob':   '1.7.0',
  'ver-edic':      '2.89.2',
};

function initVersionsView() {
  Object.entries(APP_VERSIONS).forEach(([id, ver]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = ver;
  });
  const upd = document.getElementById('versions-last-updated');
  if (upd) upd.textContent = '12 Jun 2026';
}
