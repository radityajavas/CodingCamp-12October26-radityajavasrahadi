'use strict';

// =============================================
// CONSTANTS & STATE
// =============================================
const STORAGE_KEYS = {
  THEME: 'dashboard_theme',
  NAME:  'dashboard_name',
  TODOS: 'dashboard_todos',
  LINKS: 'dashboard_links',
};

const POMODORO_DURATION = 25 * 60; // seconds

let timerSeconds  = POMODORO_DURATION;
let timerInterval = null;
let timerRunning  = false;

let editingTodoId = null;

// =============================================
// UTILITY
// =============================================
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function loadStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function pad(n) {
  return String(n).padStart(2, '0');
}

// =============================================
// A. THEME (DARK / LIGHT MODE)
// =============================================
const themeToggleBtn = document.getElementById('theme-toggle');

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  themeToggleBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
}

function initTheme() {
  const saved = loadStorage(STORAGE_KEYS.THEME, 'light');
  applyTheme(saved);
}

themeToggleBtn.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  saveStorage(STORAGE_KEYS.THEME, next);
});

// =============================================
// A. CLOCK & GREETING
// =============================================
const clockEl      = document.getElementById('clock');
const greetingEl   = document.getElementById('greeting-text');
const dateEl       = document.getElementById('date-text');
const greetNameEl  = document.getElementById('greeting-name');
const editNameBtn  = document.getElementById('edit-name-btn');
const nameForm     = document.getElementById('name-form');
const nameInput    = document.getElementById('name-input');
const saveNameBtn  = document.getElementById('save-name-btn');

const DAYS    = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
const MONTHS  = ['Januari','Februari','Maret','April','Mei','Juni',
                 'Juli','Agustus','September','Oktober','November','Desember'];

function getGreeting(hour) {
  if (hour >= 5  && hour < 12) return 'Selamat Pagi';
  if (hour >= 12 && hour < 15) return 'Selamat Siang';
  if (hour >= 15 && hour < 19) return 'Selamat Sore';
  return 'Selamat Malam';
}

function updateClock() {
  const now = new Date();
  const h = now.getHours(), m = now.getMinutes(), s = now.getSeconds();

  clockEl.textContent = pad(h) + ':' + pad(m) + ':' + pad(s);
  greetingEl.textContent = getGreeting(h);
  dateEl.textContent = DAYS[now.getDay()] + ', ' + now.getDate() + ' ' + MONTHS[now.getMonth()] + ' ' + now.getFullYear();
}

function loadName() {
  const name = loadStorage(STORAGE_KEYS.NAME, '');
  greetNameEl.textContent = name ? 'Halo, ' + name + '! 👋' : 'Siapa namamu?';
}

editNameBtn.addEventListener('click', () => {
  const current = loadStorage(STORAGE_KEYS.NAME, '');
  nameInput.value = current;
  nameForm.classList.toggle('hidden');
  if (!nameForm.classList.contains('hidden')) nameInput.focus();
});

saveNameBtn.addEventListener('click', () => {
  const name = nameInput.value.trim();
  if (!name) return;
  saveStorage(STORAGE_KEYS.NAME, name);
  loadName();
  nameForm.classList.add('hidden');
});

nameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') saveNameBtn.click();
  if (e.key === 'Escape') nameForm.classList.add('hidden');
});

// =============================================
// B. FOCUS TIMER (POMODORO)
// =============================================
const timerDisplay  = document.getElementById('timer-display');
const startBtn      = document.getElementById('timer-start');
const pauseBtn      = document.getElementById('timer-pause');
const resetBtn      = document.getElementById('timer-reset');

function renderTimer() {
  const m = Math.floor(timerSeconds / 60);
  const s = timerSeconds % 60;
  timerDisplay.textContent = pad(m) + ':' + pad(s);
}

function startTimer() {
  if (timerRunning) return;
  timerRunning = true;
  startBtn.disabled = true;
  pauseBtn.disabled = false;

  timerInterval = setInterval(() => {
    if (timerSeconds <= 0) {
      clearInterval(timerInterval);
      timerRunning = false;
      startBtn.disabled = false;
      pauseBtn.disabled = true;
      timerDisplay.textContent = '00:00';
      showTimerFinished();
      return;
    }
    timerSeconds--;
    renderTimer();
  }, 1000);
}

function pauseTimer() {
  clearInterval(timerInterval);
  timerRunning = false;
  startBtn.disabled = false;
  pauseBtn.disabled = true;
}

function resetTimer() {
  clearInterval(timerInterval);
  timerRunning = false;
  timerSeconds = POMODORO_DURATION;
  startBtn.disabled = false;
  pauseBtn.disabled = true;
  renderTimer();
}

function showTimerFinished() {
  const orig = document.title;
  document.title = '✅ Sesi Selesai! - Life Dashboard';
  alert('🎉 Sesi fokus 25 menit selesai! Saatnya istirahat.');
  document.title = orig;
}

startBtn.addEventListener('click', startTimer);
pauseBtn.addEventListener('click', pauseTimer);
resetBtn.addEventListener('click', resetTimer);

// =============================================
// C. TO-DO LIST
// =============================================
const todoForm      = document.getElementById('todo-form');
const todoInput     = document.getElementById('todo-input');
const todoListEl    = document.getElementById('todo-list');
const todoAlert     = document.getElementById('todo-alert');
const editModal     = document.getElementById('edit-modal');
const editInput     = document.getElementById('edit-input');
const editSaveBtn   = document.getElementById('edit-save-btn');
const editCancelBtn = document.getElementById('edit-cancel-btn');

function getTodos() {
  return loadStorage(STORAGE_KEYS.TODOS, []);
}

function saveTodos(todos) {
  saveStorage(STORAGE_KEYS.TODOS, todos);
}

function showTodoAlert(msg) {
  todoAlert.textContent = msg;
  todoAlert.classList.remove('hidden');
  clearTimeout(todoAlert._timeout);
  todoAlert._timeout = setTimeout(() => todoAlert.classList.add('hidden'), 3000);
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderTodos() {
  const todos = getTodos();
  todoListEl.innerHTML = '';

  if (todos.length === 0) {
    todoListEl.innerHTML = '<li class="empty-state">Belum ada tugas. Tambahkan sesuatu! 🎯</li>';
    return;
  }

  todos.forEach((todo) => {
    const li = document.createElement('li');
    li.className = 'todo-item' + (todo.done ? ' done' : '');
    li.dataset.id = todo.id;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'todo-checkbox';
    checkbox.checked = todo.done;
    checkbox.setAttribute('aria-label', 'Tandai selesai');
    checkbox.addEventListener('change', () => toggleTodo(todo.id));

    const span = document.createElement('span');
    span.className = 'todo-text';
    span.textContent = todo.text;

    const actions = document.createElement('div');
    actions.className = 'todo-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'btn-edit';
    editBtn.title = 'Edit tugas';
    editBtn.textContent = '✏️';
    editBtn.addEventListener('click', () => openEditModal(todo.id, todo.text));

    const delBtn = document.createElement('button');
    delBtn.className = 'btn-danger';
    delBtn.title = 'Hapus tugas';
    delBtn.textContent = '🗑';
    delBtn.addEventListener('click', () => deleteTodo(todo.id));

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);

    li.appendChild(checkbox);
    li.appendChild(span);
    li.appendChild(actions);
    todoListEl.appendChild(li);
  });
}

function addTodo(text) {
  const todos = getTodos();

  // Challenge 3: Prevent duplicate tasks (case-insensitive)
  const duplicate = todos.some((t) => t.text.toLowerCase() === text.toLowerCase());
  if (duplicate) {
    showTodoAlert('⚠️ Tugas "' + text + '" sudah ada di daftar!');
    return false;
  }

  todos.push({ id: generateId(), text: text, done: false });
  saveTodos(todos);
  renderTodos();
  return true;
}

function toggleTodo(id) {
  const todos = getTodos();
  const todo = todos.find((t) => t.id === id);
  if (todo) todo.done = !todo.done;
  saveTodos(todos);
  renderTodos();
}

function deleteTodo(id) {
  const todos = getTodos().filter((t) => t.id !== id);
  saveTodos(todos);
  renderTodos();
}

function openEditModal(id, currentText) {
  editingTodoId = id;
  editInput.value = currentText;
  editModal.classList.remove('hidden');
  editInput.focus();
}

function closeEditModal() {
  editModal.classList.add('hidden');
  editingTodoId = null;
}

function saveEditTodo() {
  const newText = editInput.value.trim();
  if (!newText || !editingTodoId) return;

  const todos = getTodos();
  const idx = todos.findIndex((t) => t.id === editingTodoId);
  if (idx === -1) return;

  // Prevent duplicate when editing (ignore self)
  const duplicate = todos.some(
    (t, i) => i !== idx && t.text.toLowerCase() === newText.toLowerCase()
  );
  if (duplicate) {
    showTodoAlert('⚠️ Tugas "' + newText + '" sudah ada di daftar!');
    return;
  }

  todos[idx].text = newText;
  saveTodos(todos);
  renderTodos();
  closeEditModal();
}

todoForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = todoInput.value.trim();
  if (!text) return;
  if (addTodo(text)) {
    todoInput.value = '';
    todoInput.focus();
  }
});

editSaveBtn.addEventListener('click', saveEditTodo);
editCancelBtn.addEventListener('click', closeEditModal);

editInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') saveEditTodo();
  if (e.key === 'Escape') closeEditModal();
});

editModal.addEventListener('click', (e) => {
  if (e.target === editModal) closeEditModal();
});

// =============================================
// D. QUICK LINKS
// =============================================
const linkForm    = document.getElementById('link-form');
const linkNameEl  = document.getElementById('link-name');
const linkUrlEl   = document.getElementById('link-url');
const linksListEl = document.getElementById('links-list');

function getLinks() {
  return loadStorage(STORAGE_KEYS.LINKS, []);
}

function saveLinks(links) {
  saveStorage(STORAGE_KEYS.LINKS, links);
}

function renderLinks() {
  const links = getLinks();
  linksListEl.innerHTML = '';

  if (links.length === 0) {
    linksListEl.innerHTML = '<p class="empty-state">Belum ada link. Tambahkan situs favoritmu! 🌐</p>';
    return;
  }

  links.forEach((link) => {
    const div = document.createElement('div');
    div.className = 'link-item';

    const a = document.createElement('a');
    a.href   = link.url;
    a.target = '_blank';
    a.rel    = 'noopener noreferrer';
    a.textContent = link.name;

    const delBtn = document.createElement('button');
    delBtn.className = 'link-delete';
    delBtn.title = 'Hapus link';
    delBtn.textContent = '✕';
    delBtn.addEventListener('click', () => deleteLink(link.id));

    div.appendChild(a);
    div.appendChild(delBtn);
    linksListEl.appendChild(div);
  });
}

function addLink(name, url) {
  let finalUrl = url.trim();
  if (!/^https?:\/\//i.test(finalUrl)) {
    finalUrl = 'https://' + finalUrl;
  }
  const links = getLinks();
  links.push({ id: generateId(), name: name.trim(), url: finalUrl });
  saveLinks(links);
  renderLinks();
}

function deleteLink(id) {
  const links = getLinks().filter((l) => l.id !== id);
  saveLinks(links);
  renderLinks();
}

linkForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = linkNameEl.value.trim();
  const url  = linkUrlEl.value.trim();
  if (!name || !url) return;
  addLink(name, url);
  linkNameEl.value = '';
  linkUrlEl.value  = '';
  linkNameEl.focus();
});

// =============================================
// INIT
// =============================================
function init() {
  initTheme();
  updateClock();
  setInterval(updateClock, 1000);
  loadName();
  renderTimer();
  renderTodos();
  renderLinks();
}

init();