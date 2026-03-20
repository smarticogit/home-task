/* =====================
   PALETA DE CORES
   ===================== */
const COLOR_OPTIONS = [
  { color: '#185FA5', light: '#E6F1FB', dark: '#0C447C' },
  { color: '#993556', light: '#FBEAF0', dark: '#72243E' },
  { color: '#0F6E56', light: '#E1F5EE', dark: '#085041' },
  { color: '#7F77DD', light: '#EEEDFE', dark: '#3C3489' },
  { color: '#D85A30', light: '#FAECE7', dark: '#712B13' },
  { color: '#BA7517', light: '#FAEEDA', dark: '#633806' },
  { color: '#639922', light: '#EAF3DE', dark: '#27500A' },
  { color: '#E24B4A', light: '#FCEBEB', dark: '#791F1F' },
  { color: '#5F5E5A', light: '#F1EFE8', dark: '#2C2C2A' },
  { color: '#378ADD', light: '#E6F1FB', dark: '#0C447C' },
  { color: '#D4537E', light: '#FBEAF0', dark: '#4B1528' },
  { color: '#1D9E75', light: '#E1F5EE', dark: '#04342C' },
];

/* =====================
   STORAGE KEYS
   ===================== */
const SK_TASKS     = 'tarefas_casa_tasks';
const SK_SCHEDULED = 'tarefas_casa_scheduled';
const SK_PEOPLE    = 'tarefas_casa_people';

/* =====================
   DADOS PADRÃO
   ===================== */
const DEFAULT_TASKS = [
  { id: 'lavar-louca',    name: 'Lavar Louça',     mins: 20,  desc: '' },
  { id: 'almoco',         name: 'Almoço',           mins: 45,  desc: '' },
  { id: 'janta',          name: 'Janta',            mins: 45,  desc: '' },
  { id: 'lavar-roupa',    name: 'Lavar Roupa',      mins: 10,  desc: '' },
  { id: 'estender-roupa', name: 'Estender Roupa',   mins: 20,  desc: '' },
  { id: 'guardar-roupa',  name: 'Guardar Roupa',    mins: 30,  desc: '' },
  { id: 'levar-ana',      name: 'Levar Ana',        mins: 30,  desc: '' },
  { id: 'buscar-ana',     name: 'Buscar Ana',       mins: 30,  desc: '' },
  { id: 'fazer-compras',  name: 'Fazer Compras',    mins: 90,  desc: '' },
  { id: 'fazer-feira',    name: 'Fazer Feira',      mins: 120, desc: '' },
  { id: 'cabelo-ana',     name: 'Cabelo da Ana',    mins: 120, desc: '' },
  { id: 'jogar-lixo',     name: 'Jogar Lixo',       mins: 10,  desc: '' },
  { id: 'buscar-pao',     name: 'Buscar pão',       mins: 10,  desc: '' },
  { id: 'limpar-casa',    name: 'Limpar Casa',      mins: 30,  desc: '' },
];

/* =====================
   CONSTANTES DE CALENDÁRIO
   ===================== */
const HS    = 8;
const HE    = 24;
const SPX   = 30;
const PPM   = SPX / 30;
const COL_H = (HE - HS) * 2 * SPX;
const TIME_COL_W = 36;
const DAYS_LBL = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

/* =====================
   ESTADO
   ===================== */
let TASKS     = load(SK_TASKS,     DEFAULT_TASKS);
let PEOPLE    = load(SK_PEOPLE,    []);
let scheduled = load(SK_SCHEDULED, {});

let dragging        = null;
let previews        = [];
let currentBlockKey = null;
let currentTaskId   = null;
let currentPersonId = null;
let detailTaskId    = null;
let selectedColor   = COLOR_OPTIONS[0];

/* =====================
   PERSISTÊNCIA
   ===================== */
function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : JSON.parse(JSON.stringify(fallback));
  } catch { return JSON.parse(JSON.stringify(fallback)); }
}

function save() {
  try {
    localStorage.setItem(SK_TASKS,     JSON.stringify(TASKS));
    localStorage.setItem(SK_PEOPLE,    JSON.stringify(PEOPLE));
    localStorage.setItem(SK_SCHEDULED, JSON.stringify(scheduled));
  } catch { showToast('Erro ao salvar'); }
}

function clearWeek() {
  if (!confirm('Limpar todos os agendamentos desta semana?')) return;
  scheduled = {};
  save();
  renderAll();
  showToast('Semana limpa!');
}

/* =====================
   TOAST
   ===================== */
let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

/* =====================
   HELPERS
   ===================== */
function uid()           { return Math.random().toString(36).slice(2, 8); }
function personById(id)  { return PEOPLE.find(p => p.id === id); }
function taskById(id)    { return TASKS.find(t => t.id === id); }
function snap30(m)       { return Math.round(m / 30) * 30; }
function heightPx(mins)  { return Math.ceil(mins / 30) * SPX; }

function totalMins(pid) {
  return Object.values(scheduled).reduce((a, s) => {
    if (s.personId !== pid) return a;
    const t = taskById(s.taskId);
    return a + (t ? t.mins : 0);
  }, 0);
}

function taskCount(pid) {
  return Object.values(scheduled).filter(s => s.personId === pid).length;
}

function timeStr(sm) {
  const h = HS + Math.floor(sm / 60);
  const m = sm % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

function colorByValue(colorVal) {
  return COLOR_OPTIONS.find(c => c.color === colorVal) || COLOR_OPTIONS[0];
}

/* Calcula posição Y relativa ao topo absoluto do elemento,
   independente de scroll de página ou de container interno */
function getRelY(e, el) {
  let top = 0;
  let node = el;
  while (node) {
    top += node.offsetTop;
    node = node.offsetParent;
  }
  return e.pageY - top;
}

/* =====================
   MODAL DE CONFIRMAÇÃO
   ===================== */
let confirmCallback = null;

function showConfirm(title, msg, onOk) {
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-msg').textContent = msg;
  confirmCallback = onOk;
  document.getElementById('modal-confirm-bg').style.display = 'flex';
}

function confirmOk() {
  document.getElementById('modal-confirm-bg').style.display = 'none';
  if (confirmCallback) confirmCallback();
  confirmCallback = null;
}

function confirmCancel() {
  document.getElementById('modal-confirm-bg').style.display = 'none';
  confirmCallback = null;
}

/* =====================
   CALENDÁRIO
   ===================== */
function renderTimeCol() {
  const col = document.getElementById('time-col');
  col.innerHTML = '';
  for (let h = HS; h < HE; h++) {
    const a = document.createElement('div');
    a.className = 'cal-time-label';
    a.textContent = `${String(h).padStart(2,'0')}:00`;
    col.appendChild(a);
    const b = document.createElement('div');
    b.className = 'cal-time-label half';
    b.textContent = 'x';
    col.appendChild(b);
  }
}

function renderDayCols() {
  const wrap = document.getElementById('day-cols');
  wrap.innerHTML = '';
  previews = [];

  for (let d = 0; d < 7; d++) {
    const col = document.createElement('div');
    col.className = 'cal-day-col';
    col.style.cssText = `position:relative;height:${COL_H}px`;

    for (let h = 0; h < (HE - HS); h++) {
      const fl = document.createElement('div');
      fl.className = 'half-line';
      fl.style.top = (h * 2 * SPX) + 'px';
      col.appendChild(fl);
      const hl = document.createElement('div');
      hl.className = 'half-line mid';
      hl.style.top = (h * 2 * SPX + SPX) + 'px';
      col.appendChild(hl);
    }

    const prev = document.createElement('div');
    prev.className = 'slot-preview';
    col.appendChild(prev);
    previews.push(prev);

    col.addEventListener('dragover', e => {
      e.preventDefault();
      if (!dragging) return;
      const t = taskById(dragging.taskId);
      if (!t) return;
      const relY = getRelY(e, col);
      const sm = Math.max(0, snap30(relY / PPM));
      prev.style.display = 'block';
      prev.style.top = sm * PPM + 'px';
      prev.style.height = heightPx(t.mins) + 'px';
      previews.forEach((p, i) => { if (i !== d) p.style.display = 'none'; });
    });

    col.addEventListener('dragleave', e => {
      if (!col.contains(e.relatedTarget)) prev.style.display = 'none';
    });

    col.addEventListener('drop', e => {
      e.preventDefault();
      prev.style.display = 'none';
      if (!dragging) return;
      const relY = getRelY(e, col);
      const sm = Math.max(0, snap30(relY / PPM));
      if (HS + Math.floor(sm / 60) >= HE) return;
      if (isOccupied(d, sm, dragging.taskId, dragging.existingKey)) return;
      const wasNew = !dragging.existingKey;
      const savedPerson = dragging.personId || '';
      if (dragging.existingKey) delete scheduled[dragging.existingKey];
      const key = uid();
      scheduled[key] = { taskId: dragging.taskId, personId: savedPerson, day: d, snappedMins: sm };
      dragging = null;
      save();
      renderAll();
      if (wasNew) openMB(key);
    });

    wrap.appendChild(col);
  }

  Object.entries(scheduled).forEach(([key, s]) => {
    const t = taskById(s.taskId);
    if (!t) return;
    const p = personById(s.personId);
    const col = wrap.children[s.day];
    if (!col) return;
    const hPx = heightPx(t.mins);
    const palette = p ? colorByValue(p.color) : null;

    const block = document.createElement('div');
    block.className = 'task-block';
    block.draggable = true;
    block.style.top = s.snappedMins * PPM + 'px';
    block.style.height = hPx + 'px';
    block.style.background = palette ? palette.light : '#f0f0ee';
    block.style.borderLeft = `3px solid ${palette ? palette.color : '#ccc'}`;
    const dc = palette ? palette.dark : '#333';

    block.innerHTML =
      `<div class="task-block-name" style="color:${dc}">${t.name}</div>` +
      (hPx >= 22 && p ? `<div class="task-block-person" style="color:${dc}">${p.name}</div>` : '') +
      (hPx >= 36 ? `<div class="task-block-dur" style="color:${dc}">${t.mins}min</div>` : '');

    block.addEventListener('dragstart', e => {
      dragging = { taskId: s.taskId, personId: s.personId, existingKey: key };
      block.classList.add('is-dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    block.addEventListener('dragend', () => {
      block.classList.remove('is-dragging');
      previews.forEach(p => p.style.display = 'none');
    });
    let dragMoved = false;
    block.addEventListener('mousedown', () => dragMoved = false);
    block.addEventListener('mousemove', () => dragMoved = true);
    block.addEventListener('click', () => { if (!dragMoved) openMB(key); });

    col.appendChild(block);
  });
}

function isOccupied(day, start, taskId, excl) {
  const t = taskById(taskId);
  if (!t) return false;
  const end = start + t.mins;
  return Object.entries(scheduled).some(([k, s]) => {
    if (k === excl || s.day !== day) return false;
    const st = taskById(s.taskId);
    if (!st) return false;
    return start < s.snappedMins + st.mins && end > s.snappedMins;
  });
}

/* =====================
   POOL DE TAREFAS
   ===================== */
function renderPool() {
  const wrap = document.getElementById('pool-tasks');
  wrap.innerHTML = '';

  if (TASKS.length === 0) {
    wrap.innerHTML = '<span style="font-size:13px;color:#bbb">Nenhuma tarefa cadastrada. Vá em "Tarefas" para adicionar.</span>';
    return;
  }

  TASKS.forEach(t => {
    const chip = document.createElement('div');
    chip.className = 'task-chip';
    chip.draggable = true;
    chip.innerHTML = `<span>${t.name}</span><span class="chip-dur">${t.mins}min</span>`;
    chip.addEventListener('dblclick', e => { e.preventDefault(); openDetail(t.id); });
    chip.addEventListener('dragstart', e => {
      dragging = { taskId: t.id };
      chip.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'copy';
    });
    chip.addEventListener('dragend', () => {
      chip.classList.remove('dragging');
      previews.forEach(p => p.style.display = 'none');
    });
    wrap.appendChild(chip);
  });
}

/* =====================
   SUMMARY + PESSOAS (calendário)
   ===================== */
function renderSummary() {
  const total = Object.keys(scheduled).length;
  const unassigned = Object.values(scheduled).filter(s => !s.personId).length;
  let html = `<span class="summary-item"><span class="summary-num">${total}</span>tarefa${total !== 1 ? 's' : ''} agendada${total !== 1 ? 's' : ''}</span>`;
  if (unassigned > 0) {
    html += `<span class="summary-item" style="color:#b8860b"><span class="summary-num" style="color:#b8860b">${unassigned}</span>sem responsável</span>`;
  }
  PEOPLE.forEach(p => {
    const c = taskCount(p.id);
    const pal = colorByValue(p.color);
    html += `<span class="summary-item"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${pal.color};margin-right:5px;vertical-align:middle"></span><span class="summary-num">${c}</span>${p.name}</span>`;
  });
  document.getElementById('summary-bar').innerHTML = html;
}

function renderPeopleRow() {
  const row = document.getElementById('people-row');
  row.innerHTML = '';

  if (PEOPLE.length === 0) {
    row.innerHTML = '<p style="font-size:13px;color:#bbb">Nenhuma pessoa cadastrada ainda. Vá em "Pessoas" para adicionar.</p>';
    return;
  }

  const totals = PEOPLE.map(p => ({ p, m: totalMins(p.id), c: taskCount(p.id) }));
  const maxM = Math.max(...totals.map(x => x.m), 1);

  totals.forEach(({ p, m, c }) => {
    const h = Math.floor(m / 60);
    const min = m % 60;
    const pct = Math.round(m / maxM * 100);
    const pal = colorByValue(p.color);
    const card = document.createElement('div');
    card.className = 'person-card';
    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:7px">
        <div style="width:26px;height:26px;border-radius:50%;background:${pal.light};color:${pal.dark};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700">${p.name[0].toUpperCase()}</div>
        <span style="font-size:13px;font-weight:600">${p.name}</span>
      </div>
      <div style="display:flex;gap:6px;margin-bottom:7px">
        <span class="count-badge" style="background:${pal.light};color:${pal.dark}">${c} tarefa${c !== 1 ? 's' : ''}</span>
        <span class="count-badge" style="background:#f0f0ee;color:#666">${h > 0 ? h + 'h ' : ''}${min > 0 ? min + 'min' : h === 0 ? '0min' : ''}</span>
      </div>
      <div class="bar-bg"><div class="bar-fg" style="width:${pct}%;background:${pal.color}"></div></div>`;
    row.appendChild(card);
  });
}

/* =====================
   PÁGINA: TAREFAS
   ===================== */
function renderTaskCards() {
  const grid = document.getElementById('task-cards-grid');
  grid.innerHTML = '';

  if (TASKS.length === 0) {
    grid.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div>Nenhuma tarefa ainda.<br>Clique em "+ Nova tarefa" para começar.</div>';
  }

  TASKS.forEach(t => {
    const count = Object.values(scheduled).filter(s => s.taskId === t.id).length;
    const durPct = Math.min(t.mins / 120 * 100, 100).toFixed(0);
    const card = document.createElement('div');
    card.className = 'task-card';
    card.innerHTML = `
      <div class="task-card-name">${t.name}</div>
      <div class="task-card-meta">${t.mins} min · agendada ${count}x esta semana</div>
      <div style="height:3px;border-radius:2px;background:#f0f0ee">
        <div style="width:${durPct}%;height:3px;border-radius:2px;background:#ccc"></div>
      </div>
      ${t.desc ? `<div class="task-card-desc">${t.desc}</div>` : ''}
      <div class="task-card-actions">
        <button class="btn-sm" onclick="openMT('${t.id}')">Editar</button>
        <button class="btn-sm danger" onclick="confirmDeleteTask('${t.id}')">Excluir</button>
      </div>`;
    grid.appendChild(card);
  });

  const addCard = document.createElement('div');
  addCard.className = 'task-card add-card';
  addCard.innerHTML = '<span style="font-size:24px;opacity:.3">+</span><span>Nova tarefa</span>';
  addCard.onclick = openMN;
  grid.appendChild(addCard);
}

function confirmDeleteTask(taskId) {
  const t = taskById(taskId);
  if (!t) return;
  showConfirm(
    `Excluir "${t.name}"?`,
    'Ela será removida do calendário também.',
    () => {
      TASKS = TASKS.filter(x => x.id !== taskId);
      Object.keys(scheduled).forEach(k => { if (scheduled[k].taskId === taskId) delete scheduled[k]; });
      save(); renderAll(); showToast('Tarefa excluída');
    }
  );
}

/* =====================
   PÁGINA: PESSOAS
   ===================== */
function renderPeopleCards() {
  const grid = document.getElementById('people-cards-grid');
  grid.innerHTML = '';

  if (PEOPLE.length === 0) {
    grid.innerHTML = '<div class="empty-state"><div class="empty-icon">👤</div>Nenhuma pessoa cadastrada ainda.<br>Clique em "+ Nova pessoa" para começar.</div>';
  }

  PEOPLE.forEach(p => {
    const pal = colorByValue(p.color);
    const c = taskCount(p.id);
    const m = totalMins(p.id);
    const h = Math.floor(m / 60);
    const min = m % 60;

    const card = document.createElement('div');
    card.className = 'people-page-card';
    card.innerHTML = `
      <div class="people-page-card-header">
        <div class="avatar-lg" style="background:${pal.light};color:${pal.dark}">${p.name[0].toUpperCase()}</div>
        <div>
          <div class="people-page-card-name">${p.name}</div>
          <div class="people-page-card-meta">
            ${c} tarefa${c !== 1 ? 's' : ''} agendada${c !== 1 ? 's' : ''} ·
            ${h > 0 ? h + 'h ' : ''}${min > 0 ? min + 'min' : h === 0 ? '0min' : ''} esta semana
          </div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${pal.color}"></span>
        <span style="font-size:12px;color:#888">${pal.color}</span>
      </div>
      <div style="display:flex;gap:6px">
        <button class="btn-sm" onclick="openEditPerson('${p.id}')">Editar</button>
        <button class="btn-sm danger" onclick="confirmDeletePerson('${p.id}')">Excluir</button>
      </div>`;
    grid.appendChild(card);
  });

  const addCard = document.createElement('div');
  addCard.className = 'people-page-card add-card';
  addCard.innerHTML = '<span style="font-size:24px;opacity:.3">+</span><span>Nova pessoa</span>';
  addCard.onclick = openMP;
  grid.appendChild(addCard);
}

function confirmDeletePerson(personId) {
  const p = personById(personId);
  if (!p) return;
  showConfirm(
    `Excluir "${p.name}"?`,
    'As tarefas atribuídas a ela ficarão sem responsável.',
    () => {
      PEOPLE = PEOPLE.filter(x => x.id !== personId);
      Object.keys(scheduled).forEach(k => {
        if (scheduled[k].personId === personId) scheduled[k].personId = '';
      });
      save(); renderAll(); showToast(`${p.name} removido(a)`);
    }
  );
}

/* =====================
   MODAL: DETALHES (duplo clique)
   ===================== */
function openDetail(taskId) {
  detailTaskId = taskId;
  const t = taskById(taskId);
  if (!t) return;
  document.getElementById('dt-title').textContent = t.name;

  const inSched = Object.values(scheduled).filter(s => s.taskId === taskId);
  let body = `<div style="margin-bottom:10px">
    <span class="detail-pill">${t.mins} minutos</span>
    <span class="detail-pill">${inSched.length}x agendada</span>
  </div>`;

  if (t.desc) {
    body += `<div class="detail-desc">${t.desc}</div>`;
  }

  if (inSched.length) {
    body += '<div style="font-size:11px;font-weight:600;color:#999;margin-top:14px;margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">Agendamentos esta semana</div>';
    inSched.sort((a, b) => a.day - b.day || a.snappedMins - b.snappedMins).forEach(s => {
      const p = personById(s.personId);
      const pal = p ? colorByValue(p.color) : null;
      body += `<div class="detail-row">
        <span style="color:#555">${DAYS_LBL[s.day]} às ${timeStr(s.snappedMins)}</span>
        <span style="color:${pal ? pal.color : '#bbb'};font-weight:500">${p ? p.name : 'Sem responsável'}</span>
      </div>`;
    });
  } else {
    body += '<p style="font-size:13px;color:#aaa;margin-top:10px">Ainda não agendada esta semana.</p>';
  }

  document.getElementById('dt-body').innerHTML = body;
  document.getElementById('modal-detail-bg').style.display = 'flex';
}

function closeDetail() { document.getElementById('modal-detail-bg').style.display = 'none'; }
function openEditFromDetail() { closeDetail(); if (detailTaskId) openMT(detailTaskId); }

/* =====================
   MODAL: BLOCO CALENDÁRIO
   ===================== */
function openMB(key) {
  currentBlockKey = key;
  const s = scheduled[key];
  const t = taskById(s.taskId);
  document.getElementById('mb-title').textContent = t ? t.name : 'Tarefa';

  const sel = document.getElementById('mb-person');
  sel.innerHTML = '<option value="">— Sem responsável —</option>';
  PEOPLE.forEach(p => {
    const o = document.createElement('option');
    o.value = p.id;
    o.textContent = p.name;
    if (s.personId === p.id) o.selected = true;
    sel.appendChild(o);
  });
  document.getElementById('modal-block-bg').style.display = 'flex';
}

function closeMB() { document.getElementById('modal-block-bg').style.display = 'none'; }

function saveMB() {
  if (!currentBlockKey) return;
  scheduled[currentBlockKey].personId = document.getElementById('mb-person').value;
  closeMB(); save(); renderAll(); showToast('Salvo!');
}

function removeBlock() {
  if (!currentBlockKey) return;
  delete scheduled[currentBlockKey];
  closeMB(); save(); renderAll(); showToast('Tarefa removida do calendário');
}

/* =====================
   MODAL: EDITAR TAREFA
   ===================== */
function openMT(taskId) {
  currentTaskId = taskId;
  const t = taskById(taskId);
  document.getElementById('mt-title').textContent = 'Editar: ' + t.name;
  document.getElementById('mt-name').value = t.name;
  document.getElementById('mt-mins').value = t.mins;
  document.getElementById('mt-desc').value = t.desc || '';
  document.getElementById('modal-task-bg').style.display = 'flex';
}

function closeMT() { document.getElementById('modal-task-bg').style.display = 'none'; }

function saveMT() {
  if (!currentTaskId) return;
  const t = taskById(currentTaskId);
  const n = document.getElementById('mt-name').value.trim();
  const m = parseInt(document.getElementById('mt-mins').value) || t.mins;
  const d = document.getElementById('mt-desc').value.trim();
  if (n) t.name = n;
  t.mins = Math.max(5, m);
  t.desc = d;
  closeMT(); save(); renderAll(); showToast('Tarefa atualizada');
}

function deleteTask() {
  if (!currentTaskId) return;
  const t = taskById(currentTaskId);
  if (!t) return;
  showConfirm(
    `Excluir "${t.name}"?`,
    'Ela será removida do calendário também.',
    () => {
      TASKS = TASKS.filter(x => x.id !== currentTaskId);
      Object.keys(scheduled).forEach(k => { if (scheduled[k].taskId === currentTaskId) delete scheduled[k]; });
      closeMT(); save(); renderAll(); showToast('Tarefa excluída');
    }
  );
}

/* =====================
   MODAL: NOVA TAREFA
   ===================== */
function openMN() {
  document.getElementById('mn-name').value = '';
  document.getElementById('mn-mins').value = '30';
  document.getElementById('mn-desc').value = '';
  document.getElementById('modal-new-bg').style.display = 'flex';
}

function closeMN() { document.getElementById('modal-new-bg').style.display = 'none'; }

function saveNewTask() {
  const name = document.getElementById('mn-name').value.trim();
  const mins = parseInt(document.getElementById('mn-mins').value) || 30;
  const desc = document.getElementById('mn-desc').value.trim();
  if (!name) return;
  TASKS.push({ id: uid(), name, mins: Math.max(5, mins), desc });
  closeMN(); save(); renderAll(); showToast('Tarefa criada!');
}

/* =====================
   MODAL: NOVA/EDITAR PESSOA
   ===================== */
function buildColorGrid(currentColor) {
  const grid = document.getElementById('color-grid');
  grid.innerHTML = '';
  COLOR_OPTIONS.forEach(c => {
    const sw = document.createElement('div');
    sw.className = 'color-swatch' + (c.color === currentColor ? ' selected' : '');
    sw.style.background = c.color;
    sw.title = c.color;
    sw.addEventListener('click', () => {
      document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
      sw.classList.add('selected');
      selectedColor = c;
    });
    grid.appendChild(sw);
  });
}

function openMP() {
  currentPersonId = null;
  selectedColor = COLOR_OPTIONS[0];
  document.getElementById('mp-title').textContent = 'Nova pessoa';
  document.getElementById('mp-name').value = '';
  document.getElementById('mp-delete-btn').style.display = 'none';
  buildColorGrid(selectedColor.color);
  document.getElementById('modal-person-bg').style.display = 'flex';
}

function openEditPerson(personId) {
  currentPersonId = personId;
  const p = personById(personId);
  if (!p) return;
  const pal = colorByValue(p.color);
  selectedColor = pal;
  document.getElementById('mp-title').textContent = 'Editar: ' + p.name;
  document.getElementById('mp-name').value = p.name;
  document.getElementById('mp-delete-btn').style.display = 'block';
  buildColorGrid(p.color);
  document.getElementById('modal-person-bg').style.display = 'flex';
}

function closeMP() { document.getElementById('modal-person-bg').style.display = 'none'; }

function savePerson() {
  const name = document.getElementById('mp-name').value.trim();
  if (!name) { showToast('Digite um nome'); return; }

  if (currentPersonId) {
    const p = personById(currentPersonId);
    p.name = name;
    p.color = selectedColor.color;
    showToast(`${name} atualizado(a)`);
  } else {
    PEOPLE.push({ id: uid(), name, color: selectedColor.color });
    showToast(`${name} adicionado(a)!`);
  }
  closeMP(); save(); renderAll();
}

function deletePerson() {
  if (!currentPersonId) return;
  const p = personById(currentPersonId);
  if (!p) return;
  showConfirm(
    `Excluir "${p.name}"?`,
    'As tarefas atribuídas a ela ficarão sem responsável.',
    () => {
      PEOPLE = PEOPLE.filter(x => x.id !== currentPersonId);
      Object.keys(scheduled).forEach(k => {
        if (scheduled[k].personId === currentPersonId) scheduled[k].personId = '';
      });
      closeMP(); save(); renderAll(); showToast(`${p.name} removido(a)`);
    }
  );
}

/* =====================
   RESUMO (página stats)
   ===================== */
function renderStats() {
  const totalM = Object.values(scheduled).reduce((a, s) => {
    const t = taskById(s.taskId);
    return a + (t ? t.mins : 0);
  }, 0);

  document.getElementById('stats-grid').innerHTML = `
    <div class="stat-card"><div class="stat-label">Agendadas</div><div class="stat-value">${Object.keys(scheduled).length}</div></div>
    <div class="stat-card"><div class="stat-label">Total de horas</div><div class="stat-value">${(totalM / 60).toFixed(1)}h</div></div>`;

  const maxM = Math.max(...PEOPLE.map(p => totalMins(p.id)), 1);
  document.getElementById('stats-bars').innerHTML = PEOPLE.length === 0
    ? '<p style="font-size:13px;color:#aaa">Nenhuma pessoa cadastrada ainda.</p>'
    : PEOPLE.map(p => {
        const pal = colorByValue(p.color);
        const m = totalMins(p.id);
        const c = taskCount(p.id);
        const h = Math.floor(m / 60);
        const min = m % 60;
        const pct = Math.round(m / maxM * 100);
        return `<div style="margin-bottom:16px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">
            <div style="display:flex;align-items:center;gap:8px">
              <div style="width:24px;height:24px;border-radius:50%;background:${pal.light};color:${pal.dark};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700">${p.name[0].toUpperCase()}</div>
              <span style="font-size:13px;font-weight:600">${p.name}</span>
              <span style="font-size:11px;padding:1px 8px;border-radius:999px;background:${pal.light};color:${pal.dark}">${c} tarefa${c !== 1 ? 's' : ''}</span>
            </div>
            <span style="font-size:12px;color:#888">${h}h ${min}min</span>
          </div>
          <div style="background:#f0f0ee;border-radius:4px;height:8px">
            <div style="width:${pct}%;height:8px;border-radius:4px;background:${pal.color};transition:width .4s"></div>
          </div></div>`;
      }).join('');

  const entries = Object.entries(scheduled);
  if (!entries.length) {
    document.getElementById('stats-tasks').innerHTML = '<p style="font-size:13px;color:#aaa">Nenhuma tarefa agendada ainda.</p>';
    return;
  }

  entries.sort((a, b) => a[1].day - b[1].day || a[1].snappedMins - b[1].snappedMins);
  document.getElementById('stats-tasks').innerHTML = entries.map(([k, s]) => {
    const t = taskById(s.taskId);
    const p = personById(s.personId);
    const pal = p ? colorByValue(p.color) : null;
    if (!t) return '';
    return `<div class="stat-task-row">
      <div style="width:8px;height:8px;border-radius:50%;background:${pal ? pal.color : '#ccc'};flex-shrink:0"></div>
      <span style="font-size:13px;flex:1">${t.name}</span>
      <span style="font-size:12px;color:#888">${DAYS_LBL[s.day]} ${timeStr(s.snappedMins)}</span>
      <span style="font-size:12px;color:${pal ? pal.dark : '#bbb'};font-weight:500">${p ? p.name : '—'}</span>
    </div>`;
  }).join('');
}

/* =====================
   NAVEGAÇÃO
   ===================== */
function goTo(page, btn) {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  ['calendar', 'tasks', 'people', 'stats'].forEach(p => {
    document.getElementById('page-' + p).style.display = p === page ? 'block' : 'none';
  });
  if (page === 'tasks')  renderTaskCards();
  if (page === 'people') renderPeopleCards();
  if (page === 'stats')  renderStats();
}

function renderAll() {
  renderTimeCol();
  renderDayCols();
  renderPool();
  renderSummary();
  renderPeopleRow();
  renderNoPeopleBanner();
  const cur = ['tasks', 'people', 'stats'].find(p =>
    document.getElementById('page-' + p).style.display === 'block'
  );
  if (cur === 'tasks')  renderTaskCards();
  if (cur === 'people') renderPeopleCards();
  if (cur === 'stats')  renderStats();
}

/* =====================
   BANNER: SEM PESSOAS
   ===================== */
function renderNoPeopleBanner() {
  const existing = document.getElementById('no-people-banner');
  if (existing) existing.remove();

  if (PEOPLE.length > 0) return;

  const banner = document.createElement('div');
  banner.id = 'no-people-banner';
  banner.style.cssText = `
    background: #fffbea;
    border: 1px solid #f0d070;
    border-radius: 12px;
    padding: 14px 18px;
    margin-bottom: 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  `;
  banner.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px">
      <span style="font-size:20px">👋</span>
      <div>
        <div style="font-size:13px;font-weight:600;color:#92650a">Nenhuma pessoa cadastrada ainda</div>
        <div style="font-size:12px;color:#b8860b;margin-top:2px">Cadastre as pessoas da casa para distribuir as tarefas</div>
      </div>
    </div>
    <button onclick="goToPeople()" style="
      font-size:13px;
      font-weight:600;
      padding:7px 16px;
      border-radius:8px;
      border:1px solid #d4a017;
      background:#fff3cd;
      color:#92650a;
      cursor:pointer;
      font-family:inherit;
      white-space:nowrap;
    ">Cadastrar pessoas →</button>
  `;

  const calPage = document.getElementById('page-calendar');
  calPage.insertBefore(banner, calPage.firstChild);
}

function goToPeople() {
  const btn = document.querySelector('.nav-btn:nth-child(3)');
  goTo('people', btn);
}

/* =====================
   INICIALIZAÇÃO
   ===================== */
['modal-block-bg', 'modal-task-bg', 'modal-new-bg', 'modal-detail-bg', 'modal-person-bg', 'modal-confirm-bg'].forEach(id => {
  document.getElementById(id).addEventListener('click', e => {
    if (e.target.id === id) document.getElementById(id).style.display = 'none';
  });
});

renderAll();
renderNoPeopleBanner();
