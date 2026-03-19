/* =====================
   DADOS & CONSTANTES
   ===================== */
const STORAGE_TASKS = 'tarefas_casa_tasks';
const STORAGE_SCHEDULED = 'tarefas_casa_scheduled';

const DEFAULT_TASKS = [
  { id: 'lavar-louca',     name: 'Lavar Louça',      mins: 20  },
  { id: 'almoco',          name: 'Almoço',            mins: 45  },
  { id: 'janta',           name: 'Janta',             mins: 45  },
  { id: 'lavar-roupa',     name: 'Lavar Roupa',       mins: 10  },
  { id: 'estender-roupa',  name: 'Estender Roupa',    mins: 20  },
  { id: 'guardar-roupa',   name: 'Guardar Roupa',     mins: 30  },
  { id: 'levar-ana',       name: 'Levar Ana',         mins: 30  },
  { id: 'buscar-ana',      name: 'Buscar Ana',        mins: 30  },
  { id: 'fazer-compras',   name: 'Fazer Compras',     mins: 90  },
  { id: 'fazer-feira',     name: 'Fazer Feira',       mins: 120 },
  { id: 'cabelo-ana',      name: 'Cabelo da Ana',     mins: 120 },
  { id: 'jogar-lixo',      name: 'Jogar Lixo',        mins: 10  },
  { id: 'buscar-pao',      name: 'Buscar pão',        mins: 10  },
  { id: 'limpar-casa',     name: 'Limpar Casa',       mins: 30  },
];

const PEOPLE = [
  { id: 'daniel',  name: 'Daniel',  color: '#185FA5', light: '#E6F1FB', dark: '#0C447C' },
  { id: 'jessica', name: 'Jéssica', color: '#993556', light: '#FBEAF0', dark: '#72243E' },
  { id: 'sophia',  name: 'Sophia',  color: '#0F6E56', light: '#E1F5EE', dark: '#085041' },
];

const HS = 8;         // hora de início
const HE = 24;        // hora de fim
const SPX = 30;       // pixels por meia hora
const PPM = SPX / 30; // pixels por minuto
const COL_H = (HE - HS) * 2 * SPX;
const DAYS_LBL = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

/* =====================
   ESTADO
   ===================== */
let TASKS = loadTasks();
let scheduled = loadScheduled();
let dragging = null;
let currentBlockKey = null;
let currentTaskId = null;
let detailTaskId = null;
let previews = [];

/* =====================
   PERSISTÊNCIA (localStorage)
   ===================== */
function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_TASKS);
    return raw ? JSON.parse(raw) : JSON.parse(JSON.stringify(DEFAULT_TASKS));
  } catch (e) {
    return JSON.parse(JSON.stringify(DEFAULT_TASKS));
  }
}

function loadScheduled() {
  try {
    const raw = localStorage.getItem(STORAGE_SCHEDULED);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_TASKS, JSON.stringify(TASKS));
    localStorage.setItem(STORAGE_SCHEDULED, JSON.stringify(scheduled));
  } catch (e) {
    showToast('Erro ao salvar dados');
  }
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
function uid() {
  return Math.random().toString(36).slice(2, 8);
}

function personById(id) {
  return PEOPLE.find(p => p.id === id);
}

function taskById(id) {
  return TASKS.find(t => t.id === id);
}

function snap30(m) {
  return Math.round(m / 30) * 30;
}

function heightPx(mins) {
  return Math.ceil(mins / 30) * SPX;
}

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
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/* =====================
   RENDERIZAÇÃO: CALENDÁRIO
   ===================== */
function renderTimeCol() {
  const col = document.getElementById('time-col');
  col.innerHTML = '';
  for (let h = HS; h < HE; h++) {
    const a = document.createElement('div');
    a.className = 'cal-time-label';
    a.textContent = `${String(h).padStart(2, '0')}:00`;
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

    // linhas de hora e meia hora
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

    // preview de slot
    const prev = document.createElement('div');
    prev.className = 'slot-preview';
    col.appendChild(prev);
    previews.push(prev);

    // eventos de drag
    col.addEventListener('dragover', e => {
      e.preventDefault();
      if (!dragging) return;
      const t = taskById(dragging.taskId);
      if (!t) return;
      const rect = col.getBoundingClientRect();
      const scrollTop = col.closest('.cal-scroll').scrollTop;
      const relY = e.clientY - rect.top + scrollTop;
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
      const rect = col.getBoundingClientRect();
      const scrollTop = col.closest('.cal-scroll').scrollTop;
      const relY = e.clientY - rect.top + scrollTop;
      const sm = Math.max(0, snap30(relY / PPM));
      const absH = HS + Math.floor(sm / 60);
      if (absH >= HE) return;
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

  // renderiza blocos agendados
  Object.entries(scheduled).forEach(([key, s]) => {
    const t = taskById(s.taskId);
    if (!t) return;
    const p = personById(s.personId);
    const col = wrap.children[s.day];
    if (!col) return;
    const hPx = heightPx(t.mins);

    const block = document.createElement('div');
    block.className = 'task-block';
    block.draggable = true;
    block.style.top = s.snappedMins * PPM + 'px';
    block.style.height = hPx + 'px';
    block.style.background = p ? p.light : '#f0f0ee';
    block.style.borderLeft = `3px solid ${p ? p.color : '#ccc'}`;
    const dc = p ? p.dark : '#333';

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
   RENDERIZAÇÃO: POOL DE TAREFAS
   ===================== */
function renderPool() {
  const wrap = document.getElementById('pool-tasks');
  wrap.innerHTML = '';

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
   RENDERIZAÇÃO: RESUMO E PESSOAS
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
    html += `<span class="summary-item"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};margin-right:5px;vertical-align:middle"></span><span class="summary-num">${c}</span>${p.name}</span>`;
  });

  document.getElementById('summary-bar').innerHTML = html;
}

function renderPeople() {
  const row = document.getElementById('people-row');
  row.innerHTML = '';
  const totals = PEOPLE.map(p => ({ p, m: totalMins(p.id), c: taskCount(p.id) }));
  const maxM = Math.max(...totals.map(x => x.m), 1);

  totals.forEach(({ p, m, c }) => {
    const h = Math.floor(m / 60);
    const min = m % 60;
    const pct = Math.round(m / maxM * 100);
    const card = document.createElement('div');
    card.className = 'person-card';
    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:7px">
        <div style="width:26px;height:26px;border-radius:50%;background:${p.light};color:${p.dark};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700">${p.name[0]}</div>
        <span style="font-size:13px;font-weight:600">${p.name}</span>
      </div>
      <div style="display:flex;gap:6px;margin-bottom:7px">
        <span class="count-badge" style="background:${p.light};color:${p.dark}">${c} tarefa${c !== 1 ? 's' : ''}</span>
        <span class="count-badge" style="background:#f0f0ee;color:#666">${h > 0 ? h + 'h ' : ''}${min > 0 ? min + 'min' : h === 0 ? '0min' : ''}</span>
      </div>
      <div class="bar-bg"><div class="bar-fg" style="width:${pct}%;background:${p.color}"></div></div>`;
    row.appendChild(card);
  });
}

/* =====================
   RENDERIZAÇÃO: PÁGINA TAREFAS
   ===================== */
function renderTaskCards() {
  const grid = document.getElementById('task-cards-grid');
  grid.innerHTML = '';

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
      <div class="task-card-actions">
        <button class="btn-sm" onclick="openMT('${t.id}')">Editar</button>
        <button class="btn-sm danger" onclick="confirmDelete('${t.id}')">Excluir</button>
      </div>`;
    grid.appendChild(card);
  });

  const addCard = document.createElement('div');
  addCard.className = 'task-card add-card';
  addCard.innerHTML = '<span style="font-size:24px;opacity:.3">+</span><span>Nova tarefa</span>';
  addCard.onclick = openMN;
  grid.appendChild(addCard);
}

function confirmDelete(taskId) {
  const t = taskById(taskId);
  if (!t) return;
  if (confirm(`Excluir "${t.name}"?\nEla será removida do calendário também.`)) {
    TASKS = TASKS.filter(x => x.id !== taskId);
    Object.keys(scheduled).forEach(k => { if (scheduled[k].taskId === taskId) delete scheduled[k]; });
    save();
    renderAll();
    showToast('Tarefa excluída');
  }
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
  let body = `<div style="margin-bottom:12px">
    <span class="detail-pill">${t.mins} minutos</span>
    <span class="detail-pill">${inSched.length}x agendada</span>
  </div>`;

  if (inSched.length) {
    body += '<div style="font-size:11px;font-weight:600;color:#999;margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">Agendamentos esta semana</div>';
    inSched.sort((a, b) => a.day - b.day || a.snappedMins - b.snappedMins).forEach(s => {
      const p = personById(s.personId);
      body += `<div class="detail-row">
        <span style="color:#555">${DAYS_LBL[s.day]} às ${timeStr(s.snappedMins)}</span>
        <span style="color:${p ? p.color : '#bbb'};font-weight:500">${p ? p.name : 'Sem responsável'}</span>
      </div>`;
    });
  } else {
    body += '<p style="font-size:13px;color:#aaa">Ainda não agendada esta semana.</p>';
  }

  document.getElementById('dt-body').innerHTML = body;
  document.getElementById('modal-detail-bg').style.display = 'flex';
}

function closeDetail() {
  document.getElementById('modal-detail-bg').style.display = 'none';
}

function openEditFromDetail() {
  closeDetail();
  if (detailTaskId) openMT(detailTaskId);
}

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

function closeMB() {
  document.getElementById('modal-block-bg').style.display = 'none';
}

function saveMB() {
  if (!currentBlockKey) return;
  scheduled[currentBlockKey].personId = document.getElementById('mb-person').value;
  closeMB();
  save();
  renderAll();
  showToast('Salvo!');
}

function removeBlock() {
  if (!currentBlockKey) return;
  delete scheduled[currentBlockKey];
  closeMB();
  save();
  renderAll();
  showToast('Tarefa removida do calendário');
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
  document.getElementById('modal-task-bg').style.display = 'flex';
}

function closeMT() {
  document.getElementById('modal-task-bg').style.display = 'none';
}

function saveMT() {
  if (!currentTaskId) return;
  const t = taskById(currentTaskId);
  const n = document.getElementById('mt-name').value.trim();
  const m = parseInt(document.getElementById('mt-mins').value) || t.mins;
  if (n) t.name = n;
  t.mins = Math.max(5, m);
  closeMT();
  save();
  renderAll();
  showToast('Tarefa atualizada');
}

function deleteTask() {
  if (!currentTaskId) return;
  TASKS = TASKS.filter(t => t.id !== currentTaskId);
  Object.keys(scheduled).forEach(k => { if (scheduled[k].taskId === currentTaskId) delete scheduled[k]; });
  closeMT();
  save();
  renderAll();
  showToast('Tarefa excluída');
}

/* =====================
   MODAL: NOVA TAREFA
   ===================== */
function openMN() {
  document.getElementById('mn-name').value = '';
  document.getElementById('mn-mins').value = '30';
  document.getElementById('modal-new-bg').style.display = 'flex';
}

function closeMN() {
  document.getElementById('modal-new-bg').style.display = 'none';
}

function saveNewTask() {
  const name = document.getElementById('mn-name').value.trim();
  const mins = parseInt(document.getElementById('mn-mins').value) || 30;
  if (!name) return;
  TASKS.push({ id: uid(), name, mins: Math.max(5, mins) });
  closeMN();
  save();
  renderAll();
  showToast('Tarefa criada!');
}

/* =====================
   RENDERIZAÇÃO: RESUMO (página stats)
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
  document.getElementById('stats-bars').innerHTML = PEOPLE.map(p => {
    const m = totalMins(p.id);
    const c = taskCount(p.id);
    const h = Math.floor(m / 60);
    const min = m % 60;
    const pct = Math.round(m / maxM * 100);
    return `<div style="margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">
        <div style="display:flex;align-items:center;gap:8px">
          <div style="width:24px;height:24px;border-radius:50%;background:${p.light};color:${p.dark};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700">${p.name[0]}</div>
          <span style="font-size:13px;font-weight:600">${p.name}</span>
          <span style="font-size:11px;padding:1px 8px;border-radius:999px;background:${p.light};color:${p.dark}">${c} tarefa${c !== 1 ? 's' : ''}</span>
        </div>
        <span style="font-size:12px;color:#888">${h}h ${min}min</span>
      </div>
      <div style="background:#f0f0ee;border-radius:4px;height:8px">
        <div style="width:${pct}%;height:8px;border-radius:4px;background:${p.color};transition:width .4s"></div>
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
    if (!t) return '';
    return `<div class="stat-task-row">
      <div style="width:8px;height:8px;border-radius:50%;background:${p ? p.color : '#ccc'};flex-shrink:0"></div>
      <span style="font-size:13px;flex:1">${t.name}</span>
      <span style="font-size:12px;color:#888">${DAYS_LBL[s.day]} ${timeStr(s.snappedMins)}</span>
      <span style="font-size:12px;color:${p ? p.dark : '#bbb'};font-weight:500">${p ? p.name : '—'}</span>
    </div>`;
  }).join('');
}

/* =====================
   NAVEGAÇÃO
   ===================== */
function goTo(page, btn) {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  ['calendar', 'tasks', 'stats'].forEach(p => {
    document.getElementById('page-' + p).style.display = p === page ? 'block' : 'none';
  });
  if (page === 'tasks') renderTaskCards();
  if (page === 'stats') renderStats();
}

function renderAll() {
  renderTimeCol();
  renderDayCols();
  renderPool();
  renderSummary();
  renderPeople();
  const cur = ['tasks', 'stats'].find(p => document.getElementById('page-' + p).style.display === 'block');
  if (cur === 'tasks') renderTaskCards();
  if (cur === 'stats') renderStats();
}

/* =====================
   INICIALIZAÇÃO
   ===================== */
['modal-block-bg', 'modal-task-bg', 'modal-new-bg', 'modal-detail-bg'].forEach(id => {
  document.getElementById(id).addEventListener('click', e => {
    if (e.target.id === id) document.getElementById(id).style.display = 'none';
  });
});

renderAll();
