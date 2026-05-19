// ================================================================
// app.js — TMA Task Tracker Mini App (Single Page)
// ================================================================

'use strict';

// ── 1. CONFIG ────────────────────────────────────────────────
const CONFIG = {
  STRAPI_URL: 'http://localhost:1337', // ← เปลี่ยนตาม env จริง
  MIN_TEXT:   5,
  MIN_NAME:   2,
};

// ── 2. STATE ─────────────────────────────────────────────────
const State = {
  jwt:      localStorage.getItem('tma_jwt') || null,
  user:     JSON.parse(localStorage.getItem('tma_user') || 'null'),
  view:     'loading',
  params:   {},
  history:  [],  // view stack สำหรับ back button
  navTab:   'dashboard',

  save() {
    if (this.jwt)  localStorage.setItem('tma_jwt',  this.jwt);
    else           localStorage.removeItem('tma_jwt');
    if (this.user) localStorage.setItem('tma_user', JSON.stringify(this.user));
    else           localStorage.removeItem('tma_user');
  },
  isManager() { return this.user?.role_level === 'Manager'; },
  isApproved() { return this.user?.account_status === 'Approved'; },
};

// ── 3. API WRAPPER ───────────────────────────────────────────
const Api = {
  async request(method, path, body, isMultipart = false) {
    const headers = {};
    if (State.jwt) headers['Authorization'] = `Bearer ${State.jwt}`;
    if (!isMultipart) headers['Content-Type'] = 'application/json';

    const opts = { method, headers };
    if (body) opts.body = isMultipart ? body : JSON.stringify(body);

    const res = await fetch(CONFIG.STRAPI_URL + path, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
    return data;
  },
  get(path)         { return this.request('GET',    path); },
  post(path, body)  { return this.request('POST',   path, body); },
  put(path, body)   { return this.request('PUT',    path, body); },
  postForm(path, fd){ return this.request('POST',   path, fd, true); },

  // ── Auth ──
  telegramLogin(initData)        { return this.post('/api/auth/telegram', { initData }); },
  telegramRegister(full_name, telegramId, firstName) {
    return this.post('/api/auth/telegram/register', { full_name, telegramId, firstName });
  },

  // ── Tasks ──
  getTasks(qs = '')              { return this.get(`/api/tasks?populate=current_owner,previous_owner,project${qs}`); },
  getTask(id)                    { return this.get(`/api/tasks/${id}?populate=current_owner,previous_owner,project`); },
  createTask(data)               { return this.post('/api/tasks', { data }); },
  submitTask(id, fd)             { return this.postForm(`/api/tasks/${id}/submit`, fd); },
  approveTask(id)                { return this.post(`/api/tasks/${id}/approve`); },
  rejectTask(id, rejection_note) { return this.post(`/api/tasks/${id}/reject`, { rejection_note }); },
  handoverTask(id, handover_reason) { return this.post(`/api/tasks/${id}/handover`, { handover_reason }); },
  requestPickup(id)              { return this.post(`/api/tasks/${id}/request-pickup`); },
  cancelPickup(id)               { return this.post(`/api/tasks/${id}/cancel-pickup`); },
  approvePickup(id)              { return this.post(`/api/tasks/${id}/approve-pickup`); },
  getSignedUrl(id)               { return this.get(`/api/tasks/${id}/signed-url`); },

  // ── Projects ──
  getProjects()                  { return this.get('/api/projects?populate=tasks'); },
  getProject(id)                 { return this.get(`/api/projects/${id}?populate=tasks,tasks.current_owner`); },
  createProject(data)            { return this.post('/api/projects', { data }); },

  // ── Memberships ──
  getMemberships(qs = '')        { return this.get(`/api/project-memberships?populate=project,member${qs}`); },
  requestMembership(projectId)   { return this.post('/api/project-memberships', { data: { project: projectId, membershipStatus: 'Requested' } }); },
  approveMembership(id)          { return this.post(`/api/project-memberships/${id}/approve`); },

  // ── Users ──
  getUsers(qs = '')              { return this.get(`/api/users?${qs}`); },
  approveUser(id)                { return this.put(`/api/users/${id}`, { account_status: 'Approved' }); },
};

// ── 4. VALIDATION ────────────────────────────────────────────
const Validate = {
  text(val, min = CONFIG.MIN_TEXT) {
    const t = (val || '').trim();
    if (!t) return 'ห้ามเว้นว่าง';
    if (t.length < min) return `ต้องมีอย่างน้อย ${min} ตัวอักษร`;
    if (!/[a-zA-Zก-๙]/.test(t)) return 'ต้องมีตัวอักษรภาษาไทยหรืออังกฤษ';
    return null;
  },
  name(val) { return this.text(val, CONFIG.MIN_NAME); },
};

// ── 5. HELPERS ───────────────────────────────────────────────
const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();

function toast(msg, dur = 2500) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), dur);
}

function haptic(type = 'light') {
  if (type === 'success') tg?.HapticFeedback.notificationOccurred('success');
  else if (type === 'error') tg?.HapticFeedback.notificationOccurred('error');
  else tg?.HapticFeedback.impactOccurred(type);
}

function fmtDate(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function statusBadge(status) {
  const map = {
    'In Progress':        ['badge-blue',   '🔵', 'กำลังดำเนินการ'],
    'Waiting for Pickup': ['badge-purple', '🟣', 'รอคนรับช่วง'],
    'Under Review':       ['badge-amber',  '🟡', 'รอตรวจ'],
    'Done':               ['badge-green',  '🟢', 'เสร็จแล้ว'],
  };
  const [cls, icon, label] = map[status] || ['badge-gray', '⚪', status || '-'];
  return `<span class="badge ${cls}">${icon} ${label}</span>`;
}

function setTitle(t) { document.getElementById('page-title').textContent = t; }
function setBackBtn(show) {
  document.getElementById('back-btn').classList.toggle('show', show);
}
function setTopAction(html) {
  document.getElementById('top-action').innerHTML = html || '';
}

function renderNav(role, activeTab) {
  const nav = document.getElementById('bottom-nav');
  const items = role === 'Manager'
    ? [
        { id: 'dashboard',  icon: '📊', label: 'ภาพรวม' },
        { id: 'approvals',  icon: '✅', label: 'อนุมัติ' },
        { id: 'projects',   icon: '📁', label: 'โปรเจกต์' },
      ]
    : [
        { id: 'dashboard',   icon: '📋', label: 'งานของฉัน' },
        { id: 'projects',    icon: '📁', label: 'โปรเจกต์' },
        { id: 'marketplace', icon: '🏪', label: 'ตลาดรับงาน' },
      ];

  nav.innerHTML = items.map(it => `
    <button class="nav-item ${it.id === activeTab ? 'active' : ''}"
      onclick="App.navTo('${it.id}')">
      <span class="nav-icon">${it.icon}</span>
      <span>${it.label}</span>
    </button>
  `).join('');
  nav.classList.remove('hidden');
  document.getElementById('view').classList.remove('no-nav');
}

function hideNav() {
  document.getElementById('bottom-nav').classList.add('hidden');
  document.getElementById('view').classList.add('no-nav');
}

function setView(html) {
  document.getElementById('view').innerHTML = html;
}

function loading(msg = 'กำลังโหลด...') {
  return `<div class="centered"><div class="spinner"></div><p>${msg}</p></div>`;
}

function empty(icon, msg) {
  return `<div class="centered"><div class="empty-icon">${icon}</div><p class="empty-text">${msg}</p></div>`;
}

// ── 6. ROUTER ────────────────────────────────────────────────
const App = {
  async navigate(view, params = {}, addHistory = true) {
    if (addHistory && State.view !== 'loading') {
      State.history.push({ view: State.view, params: { ...State.params } });
    }
    State.view   = view;
    State.params = params;
    setTopAction('');
    await Views.render(view, params);
  },

  back() {
    const prev = State.history.pop();
    if (prev) this.navigate(prev.view, prev.params, false);
  },

  navTo(tab) {
    haptic('light');
    State.history = [];
    State.navTab  = tab;
    const viewMap = {
      dashboard:   State.isManager() ? 'managerDashboard' : 'staffDashboard',
      approvals:   'managerApprovals',
      projects:    'projects',
      marketplace: 'marketplace',
    };
    this.navigate(viewMap[tab] || tab, {}, false);
  },

  async init() {
    setView(loading());
    hideNav();
    try {
      const initData = tg?.initData || '';
      if (!initData) {
        setView(`<div class="full-page">
          <div style="font-size:48px">📱</div>
          <h2>กรุณาเปิดผ่าน Telegram</h2>
          <p>แอปนี้ต้องเปิดผ่านปุ่มใน Telegram Bot เท่านั้น</p>
        </div>`);
        return;
      }
      // ส่ง initData ทุกครั้ง เพื่อ sync สถานะล่าสุดจาก Strapi
      const res = await Api.telegramLogin(initData);
      if (!res.registered) {
        await this.navigate('register', { initData }, false);
        return;
      }
      // อัปเดต user ใหม่ทุกครั้ง ไม่ใช้ cache
      State.jwt  = res.jwt;
      State.user = res.user;
      State.save();
      this.renderAuthed();
    } catch (e) {
      setView(`<div class="full-page">
        <div style="font-size:48px">❌</div>
        <h2>เกิดข้อผิดพลาด</h2>
        <p>${e.message}</p>
        <button class="btn btn-primary" style="margin-top:16px;max-width:200px" onclick="App.init()">ลองใหม่</button>
      </div>`);
    }
  },

  renderAuthed() {
    if (!State.isApproved()) {
      this.navigate('pending', {}, false);
      return;
    }
    State.navTab = 'dashboard';
    this.navigate(State.isManager() ? 'managerDashboard' : 'staffDashboard', {}, false);
  },
};

// ── 7. VIEWS ─────────────────────────────────────────────────
const Views = {
  async render(view, params) {
    setView(loading());
    try {
      switch (view) {
        case 'register':           await this.register(params); break;
        case 'pending':            this.pending(); break;
        case 'staffDashboard':     await this.staffDashboard(); break;
        case 'managerDashboard':   await this.managerDashboard(); break;
        case 'projects':           await this.projects(); break;
        case 'projectDetail':      await this.projectDetail(params); break;
        case 'createTask':         this.createTask(params); break;
        case 'taskDetail':         await this.taskDetail(params); break;
        case 'submitTask':         await this.submitTask(params); break;
        case 'handover':           await this.handover(params); break;
        case 'marketplace':        await this.marketplace(); break;
        case 'managerApprovals':   await this.managerApprovals(); break;
        case 'managerReviewTask':  await this.managerReviewTask(params); break;
        case 'createProject':      this.createProject(); break;
        default:                   setView('<div class="centered"><p>ไม่พบหน้านี้</p></div>');
      }
    } catch (e) {
      setView(`<div class="centered"><p>❌ ${e.message}</p>
        <button class="btn btn-gray btn-sm" onclick="App.back()">กลับ</button>
      </div>`);
    }
  },

  // ════════════════════════════════════════
  // REGISTER
  // ════════════════════════════════════════
  async register({ initData }) {
    hideNav();
    setBackBtn(false);
    setTitle('สมัครใช้งาน');
    const tgUser = tg?.initDataUnsafe?.user;
    const prefill = tgUser?.first_name || '';

    setView(`
      <div class="container" style="max-width:480px;margin:0 auto;padding-top:24px">
        <div style="text-align:center;padding:16px 0 24px">
          <div style="font-size:56px;margin-bottom:12px">👋</div>
          <h2 style="font-size:20px;font-weight:800">ยินดีต้อนรับ!</h2>
          <p style="color:var(--gray);font-size:14px;margin-top:6px">กรอกชื่อของคุณเพื่อเริ่มใช้งาน</p>
        </div>
        <div class="form-group">
          <label class="form-label">ชื่อ-นามสกุล *</label>
          <input id="inp-name" class="form-input" type="text" placeholder="กรอกชื่อจริง" value="${prefill}" />
          <span id="err-name" class="form-error"></span>
        </div>
        <button class="btn btn-primary" id="btn-register" onclick="Views._doRegister('${initData}', ${tgUser?.id || 0}, '${prefill}')">
          สมัครใช้งาน
        </button>
      </div>
    `);
  },

  async _doRegister(initData, telegramId, firstName) {
    const full_name = document.getElementById('inp-name').value;
    const err = Validate.name(full_name);
    document.getElementById('err-name').textContent = err || '';
    if (err) return;

    const btn = document.getElementById('btn-register');
    btn.disabled = true; btn.textContent = 'กำลังสมัคร...';
    try {
      const res = await Api.telegramRegister(full_name.trim(), String(telegramId), firstName);
      State.jwt  = res.jwt;
      State.user = res.user;
      State.save();
      haptic('success');
      App.navigate('pending', {}, false);
    } catch (e) {
      btn.disabled = false; btn.textContent = 'สมัครใช้งาน';
      toast('❌ ' + e.message);
      haptic('error');
    }
  },

  // ════════════════════════════════════════
  // PENDING APPROVAL
  // ════════════════════════════════════════
  pending() {
    hideNav();
    setBackBtn(false);
    setTitle('รอการอนุมัติ');
    setView(`
      <div class="full-page">
        <div style="font-size:64px">⏳</div>
        <h2>รอหัวหน้าอนุมัติ</h2>
        <p>บัญชีของคุณอยู่ระหว่างการตรวจสอบ<br>หัวหน้าจะแจ้งผลให้ทราบทาง Telegram</p>
        <div class="alert alert-blue" style="max-width:360px;text-align:left;margin-top:8px">
          <b>ชื่อ:</b> ${State.user?.full_name || '-'}<br>
          <b>สถานะ:</b> รอการอนุมัติ
        </div>
      </div>
    `);
  },

  // ════════════════════════════════════════
  // STAFF DASHBOARD
  // ════════════════════════════════════════
  async staffDashboard() {
    setTitle('งานของฉัน');
    setBackBtn(false);
    setTopAction('');
    renderNav('Staff', 'dashboard');

    const res = await Api.getTasks(`&filters[current_owner][id][$eq]=${State.user.id}`);
    const tasks = res.data || [];

    const inProgress = tasks.filter(t => t.status_task === 'In Progress');
    const rejected   = tasks.filter(t => t.status_task === 'In Progress' && t.rejection_note);
    const inProg     = tasks.filter(t => t.status_task === 'In Progress' && !t.rejection_note);
    const underReview= tasks.filter(t => t.status_task === 'Under Review');

    const taskCard = (t) => `
      <div class="card" onclick="App.navigate('taskDetail',{id:'${t.documentId}'})">
        <div class="card-row">
          <span class="card-title">${t.task_name}</span>
          ${statusBadge(t.status_task)}
        </div>
        ${t.rejection_note ? `<div class="alert alert-red" style="margin-top:8px;font-size:13px">❗ ${t.rejection_note}</div>` : ''}
        <div class="card-sub" style="margin-top:6px">📁 ${t.project?.name || '-'}</div>
      </div>`;

    let html = '<div class="container">';
    if (!tasks.length) {
      html += empty('📋', 'ยังไม่มีงาน\nไปที่โปรเจกต์เพื่อสร้างงานใหม่');
    } else {
      if (rejected.length) {
        html += `<div class="section-label">❗ ถูกตีกลับ (${rejected.length})</div>`;
        html += rejected.map(taskCard).join('');
      }
      if (inProg.length) {
        html += `<div class="section-label">🔵 กำลังดำเนินการ (${inProg.length})</div>`;
        html += inProg.map(taskCard).join('');
      }
      if (underReview.length) {
        html += `<div class="section-label">🟡 รอตรวจ (${underReview.length})</div>`;
        html += underReview.map(taskCard).join('');
      }
    }
    html += '</div>';
    setView(html);
  },

  // ════════════════════════════════════════
  // PROJECTS
  // ════════════════════════════════════════
  async projects() {
    setTitle('โปรเจกต์');
    setBackBtn(false);
    renderNav(State.user.role_level, 'projects');
    if (State.isManager()) {
      setTopAction(`<button class="btn btn-primary btn-sm" onclick="App.navigate('createProject')">+ สร้าง</button>`);
    }

    const [projRes, memRes] = await Promise.all([
      Api.getProjects(),
      State.isManager() ? Promise.resolve({ data: [] }) : Api.getMemberships(`&filters[member][id][$eq]=${State.user.id}`),
    ]);

    const allProjects  = projRes.data || [];
    const memberships  = memRes.data  || [];
    const memberIds    = new Set(memberships.filter(m => m.membershipStatus === 'Member').map(m => m.project?.documentId));
    const requestedIds = new Set(memberships.filter(m => m.membershipStatus === 'Requested').map(m => m.project?.documentId));

    let html = '<div class="container">';
    if (!allProjects.length) {
      html += empty('📁', 'ยังไม่มีโปรเจกต์');
    } else {
      allProjects.forEach(p => {
        const isMember   = State.isManager() || memberIds.has(p.documentId);
        const isRequested = requestedIds.has(p.documentId);
        const taskCount  = p.tasks?.length || 0;
        const isOver     = p.deadline && new Date(p.deadline) < new Date();
        html += `
          <div class="card ${isMember ? '' : 'no-click'}" ${isMember ? `onclick="App.navigate('projectDetail',{id:'${p.documentId}'});haptic('light')"` : ''}>
            <div class="card-row">
              <span class="card-title">${p.name}</span>
              ${isMember ? '<span class="badge badge-blue">สมาชิก</span>' : isRequested ? '<span class="badge badge-amber">รออนุมัติ</span>' : ''}
            </div>
            <div class="card-sub" style="margin-top:4px">
              📅 ${p.deadline ? fmtDate(p.deadline) : 'ไม่มีเดดไลน์'}
              ${isOver ? ' <span style="color:var(--red)">⚠️ เกินเวลา</span>' : ''}
              &nbsp;·&nbsp; 📋 ${taskCount} งาน
            </div>
            ${!isMember && !isRequested ? `
              <button class="btn btn-primary btn-sm" style="margin-top:10px"
                onclick="event.stopPropagation();Views._requestMembership('${p.documentId}',this)">
                ขอเข้าร่วม
              </button>` : ''}
          </div>`;
      });
    }
    html += '</div>';
    setView(html);
  },

  async _requestMembership(projectId, btn) {
    btn.disabled = true; btn.textContent = 'กำลังส่งคำขอ...';
    try {
      await Api.requestMembership(projectId);
      haptic('success');
      toast('✅ ส่งคำขอแล้ว รอหัวหน้าอนุมัติ');
      btn.textContent = 'รออนุมัติ';
    } catch (e) {
      btn.disabled = false; btn.textContent = 'ขอเข้าร่วม';
      toast('❌ ' + e.message); haptic('error');
    }
  },

  // ════════════════════════════════════════
  // PROJECT DETAIL
  // ════════════════════════════════════════
  async projectDetail({ id }) {
    setTitle('โปรเจกต์');
    setBackBtn(true);
    hideNav();

    const res  = await Api.getProject(id);
    const proj = res.data;
    const tasks = proj.tasks || [];
    const isOver = proj.deadline && new Date(proj.deadline) < new Date();

    setTitle(proj.name);
    if (!State.isManager()) {
      setTopAction(`<button class="btn btn-primary btn-sm" onclick="App.navigate('createTask',{projectId:'${proj.documentId}',projectName:'${proj.name}'})">+ งานใหม่</button>`);
    }

    let html = `<div class="container">
      <div class="card no-click">
        <div class="card-sub">📅 เดดไลน์: ${proj.deadline ? fmtDate(proj.deadline) : 'ไม่กำหนด'}
          ${isOver ? '<span style="color:var(--red)"> ⚠️ เกินเวลา</span>' : ''}</div>
        <div class="card-sub" style="margin-top:4px">📋 งานทั้งหมด ${tasks.length} รายการ</div>
      </div>`;

    if (!tasks.length) {
      html += empty('📋', 'ยังไม่มีงานในโปรเจกต์นี้');
    } else {
      html += `<div class="section-label">รายการงาน</div>`;
      tasks.forEach(t => {
        const dest = State.isManager() && t.status_task === 'Under Review'
          ? `managerReviewTask` : `taskDetail`;
        html += `
          <div class="card" onclick="App.navigate('${dest}',{id:'${t.documentId}'})">
            <div class="card-row">
              <span class="card-title">${t.task_name}</span>
              ${statusBadge(t.status_task)}
            </div>
            <div class="card-sub" style="margin-top:4px">
              👤 ${t.current_owner?.full_name || t.current_owner?.username || 'ไม่มีเจ้าของ'}
            </div>
          </div>`;
      });
    }
    html += '</div>';
    setView(html);
  },

  // ════════════════════════════════════════
  // CREATE TASK
  // ════════════════════════════════════════
  createTask({ projectId, projectName }) {
    setTitle('สร้างงานใหม่');
    setBackBtn(true);
    hideNav();
    setTopAction('');

    setView(`
      <div class="container" style="max-width:480px;margin:0 auto">
        <div class="alert alert-blue">📁 ${projectName || 'โปรเจกต์'}</div>
        <div class="form-group">
          <label class="form-label">ชื่องาน *</label>
          <input id="inp-taskname" class="form-input" type="text" placeholder="เช่น ติดตั้งสายไฟชั้น 2 ห้อง 201" />
          <span id="err-taskname" class="form-error"></span>
          <span class="form-hint">ต้องมีอย่างน้อย 5 ตัวอักษร</span>
        </div>
        <button class="btn btn-primary" id="btn-create" onclick="Views._doCreateTask('${projectId}')">
          ✅ สร้างงาน
        </button>
      </div>
    `);
  },

  async _doCreateTask(projectId) {
    const task_name = document.getElementById('inp-taskname').value;
    const err = Validate.text(task_name);
    document.getElementById('err-taskname').textContent = err || '';
    if (err) return;

    const btn = document.getElementById('btn-create');
    btn.disabled = true; btn.textContent = 'กำลังสร้าง...';
    try {
      const res = await Api.createTask({
        task_name: task_name.trim(),
        project: projectId,
        current_owner: State.user.id,
        status_task: 'In Progress',
      });
      haptic('success');
      toast('✅ สร้างงานแล้ว');
      App.navigate('taskDetail', { id: res.data.documentId }, false);
    } catch (e) {
      btn.disabled = false; btn.textContent = '✅ สร้างงาน';
      toast('❌ ' + e.message); haptic('error');
    }
  },

  // ════════════════════════════════════════
  // TASK DETAIL
  // ════════════════════════════════════════
  async taskDetail({ id }) {
    setTitle('รายละเอียดงาน');
    setBackBtn(true);
    hideNav();
    setTopAction('');

    const res  = await Api.getTask(id);
    const task = res.data;
    const isOwner = task.current_owner?.id === State.user.id;

    setTitle(task.task_name);
    let html = `<div class="container">`;

    // Status + rejection note
    html += `<div class="card no-click">
      <div class="card-row" style="margin-bottom:8px">
        <span class="card-sub">สถานะ</span>
        ${statusBadge(task.status_task)}
      </div>
      <div class="card-sub">📁 ${task.project?.name || '-'}</div>
      <div class="card-sub">👤 ${task.current_owner?.full_name || task.current_owner?.username || 'ไม่มีเจ้าของ'}</div>
      <div class="card-sub">🕐 ${fmtDate(task.createdAt)}</div>
    </div>`;

    if (task.rejection_note) {
      html += `<div class="alert alert-red">❗ <b>ถูกตีกลับ:</b> ${task.rejection_note}</div>`;
    }

    if (task.status_task === 'Done' && task.final_report) {
      html += `<div class="alert alert-green">✅ <b>รายงานผล:</b><br>${task.final_report}</div>`;
    }

    if (task.status_task === 'Under Review') {
      html += `<div class="alert alert-amber">🟡 งานถูกส่งตรวจแล้ว รอหัวหน้าอนุมัติ</div>`;
    }

    if (task.status_task === 'Waiting for Pickup') {
      html += `<div class="alert alert-blue">
        🟣 งานรอคนรับช่วงต่อ<br>
        <span style="font-size:13px">เหตุผล: ${task.handover_reason || '-'}</span>
      </div>`;
    }

    // Actions
    if (isOwner && task.status_task === 'In Progress') {
      html += `
        <button class="btn btn-primary" onclick="App.navigate('submitTask',{id:'${task.documentId}'})">📷 ส่งงานพร้อมหลักฐาน</button>
        <button class="btn btn-gray"    onclick="App.navigate('handover',{id:'${task.documentId}'})">🔄 ส่งไม้ต่อ</button>`;
    }

    if (task.status_task === 'Waiting for Pickup' && !State.isManager()) {
      const alreadyRequested = task.previous_owner?.id === State.user.id && task.handover_at;
      if (!alreadyRequested && !task.handover_at) {
        html += `<button class="btn btn-primary" onclick="Views._doRequestPickup('${task.documentId}',this)">🙋 ขอรับงานต่อ</button>`;
      } else if (alreadyRequested) {
        html += `<div class="alert alert-amber">⏳ คุณส่งคำขอแล้ว รอหัวหน้าอนุมัติ</div>
          <button class="btn btn-gray" onclick="Views._doCancelPickup('${task.documentId}',this)">ยกเลิกคำขอ</button>`;
      } else {
        html += `<div class="alert alert-gray" style="background:#F3F4F6;border:1px solid var(--border);color:var(--gray)">มีคนอื่นขอรับงานนี้แล้ว</div>`;
      }
    }

    html += '</div>';
    setView(html);
  },

  async _doRequestPickup(id, btn) {
    btn.disabled = true; btn.textContent = 'กำลังส่งคำขอ...';
    try {
      await Api.requestPickup(id);
      haptic('success'); toast('✅ ส่งคำขอแล้ว รอหัวหน้าอนุมัติ');
      App.navigate('taskDetail', { id }, false);
    } catch (e) {
      btn.disabled = false; btn.textContent = '🙋 ขอรับงานต่อ';
      toast('❌ ' + e.message); haptic('error');
    }
  },

  async _doCancelPickup(id, btn) {
    btn.disabled = true; btn.textContent = 'กำลังยกเลิก...';
    try {
      await Api.cancelPickup(id);
      haptic('success'); toast('✅ ยกเลิกคำขอแล้ว');
      App.navigate('taskDetail', { id }, false);
    } catch (e) {
      btn.disabled = false; btn.textContent = 'ยกเลิกคำขอ';
      toast('❌ ' + e.message); haptic('error');
    }
  },

  // ════════════════════════════════════════
  // SUBMIT TASK
  // ════════════════════════════════════════
  async submitTask({ id }) {
    const res  = await Api.getTask(id);
    const task = res.data;
    setTitle('ส่งงาน');
    setBackBtn(true);
    hideNav();

    let photoFile = null;
    let photoUrl  = null;

    setView(`
      <div class="container" style="max-width:480px;margin:0 auto">
        <div class="alert alert-blue">📋 ${task.task_name}</div>

        <div class="form-group">
          <label class="form-label">รูปภาพหลักฐาน *</label>
          <div class="photo-box" id="photo-box" onclick="document.getElementById('file-input').click()">
            <div class="photo-icon">📷</div>
            <span>แตะเพื่อถ่ายรูป / เลือกรูป</span>
          </div>
          <input id="file-input" type="file" accept="image/*" capture="environment" style="display:none"
            onchange="Views._onPhotoSelect(event)" />
          <span id="err-photo" class="form-error"></span>
        </div>

        <div class="form-group">
          <label class="form-label">รายงานผลการทำงาน *</label>
          <textarea id="inp-report" class="form-textarea" placeholder="อธิบายสิ่งที่ทำ เช่น ติดตั้งสายไฟเรียบร้อย ทดสอบแล้วใช้งานได้ปกติ"></textarea>
          <span id="err-report" class="form-error"></span>
          <span class="form-hint">ต้องมีอย่างน้อย 5 ตัวอักษร</span>
        </div>

        <button class="btn btn-primary" id="btn-submit" onclick="Views._doSubmitTask('${task.documentId}')">
          🚀 ส่งงานให้หัวหน้าตรวจ
        </button>
      </div>
    `);

    // เก็บ file ไว้ใน closure
    Views._submitPhotoFile = null;
  },

  _onPhotoSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    Views._submitPhotoFile = file;
    const url = URL.createObjectURL(file);
    document.getElementById('photo-box').innerHTML = `
      <img src="${url}" style="width:100%;height:100%;object-fit:cover;border-radius:10px" />`;
    document.getElementById('err-photo').textContent = '';
  },

  async _doSubmitTask(id) {
    let ok = true;
    const report = document.getElementById('inp-report').value;
    const reportErr = Validate.text(report);
    document.getElementById('err-report').textContent = reportErr || '';
    if (reportErr) ok = false;

    if (!Views._submitPhotoFile) {
      document.getElementById('err-photo').textContent = 'กรุณาแนบรูปภาพหลักฐาน';
      ok = false;
    }
    if (!ok) return;

    const btn = document.getElementById('btn-submit');
    btn.disabled = true; btn.textContent = 'กำลังส่ง...';

    try {
      const fd = new FormData();
      fd.append('reportText', report.trim());
      fd.append('proofImage', Views._submitPhotoFile);
      await Api.submitTask(id, fd);
      haptic('success');
      toast('✅ ส่งงานแล้ว รอหัวหน้าตรวจ');
      App.navigate('staffDashboard', {}, false);
    } catch (e) {
      btn.disabled = false; btn.textContent = '🚀 ส่งงานให้หัวหน้าตรวจ';
      toast('❌ ' + e.message); haptic('error');
    }
  },

  // ════════════════════════════════════════
  // HANDOVER
  // ════════════════════════════════════════
  async handover({ id }) {
    const res  = await Api.getTask(id);
    const task = res.data;
    setTitle('ส่งไม้ต่อ');
    setBackBtn(true);
    hideNav();

    setView(`
      <div class="container" style="max-width:480px;margin:0 auto">
        <div class="alert alert-amber">⚠️ งานจะถูกปล่อยสู่ตลาดรับงาน และรอคนอื่นรับช่วงต่อ</div>
        <div class="card no-click">
          <div class="card-title">${task.task_name}</div>
          <div class="card-sub">📁 ${task.project?.name || '-'}</div>
        </div>
        <div class="form-group">
          <label class="form-label">เหตุผลที่ส่งไม้ต่อ *</label>
          <textarea id="inp-reason" class="form-textarea" placeholder="เช่น หมดกะแล้ว ยังทำไม่เสร็จ อีกประมาณ 2 ชั่วโมงจะเสร็จ"></textarea>
          <span id="err-reason" class="form-error"></span>
          <span class="form-hint">ต้องมีอย่างน้อย 5 ตัวอักษร</span>
        </div>
        <button class="btn btn-red" id="btn-handover" onclick="Views._doHandover('${task.documentId}')">
          🔄 ยืนยันส่งไม้ต่อ
        </button>
        <button class="btn btn-gray" onclick="App.back()">ยกเลิก</button>
      </div>
    `);
  },

  async _doHandover(id) {
    const reason = document.getElementById('inp-reason').value;
    const err = Validate.text(reason);
    document.getElementById('err-reason').textContent = err || '';
    if (err) return;

    const btn = document.getElementById('btn-handover');
    btn.disabled = true; btn.textContent = 'กำลังส่ง...';
    try {
      await Api.handoverTask(id, reason.trim());
      haptic('success'); toast('✅ ส่งไม้ต่อแล้ว');
      App.navigate('staffDashboard', {}, false);
    } catch (e) {
      btn.disabled = false; btn.textContent = '🔄 ยืนยันส่งไม้ต่อ';
      toast('❌ ' + e.message); haptic('error');
    }
  },

  // ════════════════════════════════════════
  // MARKETPLACE
  // ════════════════════════════════════════
  async marketplace() {
    setTitle('ตลาดรับงาน');
    setBackBtn(false);
    renderNav('Staff', 'marketplace');

    const res   = await Api.getTasks(`&filters[status_task][$eq]=Waiting for Pickup`);
    const tasks = res.data || [];

    let html = '<div class="container">';
    if (!tasks.length) {
      html += empty('🏪', 'ไม่มีงานรอรับช่วงในขณะนี้');
    } else {
      html += `<div class="alert alert-blue">🏪 ${tasks.length} งานรอคนรับช่วงต่อ</div>`;
      tasks.forEach(t => {
        const isMine = t.previous_owner?.id === State.user.id && t.handover_at;
        const hasRequester = !!t.handover_at;
        html += `
          <div class="card" onclick="App.navigate('taskDetail',{id:'${t.documentId}'})">
            <div class="card-row">
              <span class="card-title">${t.task_name}</span>
              ${isMine ? '<span class="badge badge-amber">รออนุมัติ</span>' : hasRequester ? '<span class="badge badge-gray">มีคนจอง</span>' : '<span class="badge badge-purple">ว่าง</span>'}
            </div>
            <div class="card-sub" style="margin-top:4px">📁 ${t.project?.name || '-'}</div>
            ${t.handover_reason ? `<div class="card-sub">💬 ${t.handover_reason}</div>` : ''}
            ${!hasRequester ? `<button class="btn btn-primary btn-sm" style="margin-top:10px"
              onclick="event.stopPropagation();Views._doRequestPickup('${t.documentId}',this)">
              🙋 ขอรับงานนี้
            </button>` : ''}
          </div>`;
      });
    }
    html += '</div>';
    setView(html);
  },

  // ════════════════════════════════════════
  // MANAGER DASHBOARD
  // ════════════════════════════════════════
  async managerDashboard() {
    setTitle('ภาพรวม');
    setBackBtn(false);
    renderNav('Manager', 'dashboard');

    const res   = await Api.getTasks();
    const tasks = res.data || [];

    const counts = {
      'In Progress':        tasks.filter(t => t.status_task === 'In Progress').length,
      'Under Review':       tasks.filter(t => t.status_task === 'Under Review').length,
      'Waiting for Pickup': tasks.filter(t => t.status_task === 'Waiting for Pickup').length,
      'Done':               tasks.filter(t => t.status_task === 'Done').length,
    };

    const urgent = tasks.filter(t => t.status_task === 'Under Review');

    let html = `<div class="container">
      <div class="stat-grid">
        <div class="stat-card"><div class="stat-num" style="color:var(--blue)">${counts['In Progress']}</div><div class="stat-lbl">กำลังดำเนินการ</div></div>
        <div class="stat-card"><div class="stat-num" style="color:var(--amber)">${counts['Under Review']}</div><div class="stat-lbl">รอตรวจ</div></div>
        <div class="stat-card"><div class="stat-num" style="color:var(--purple)">${counts['Waiting for Pickup']}</div><div class="stat-lbl">รอคนรับช่วง</div></div>
        <div class="stat-card"><div class="stat-num" style="color:var(--green)">${counts['Done']}</div><div class="stat-lbl">เสร็จแล้ว</div></div>
      </div>`;

    if (urgent.length) {
      html += `<div class="section-label">🔴 รอการตรวจ (${urgent.length})</div>`;
      urgent.forEach(t => {
        html += `<div class="card" onclick="App.navigate('managerReviewTask',{id:'${t.documentId}'})">
          <div class="card-row">
            <span class="card-title">${t.task_name}</span>
            ${statusBadge(t.status_task)}
          </div>
          <div class="card-sub" style="margin-top:4px">
            👤 ${t.current_owner?.full_name || '-'} · 📁 ${t.project?.name || '-'}
          </div>
        </div>`;
      });
    } else {
      html += `<div class="alert alert-green" style="margin-top:8px">✅ ไม่มีงานรอตรวจ</div>`;
    }

    html += `<button class="btn btn-gray" onclick="App.navTo('approvals')">ดูทั้งหมดที่รออนุมัติ →</button>`;
    html += '</div>';
    setView(html);
  },

  // ════════════════════════════════════════
  // MANAGER REVIEW TASK
  // ════════════════════════════════════════
  async managerReviewTask({ id }) {
    setTitle('ตรวจงาน');
    setBackBtn(true);
    hideNav();

    const res  = await Api.getTask(id);
    const task = res.data;
    setTitle(task.task_name);

    let signedUrl = null;
    if (task.task_image_url) {
      try {
        const urlRes = await Api.getSignedUrl(id);
        signedUrl = urlRes.signedUrl;
      } catch (_) {}
    }

    setView(`
      <div class="container" style="max-width:480px;margin:0 auto">
        <div class="card no-click">
          <div class="card-sub">👤 ${task.current_owner?.full_name || task.current_owner?.username || '-'}</div>
          <div class="card-sub">📁 ${task.project?.name || '-'}</div>
          <div class="card-sub">🕐 ${fmtDate(task.updatedAt)}</div>
        </div>

        ${signedUrl
          ? `<div><img src="${signedUrl}" style="width:100%;border-radius:var(--radius);border:1px solid var(--border)" /></div>`
          : task.task_image_url ? '<div class="alert alert-amber">⚠️ ไม่สามารถโหลดรูปได้ในขณะนี้</div>' : '<div class="alert alert-gray" style="background:#F3F4F6;border:1px solid var(--border);color:var(--gray)">ไม่มีรูปภาพ</div>'
        }

        ${task.final_report
          ? `<div class="alert alert-blue"><b>รายงานผล:</b><br>${task.final_report}</div>` : ''}

        <button class="btn btn-green" id="btn-approve" onclick="Views._doApproveTask('${task.documentId}')">
          ✅ อนุมัติปิดงาน
        </button>

        <div class="form-group" style="margin-top:4px">
          <label class="form-label">เหตุผลตีกลับ (ถ้าไม่ผ่าน)</label>
          <textarea id="inp-reject" class="form-textarea" style="min-height:80px" placeholder="เช่น รูปภาพไม่ชัด กรุณาถ่ายใหม่"></textarea>
          <span id="err-reject" class="form-error"></span>
        </div>
        <button class="btn btn-red" id="btn-reject" onclick="Views._doRejectTask('${task.documentId}')">
          ❌ ตีกลับงาน
        </button>
      </div>
    `);
  },

  async _doApproveTask(id) {
    const btn = document.getElementById('btn-approve');
    btn.disabled = true; btn.textContent = 'กำลังอนุมัติ...';
    try {
      await Api.approveTask(id);
      haptic('success'); toast('✅ อนุมัติปิดงานแล้ว');
      App.navigate('managerDashboard', {}, false);
    } catch (e) {
      btn.disabled = false; btn.textContent = '✅ อนุมัติปิดงาน';
      toast('❌ ' + e.message); haptic('error');
    }
  },

  async _doRejectTask(id) {
    const reason = document.getElementById('inp-reject').value;
    const err = Validate.text(reason);
    document.getElementById('err-reject').textContent = err || '';
    if (err) return;

    const btn = document.getElementById('btn-reject');
    btn.disabled = true; btn.textContent = 'กำลังส่งกลับ...';
    try {
      await Api.rejectTask(id, reason.trim());
      haptic('success'); toast('📨 ส่งกลับให้แก้ไขแล้ว');
      App.navigate('managerDashboard', {}, false);
    } catch (e) {
      btn.disabled = false; btn.textContent = '❌ ตีกลับงาน';
      toast('❌ ' + e.message); haptic('error');
    }
  },

  // ════════════════════════════════════════
  // MANAGER APPROVALS
  // ════════════════════════════════════════
  async managerApprovals() {
    setTitle('รออนุมัติ');
    setBackBtn(false);
    renderNav('Manager', 'approvals');

    const [taskRes, memRes, userRes] = await Promise.all([
      Api.getTasks(),
      Api.getMemberships('&filters[membershipStatus][$eq]=Requested'),
      Api.getUsers('account_status=Pending'),
    ]);

    const allTasks   = taskRes.data || [];
    const underReview = allTasks.filter(t => t.status_task === 'Under Review');
    const waitingPickup = allTasks.filter(t => t.status_task === 'Waiting for Pickup' && t.handover_at);
    const pendingMems = memRes.data || [];
    const pendingUsers = userRes || [];

    // Tab state
    if (!Views._approvalsTab) Views._approvalsTab = 'tasks';
    const tab = Views._approvalsTab;

    const total = underReview.length + waitingPickup.length + pendingMems.length + pendingUsers.length;

    let html = `<div class="container">
      <div class="tabs">
        <button class="tab-btn ${tab==='tasks'?'active':''}" onclick="Views._approvalsTab='tasks';Views.managerApprovals()">
          งาน ${underReview.length ? `(${underReview.length})` : ''}
        </button>
        <button class="tab-btn ${tab==='pickup'?'active':''}" onclick="Views._approvalsTab='pickup';Views.managerApprovals()">
          รับงาน ${waitingPickup.length ? `(${waitingPickup.length})` : ''}
        </button>
        <button class="tab-btn ${tab==='members'?'active':''}" onclick="Views._approvalsTab='members';Views.managerApprovals()">
          บัญชี ${(pendingMems.length + pendingUsers.length) ? `(${pendingMems.length + pendingUsers.length})` : ''}
        </button>
      </div>`;

    if (tab === 'tasks') {
      if (!underReview.length) {
        html += empty('✅', 'ไม่มีงานรอตรวจ');
      } else {
        underReview.forEach(t => {
          html += `<div class="card" onclick="App.navigate('managerReviewTask',{id:'${t.documentId}'})">
            <div class="card-row">
              <span class="card-title">${t.task_name}</span>
              ${statusBadge(t.status_task)}
            </div>
            <div class="card-sub" style="margin-top:4px">👤 ${t.current_owner?.full_name || '-'} · 📁 ${t.project?.name || '-'}</div>
          </div>`;
        });
      }
    }

    if (tab === 'pickup') {
      if (!waitingPickup.length) {
        html += empty('🔄', 'ไม่มีคำขอรับงาน');
      } else {
        waitingPickup.forEach(t => {
          html += `<div class="card no-click">
            <div class="card-title">${t.task_name}</div>
            <div class="card-sub">📁 ${t.project?.name || '-'}</div>
            <div class="card-sub">🙋 ${t.previous_owner?.full_name || t.previous_owner?.username || '-'} ขอรับงาน</div>
            <div style="display:flex;gap:8px;margin-top:10px">
              <button class="btn btn-green btn-sm" style="flex:1"
                onclick="Views._doApprovePickup('${t.documentId}',this)">✅ อนุมัติ</button>
              <button class="btn btn-red btn-sm" style="flex:1"
                onclick="Views._doCancelPickup2('${t.documentId}',this)">❌ ปฏิเสธ</button>
            </div>
          </div>`;
        });
      }
    }

    if (tab === 'members') {
      if (!pendingMems.length && !pendingUsers.length) {
        html += empty('👥', 'ไม่มีคำขอรออนุมัติ');
      } else {
        if (pendingUsers.length) {
          html += `<div class="section-label">บัญชีใหม่รออนุมัติ</div>`;
          pendingUsers.forEach(u => {
            html += `<div class="card no-click">
              <div class="card-row">
                <div>
                  <div class="card-title">${u.full_name || u.username}</div>
                  <div class="card-sub">@${u.username} · ID: ${u.telegram_id || '-'}</div>
                </div>
                <button class="btn btn-green btn-sm"
                  onclick="Views._doApproveUser(${u.id},this)">✅ อนุมัติ</button>
              </div>
            </div>`;
          });
        }
        if (pendingMems.length) {
          html += `<div class="section-label">คำขอเข้าร่วมโปรเจกต์</div>`;
          pendingMems.forEach(m => {
            html += `<div class="card no-click">
              <div class="card-row">
                <div>
                  <div class="card-title">${m.member?.full_name || m.member?.username || '-'}</div>
                  <div class="card-sub">📁 ${m.project?.name || '-'}</div>
                </div>
                <button class="btn btn-green btn-sm"
                  onclick="Views._doApproveMembership('${m.documentId}',this)">✅ อนุมัติ</button>
              </div>
            </div>`;
          });
        }
      }
    }

    html += '</div>';
    setView(html);
  },

  async _doApprovePickup(id, btn) {
    btn.disabled = true; btn.textContent = '...';
    try {
      await Api.approvePickup(id);
      haptic('success'); toast('✅ อนุมัติรับงานแล้ว');
      Views.managerApprovals();
    } catch (e) { btn.disabled = false; btn.textContent = '✅ อนุมัติ'; toast('❌ ' + e.message); haptic('error'); }
  },

  async _doCancelPickup2(id, btn) {
    btn.disabled = true; btn.textContent = '...';
    try {
      await Api.cancelPickup(id);
      haptic('success'); toast('✅ ปฏิเสธแล้ว');
      Views.managerApprovals();
    } catch (e) { btn.disabled = false; btn.textContent = '❌ ปฏิเสธ'; toast('❌ ' + e.message); haptic('error'); }
  },

  async _doApproveUser(userId, btn) {
    btn.disabled = true; btn.textContent = '...';
    try {
      await Api.approveUser(userId);
      haptic('success'); toast('✅ อนุมัติบัญชีแล้ว');
      Views.managerApprovals();
    } catch (e) { btn.disabled = false; btn.textContent = '✅ อนุมัติ'; toast('❌ ' + e.message); haptic('error'); }
  },

  async _doApproveMembership(id, btn) {
    btn.disabled = true; btn.textContent = '...';
    try {
      await Api.approveMembership(id);
      haptic('success'); toast('✅ อนุมัติเข้าร่วมแล้ว');
      Views.managerApprovals();
    } catch (e) { btn.disabled = false; btn.textContent = '✅ อนุมัติ'; toast('❌ ' + e.message); haptic('error'); }
  },

  // ════════════════════════════════════════
  // CREATE PROJECT (Manager)
  // ════════════════════════════════════════
  createProject() {
    setTitle('สร้างโปรเจกต์');
    setBackBtn(true);
    hideNav();
    setTopAction('');

    const today = new Date().toISOString().split('T')[0];

    setView(`
      <div class="container" style="max-width:480px;margin:0 auto">
        <div class="form-group">
          <label class="form-label">ชื่อโปรเจกต์ *</label>
          <input id="inp-projname" class="form-input" type="text" placeholder="เช่น ปรับปรุงห้องน้ำชั้น 3" />
          <span id="err-projname" class="form-error"></span>
        </div>
        <div class="form-group">
          <label class="form-label">เดดไลน์</label>
          <input id="inp-deadline" class="form-input" type="datetime-local" min="${today}T00:00" />
          <span class="form-hint">ไม่บังคับ</span>
        </div>
        <button class="btn btn-primary" id="btn-proj" onclick="Views._doCreateProject()">
          ✅ สร้างโปรเจกต์
        </button>
      </div>
    `);
  },

  async _doCreateProject() {
    const name = document.getElementById('inp-projname').value;
    const err  = Validate.text(name);
    document.getElementById('err-projname').textContent = err || '';
    if (err) return;

    const deadlineVal = document.getElementById('inp-deadline').value;
    const deadline    = deadlineVal ? new Date(deadlineVal).toISOString() : null;

    const btn = document.getElementById('btn-proj');
    btn.disabled = true; btn.textContent = 'กำลังสร้าง...';
    try {
      const res = await Api.createProject({ name: name.trim(), deadline });
      haptic('success'); toast('✅ สร้างโปรเจกต์แล้ว');
      App.navigate('projectDetail', { id: res.data.documentId }, false);
    } catch (e) {
      btn.disabled = false; btn.textContent = '✅ สร้างโปรเจกต์';
      toast('❌ ' + e.message); haptic('error');
    }
  },
};

// ── 8. BOOT ──────────────────────────────────────────────────
App.init();