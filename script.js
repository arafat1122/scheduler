/* ============================================================
   script.js
   App-wide constants, the Task/Settings data stores, generic UI
   helpers (toast, modals, confetti), navigation between panels,
   the live clock, keyboard shortcuts, and the bootstrap sequence.
   ============================================================ */

/* ---------- Static reference data ---------- */

const CATEGORIES = {
  Study:          { color: '#60a5fa', icon: '📘' },
  Work:           { color: '#f59e0b', icon: '💼' },
  Programming:    { color: '#22d3ee', icon: '💻' },
  Networking:     { color: '#818cf8', icon: '🌐' },
  CCNA:           { color: '#38bdf8', icon: '🖧' },
  Cloud:          { color: '#a78bfa', icon: '☁️' },
  Exercise:       { color: '#34d399', icon: '🏋️' },
  Prayer:         { color: '#fbbf24', icon: '🕌' },
  Reading:        { color: '#f472b6', icon: '📖' },
  Meeting:        { color: '#fb7185', icon: '🗣️' },
  Business:       { color: '#4ade80', icon: '📈' },
  Shopping:       { color: '#f97316', icon: '🛒' },
  Health:         { color: '#2dd4bf', icon: '🩺' },
  Entertainment:  { color: '#e879f9', icon: '🎮' },
  Custom:         { color: '#94a3b8', icon: '✨' }
};

const PRIORITIES = {
  Low:      { color: '#4ade80', order: 0 },
  Medium:   { color: '#facc15', order: 1 },
  High:     { color: '#fb923c', order: 2 },
  Critical: { color: '#f87171', order: 3 }
};

const STATUSES = {
  Pending:      { color: '#94a3b8', icon: 'fa-hourglass-half' },
  'In Progress':{ color: '#60a5fa', icon: 'fa-spinner' },
  Completed:    { color: '#4ade80', icon: 'fa-circle-check' },
  Missed:       { color: '#f87171', icon: 'fa-circle-xmark' },
  Skipped:      { color: '#c084fc', icon: 'fa-forward' },
  Cancelled:    { color: '#64748b', icon: 'fa-ban' }
};

const MOTIVATIONAL_QUOTES = [
  "Discipline is choosing between what you want now and what you want most.",
  "Small daily improvements lead to staggering long-term results.",
  "You don't have to be extreme, just consistent.",
  "Focus on being productive instead of busy.",
  "The secret of getting ahead is getting started.",
  "Well begun is half done.",
  "Your future is created by what you do today, not tomorrow.",
  "Progress, not perfection.",
  "Action is the foundational key to all success.",
  "Don't watch the clock; do what it does — keep going."
];

const PRODUCTIVITY_TIPS = [
  "Batch similar tasks together to reduce context switching.",
  "Use the two-minute rule: if it takes under two minutes, do it now.",
  "Review tomorrow's schedule the night before.",
  "Protect your peak-energy hours for deep work.",
  "Turn off notifications during focus blocks."
];

const PROGRAMMING_TIPS = [
  "Write the test before the fix — it proves the bug and the fix.",
  "Small, frequent commits beat one giant commit.",
  "Name variables for what they hold, not how they're used.",
  "Read the error message fully before searching for it.",
  "Refactor in small steps, running tests after each one."
];

const NETWORKING_TIPS = [
  "Subnet math gets easy once you practice it daily for a week.",
  "Always check both ends of a link for duplex mismatches.",
  "Ping tells you reachability; traceroute tells you the path.",
  "Document your VLAN scheme before you deploy it, not after.",
  "In CCNA labs, 'show running-config' is your best friend."
];

const DEFAULT_SETTINGS = {
  soundEnabled: true,
  volume: 70,
  waterReminders: true,
  autoSaveEnabled: true,
  lastWaterPromptKey: null
};

/* ---------- Settings store ---------- */

const SettingsStore = {
  get() {
    return Storage.get(STORAGE_KEYS.SETTINGS, { ...DEFAULT_SETTINGS });
  },
  update(patch) {
    const current = this.get();
    const next = { ...current, ...patch };
    Storage.set(STORAGE_KEYS.SETTINGS, next);
    return next;
  }
};

/* ---------- Task store ---------- */

const TaskStore = {
  cache: null,

  getAll() {
    if (!this.cache) this.cache = Storage.get(STORAGE_KEYS.TASKS, []);
    return this.cache;
  },

  getById(id) {
    return this.getAll().find(t => t.id === id) || null;
  },

  getByHour(hour) {
    return this.getAll().filter(t => t.hour === hour).sort((a, b) => a.createdAt - b.createdAt);
  },

  add(task, opts = {}) {
    const full = {
      id: generateId(),
      hour: 0,
      text: '',
      priority: 'Medium',
      category: 'Study',
      status: 'Pending',
      color: CATEGORIES.Study.color,
      reminder: false,
      recurrence: 'daily',
      weeklyDays: [],
      monthlyDay: String(new Date().getDate()),
      specificDate: todayKey(),
      snoozedUntil: null,
      lastFiredHourKey: null,
      createdAt: Date.now(),
      completedAt: null,
      ...task
    };
    const all = this.getAll();
    all.push(full);
    this.persist(opts);
    return full;
  },

  update(id, patch, opts = {}) {
    const all = this.getAll();
    const idx = all.findIndex(t => t.id === id);
    if (idx === -1) return null;
    const wasCompleted = all[idx].status === 'Completed';
    all[idx] = { ...all[idx], ...patch, id };
    if (!wasCompleted && all[idx].status === 'Completed') {
      all[idx].completedAt = Date.now();
    }
    this.persist(opts);
    return all[idx];
  },

  remove(id, opts = {}) {
    this.pushUndo();
    this.cache = this.getAll().filter(t => t.id !== id);
    this.persist(opts);
  },

  duplicate(id) {
    const task = this.getById(id);
    if (!task) return null;
    const copy = { ...task, id: generateId(), createdAt: Date.now(), status: 'Pending', completedAt: null, lastFiredHourKey: null };
    this.getAll().push(copy);
    this.persist();
    return copy;
  },

  persist(opts = {}) {
    Storage.set(STORAGE_KEYS.TASKS, this.getAll());
    if (!opts.silent) {
      Scheduler.render();
      Dashboard.renderStatCards();
      Charts.refreshAll();
    }
  },

  pushUndo() {
    const stack = Storage.get(STORAGE_KEYS.UNDO_STACK, []);
    stack.push(JSON.parse(JSON.stringify(this.getAll())));
    if (stack.length > 20) stack.shift();
    Storage.set(STORAGE_KEYS.UNDO_STACK, stack);
  },

  undo() {
    const stack = Storage.get(STORAGE_KEYS.UNDO_STACK, []);
    const prev = stack.pop();
    if (!prev) {
      UI.toast('Nothing to undo.', 'info');
      return;
    }
    Storage.set(STORAGE_KEYS.UNDO_STACK, stack);
    this.cache = prev;
    this.persist({ silent: true });
    Scheduler.render();
    Dashboard.renderStatCards();
    Charts.refreshAll();
    UI.toast('Undo applied.', 'success');
  },

  /** Aggregate stats used by dashboard cards, the stats panel, and charts. */
  stats() {
    const all = this.getAll().filter(isToday);
    const total = all.length;
    const byStatus = key => all.filter(t => t.status === key).length;
    const completed = byStatus('Completed');
    const productivity = total ? Math.round((completed / total) * 100) : 0;
    return {
      total,
      completed,
      pending: byStatus('Pending'),
      missed: byStatus('Missed'),
      inProgress: byStatus('In Progress'),
      skipped: byStatus('Skipped'),
      cancelled: byStatus('Cancelled'),
      productivity
    };
  }
};

function isToday(task, maybeDate) {
  if (!task || typeof task !== 'object') return false;
  const today = maybeDate instanceof Date ? maybeDate : new Date();
  const recurrence = task.recurrence || 'daily';
  const key = todayKey(today);

  if (recurrence === 'date') {
    return task.specificDate === key;
  }

  if (recurrence === 'weekly') {
    const weekDays = Array.isArray(task.weeklyDays) ? task.weeklyDays.map(String) : [];
    return weekDays.includes(String(today.getDay()));
  }

  if (recurrence === 'monthly') {
    const requestedDay = Number(task.monthlyDay) || 1;
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const targetDay = Math.min(requestedDay, daysInMonth);
    return today.getDate() === targetDay;
  }

  return true;
}

/* ---------- Streak tracking ---------- */

const StreakStore = {
  get() {
    return Storage.get(STORAGE_KEYS.STREAK, { current: 0, longest: 0, lastCompleteDay: null, log: {} });
  },
  /** Call once per day (on load) to evaluate yesterday and roll the streak. */
  evaluateDaily() {
    const data = this.get();
    const stats = TaskStore.stats();
    const key = todayKey();
    data.log[key] = stats.productivity;
    if (stats.total > 0 && stats.productivity >= 80) {
      if (data.lastCompleteDay !== key) {
        data.current += 1;
        data.lastCompleteDay = key;
      }
    }
    data.longest = Math.max(data.longest, data.current);
    Storage.set(STORAGE_KEYS.STREAK, data);
    return data;
  }
};

/* ---------- Generic UI helpers ---------- */

const UI = {
  toast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const el = document.createElement('div');
    el.className = `toast toast--${type}`;
    const icons = { success: 'fa-circle-check', info: 'fa-circle-info', warning: 'fa-triangle-exclamation', error: 'fa-circle-xmark' };
    el.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i><span>${escapeHtml(message)}</span>`;
    container.appendChild(el);
    requestAnimationFrame(() => el.classList.add('toast--show'));
    setTimeout(() => {
      el.classList.remove('toast--show');
      setTimeout(() => el.remove(), 300);
    }, 3500);
  },

  openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.add('modal--open');
    document.body.classList.add('no-scroll');
  },

  closeModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.remove('modal--open');
    document.body.classList.remove('no-scroll');
  },

  closeAllModals() {
    document.querySelectorAll('.modal--open').forEach(m => m.classList.remove('modal--open'));
    document.body.classList.remove('no-scroll');
  },

  openReminderModal(task, title, body) {
    const modal = document.getElementById('reminderModal');
    if (!modal) return;
    modal.querySelector('.reminder-title').textContent = title;
    modal.querySelector('.reminder-body').textContent = body;
    modal.dataset.taskId = task.id;
    this.openModal('reminderModal');
  },

  closeReminderModal() {
    this.closeModal('reminderModal');
  },

  /** Lightweight celebratory confetti burst using absolutely-positioned divs. */
  confetti() {
    const colors = ['#60a5fa', '#a78bfa', '#f472b6', '#4ade80', '#facc15'];
    const layer = document.getElementById('confettiLayer');
    if (!layer) return;
    for (let i = 0; i < 80; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.left = Math.random() * 100 + 'vw';
      piece.style.background = colors[Math.floor(Math.random() * colors.length)];
      piece.style.animationDelay = (Math.random() * 0.4) + 's';
      piece.style.animationDuration = (2 + Math.random() * 1.5) + 's';
      piece.style.setProperty('--drift', (Math.random() * 160 - 80) + 'px');
      layer.appendChild(piece);
      setTimeout(() => piece.remove(), 4000);
    }
  }
};

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

/* ---------- Navigation between panels ---------- */

const Nav = {
  panels: ['dashboard', 'scheduler', 'stats', 'calendar', 'notes', 'habits', 'goals', 'timers', 'settings'],

  init() {
    document.querySelectorAll('[data-nav-target]').forEach(btn => {
      btn.addEventListener('click', () => this.show(btn.dataset.navTarget));
    });
  },

  show(panelName) {
    this.panels.forEach(name => {
      const el = document.getElementById(`panel-${name}`);
      if (el) el.classList.toggle('panel--active', name === panelName);
    });
    document.querySelectorAll('[data-nav-target]').forEach(btn => {
      btn.classList.toggle('navbtn--active', btn.dataset.navTarget === panelName);
    });
    if (panelName === 'stats' || panelName === 'calendar') Charts.refreshAll();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
};

/* ---------- Live clock ---------- */

function startClock() {
  const dateEl = document.getElementById('currentDate');
  const timeEl = document.getElementById('currentTime');
  function tick() {
    const now = new Date();
    if (dateEl) dateEl.textContent = now.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    if (timeEl) timeEl.textContent = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
  tick();
  setInterval(tick, 1000);
}

/* ---------- Keyboard shortcuts ---------- */

function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);

    if (e.key === 'Escape') {
      UI.closeAllModals();
      return;
    }
    if (e.ctrlKey && e.key.toLowerCase() === 'n') {
      e.preventDefault();
      Nav.show('scheduler');
      Scheduler.focusFirstEmptyInput();
      return;
    }
    if (e.ctrlKey && e.key.toLowerCase() === 's') {
      e.preventDefault();
      UI.toast('Everything is auto-saved — no action needed.', 'success');
      return;
    }
    if (!typing && (e.key === 'Delete' || e.key === 'Backspace') && Scheduler.selectedTaskId) {
      e.preventDefault();
      Scheduler.deleteTask(Scheduler.selectedTaskId);
      return;
    }
    if (!typing && e.code === 'Space' && Scheduler.selectedTaskId) {
      e.preventDefault();
      Scheduler.toggleComplete(Scheduler.selectedTaskId);
      return;
    }
  });
}

/* ---------- App bootstrap ---------- */

document.addEventListener('DOMContentLoaded', () => {
  ThemeManager.init();
  startClock();
  Nav.init();
  initKeyboardShortcuts();

  // Theme controls
  document.getElementById('themeToggleBtn')?.addEventListener('click', () => ThemeManager.toggleMode());
  document.querySelectorAll('[data-accent]').forEach(btn => {
    btn.addEventListener('click', () => ThemeManager.setAccent(btn.dataset.accent));
  });

  // Settings panel controls
  const settings = SettingsStore.get();
  const soundToggle = document.getElementById('soundToggle');
  const volumeSlider = document.getElementById('volumeSlider');
  const waterToggle = document.getElementById('waterReminderToggle');
  if (soundToggle) soundToggle.checked = settings.soundEnabled;
  if (volumeSlider) volumeSlider.value = settings.volume;
  if (waterToggle) waterToggle.checked = settings.waterReminders;

  soundToggle?.addEventListener('change', () => SettingsStore.update({ soundEnabled: soundToggle.checked }));
  volumeSlider?.addEventListener('input', () => SettingsStore.update({ volume: Number(volumeSlider.value) }));
  waterToggle?.addEventListener('change', () => SettingsStore.update({ waterReminders: waterToggle.checked }));

  document.getElementById('enableNotificationsBtn')?.addEventListener('click', () => ReminderSystem.requestPermission());
  document.getElementById('fullscreenBtn')?.addEventListener('click', () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  });
  document.getElementById('undoBtn')?.addEventListener('click', () => TaskStore.undo());

  document.getElementById('backupBtn')?.addEventListener('click', () => {
    const bundle = Storage.exportAll();
    downloadFile(`scheduler-backup-${todayKey()}.json`, JSON.stringify(bundle, null, 2), 'application/json');
  });
  document.getElementById('restoreInput')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const bundle = JSON.parse(reader.result);
        Storage.importAll(bundle);
        UI.toast('Backup restored — reloading…', 'success');
        setTimeout(() => location.reload(), 1000);
      } catch (err) {
        UI.toast('That file could not be read as a backup.', 'error');
      }
    };
    reader.readAsText(file);
  });
  document.getElementById('resetAppBtn')?.addEventListener('click', () => {
    if (confirm('This clears all tasks, notes, habits, goals, and settings on this device. Continue?')) {
      Storage.clearAll();
      location.reload();
    }
  });

  // Reminder modal buttons
  document.getElementById('reminderModal')?.addEventListener('click', (e) => {
    const action = e.target.closest('[data-reminder-action]')?.dataset.reminderAction;
    if (!action) return;
    const taskId = document.getElementById('reminderModal').dataset.taskId;
    if (action === 'snooze5') ReminderSystem.snooze(taskId, 5);
    if (action === 'snooze10') ReminderSystem.snooze(taskId, 10);
    if (action === 'dismiss') UI.closeReminderModal();
    if (action === 'complete') { Scheduler.toggleComplete(taskId, 'Completed'); UI.closeReminderModal(); }
    if (action === 'startTimer') { Nav.show('timers'); UI.closeReminderModal(); }
  });

  // Generic modal close buttons / backdrop clicks
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => UI.closeModal(btn.closest('.modal').id));
  });
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => { if (e.target === modal) UI.closeModal(modal.id); });
  });

  // Module init (each module owns its own DOM wiring)
  Scheduler.init();
  Dashboard.init();
  Charts.init();
  ReminderSystem.init();

  StreakStore.evaluateDaily();
  Dashboard.renderStatCards();
  Motivation.rotate();

  // Auto-save heartbeat — data is already saved on every change, this just
  // gives a visible "Saved" pulse so the auto-save feature is perceptible.
  setInterval(() => {
    if (SettingsStore.get().autoSaveEnabled) {
      const dot = document.getElementById('autoSaveDot');
      if (dot) {
        dot.classList.add('autosave-dot--pulse');
        setTimeout(() => dot.classList.remove('autosave-dot--pulse'), 600);
      }
    }
  }, 5000);
});

function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
