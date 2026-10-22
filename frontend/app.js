'use strict';
// Service Desk UI — all data comes from the backend via relative /api (no mock data)
const API = '/api/tickets';
const STATUSES = ['open', 'doing', 'done'];

const form = document.getElementById('create-form');
const titleInput = document.getElementById('title');
const titleCount = document.getElementById('title-count');
const prioritySelect = document.getElementById('priority');
const createBtn = document.getElementById('create-btn');
const formMessage = document.getElementById('form-message');
const listMessage = document.getElementById('list-message');
const table = document.getElementById('ticket-table');
const tbody = document.getElementById('ticket-body');
const filterButtons = document.querySelectorAll('.filter');

let tickets = [];
let currentFilter = 'all';

function showMessage(el, text, kind) {
  el.textContent = text;
  el.className = 'message ' + kind;
  el.hidden = false;
}

function hideMessage(el) {
  el.hidden = true;
  el.textContent = '';
}

async function request(url, options) {
  let res;
  try {
    res = await fetch(url, options);
  } catch {
    throw new Error('เชื่อมต่อ backend ไม่ได้ (network error)');
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    // non-JSON body (e.g. proxy 502 page)
  }
  if (!res.ok) {
    const detail = data && data.error ? data.error : 'HTTP ' + res.status;
    throw new Error('เกิดข้อผิดพลาด: ' + detail);
  }
  return data;
}

// ---- list ----
async function loadTickets() {
  try {
    const data = await request(API, { headers: { Accept: 'application/json' } });
    if (!Array.isArray(data)) throw new Error('เกิดข้อผิดพลาด: รูปแบบข้อมูลจาก backend ไม่ถูกต้อง');
    tickets = data;
    render();
  } catch (err) {
    tickets = [];
    table.hidden = true;
    showMessage(listMessage, err.message + ' — ลองรีเฟรชหน้าอีกครั้ง', 'error');
  }
}

function render() {
  const visible = currentFilter === 'all'
    ? tickets
    : tickets.filter((t) => t.status === currentFilter);

  tbody.replaceChildren(...visible.map(renderRow));

  // ticket count per filter chip
  for (const el of document.querySelectorAll('[data-count]')) {
    const f = el.dataset.count;
    el.textContent = f === 'all' ? tickets.length : tickets.filter((t) => t.status === f).length;
  }

  if (tickets.length === 0) {
    table.hidden = true;
    showMessage(listMessage, 'ยังไม่มีรายการ ticket — สร้างรายการแรกจากแบบฟอร์มด้านบน', 'empty');
  } else if (visible.length === 0) {
    table.hidden = true;
    showMessage(listMessage, 'ไม่มีรายการในสถานะ "' + currentFilter + '"', 'empty');
  } else {
    table.hidden = false;
    hideMessage(listMessage);
  }
}

function renderRow(ticket) {
  const tr = document.createElement('tr');

  const idCell = document.createElement('td');
  idCell.className = 'id-cell';
  idCell.textContent = '#' + ticket.id;

  // textContent, never innerHTML — titles are user input
  const titleCell = document.createElement('td');
  titleCell.textContent = ticket.title;
  titleCell.className = 'title-cell';

  const priorityCell = document.createElement('td');
  const badge = document.createElement('span');
  badge.className = 'badge priority-' + ticket.priority;
  badge.textContent = ticket.priority;
  priorityCell.append(badge);

  const statusCell = document.createElement('td');
  const select = document.createElement('select');
  select.className = 'status-select status-' + ticket.status;
  select.setAttribute('aria-label', 'สถานะของ ticket #' + ticket.id);
  for (const s of STATUSES) {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    opt.selected = s === ticket.status;
    select.append(opt);
  }
  select.addEventListener('change', () => changeStatus(ticket.id, select));
  statusCell.append(select);

  tr.append(idCell, titleCell, priorityCell, statusCell);
  return tr;
}

// ---- update status ----
async function changeStatus(id, select) {
  const ticket = tickets.find((t) => t.id === id);
  const previous = ticket ? ticket.status : null;
  select.disabled = true;
  try {
    const updated = await request(API + '/' + id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: select.value }),
    });
    tickets = tickets.map((t) => (t.id === id ? updated : t));
    render();
  } catch (err) {
    if (previous) select.value = previous;
    select.disabled = false;
    showMessage(listMessage, 'บันทึกสถานะ ticket #' + id + ' ไม่สำเร็จ — ' + err.message, 'error');
  }
}

// ---- create ----
titleInput.addEventListener('input', () => {
  titleCount.textContent = Array.from(titleInput.value.trim()).length;
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  hideMessage(formMessage);

  const title = titleInput.value.trim();
  const priority = prioritySelect.value;
  const len = Array.from(title).length;
  if (len < 1 || len > 80) {
    showMessage(formMessage, 'กรุณากรอกหัวข้อ 1–80 ตัวอักษร', 'error');
    titleInput.focus();
    return;
  }
  if (!priority) {
    showMessage(formMessage, 'กรุณาเลือกความสำคัญ (priority)', 'error');
    prioritySelect.focus();
    return;
  }

  createBtn.disabled = true;
  try {
    const created = await request(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, priority }),
    });
    form.reset();
    titleCount.textContent = '0';
    showMessage(formMessage, 'สร้าง ticket #' + created.id + ' เรียบร้อย', 'success');
    await loadTickets();
  } catch (err) {
    showMessage(formMessage, err.message, 'error');
  } finally {
    createBtn.disabled = false;
  }
});

// ---- filter (client-side) ----
for (const btn of filterButtons) {
  btn.addEventListener('click', () => {
    currentFilter = btn.dataset.filter;
    for (const b of filterButtons) {
      const active = b === btn;
      b.classList.toggle('active', active);
      b.setAttribute('aria-pressed', String(active));
    }
    render();
  });
}

loadTickets();
