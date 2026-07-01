/* ============================================================
   dashboard.js
   Dashboard stat cards, Daily Goals, Habit Tracker, Sticky Notes,
   Water Reminder tracker, motivational rotator, and the
   Pomodoro / Stopwatch / Countdown timers.
   ============================================================ */

const DEFAULT_HABITS = ['Wake Up Early', 'Exercise', 'Prayer', 'Reading', 'Coding', 'Networking Practice', 'Cloud Study', 'Meditation', 'Water Intake'];
const NOTE_COLORS = ['#fde68a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#e9d5ff', '#fecaca'];
const WATER_GOAL = 8;

/* ---------- Goal store ---------- */
const GoalStore = {
  getAll() { return Storage.get(STORAGE_KEYS.GOALS, []); },
  save(goals) { Storage.set(STORAGE_KEYS.GOALS, goals); },
  add(text) {
    const goals = this.getAll();
    goals.push({ id: generateId(), text, done: false, createdAt: Date.now() });
    this.save(goals);
  },
  toggle(id) {
    const goals = this.getAll().map(g => g.id === id ? { ...g, done: !g.done } : g);
    this.save(goals);
  },
  remove(id) {
    this.save(this.getAll().filter(g => g.id !== id));
  },
  completionRate() {
    const goals = this.getAll();
    if (!goals.length) return 0;
    return Math.round((goals.filter(g => g.done).length / goals.length) * 100);
  }
};

/* ---------- Habit store ---------- */
const HabitStore = {
  getAll() {
    let habits = Storage.get(STORAGE_KEYS.HABITS, null);
    if (!habits) {
      habits = DEFAULT_HABITS.map(name => ({ id: generateId(), name, streak: 0, history: {} }));
      this.save(habits);
    }
    return habits;
  },
  save(habits) { Storage.set(STORAGE_KEYS.HABITS, habits); },
  add(name) {
    const habits = this.getAll();
    habits.push({ id: generateId(), name, streak: 0, history: {} });
    this.save(habits);
  },
  toggleToday(id) {
    const habits = this.getAll();
    const key = todayKey();
    const habit = habits.find(h => h.id === id);
    if (!habit) return;
    const wasChecked = !!habit.history[key];
    habit.history[key] = !wasChecked;
    habit.streak = wasChecked ? Math.max(0, habit.streak - 1) : habit.streak + 1;
    this.save(habits);
  },
  remove(id) {
    this.save(this.getAll().filter(h => h.id !== id));
  }
};

/* ---------- Note store ---------- */
const NoteStore = {
  getAll() { return Storage.get(STORAGE_KEYS.NOTES, []); },
  save(notes) { Storage.set(STORAGE_KEYS.NOTES, notes); },
  add(text, color) {
    const notes = this.getAll();
    notes.unshift({ id: generateId(), text, color, pinned: false, createdAt: Date.now() });
    this.save(notes);
  },
  update(id, patch) {
    this.save(this.getAll().map(n => n.id === id ? { ...n, ...patch } : n));
  },
  remove(id) {
    this.save(this.getAll().filter(n => n.id !== id));
  },
  togglePin(id) {
    this.save(this.getAll().map(n => n.id === id ? { ...n, pinned: !n.pinned } : n));
  }
};

/* ---------- Water store ---------- */
const WaterStore = {
  get() {
    const data = Storage.get(STORAGE_KEYS.WATER, { day: todayKey(), count: 0 });
    if (data.day !== todayKey()) return { day: todayKey(), count: 0 }; // new day resets
    return data;
  },
  add(delta) {
    const data = this.get();
    data.count = Math.max(0, data.count + delta);
    Storage.set(STORAGE_KEYS.WATER, data);
    return data;
  }
};

/* ============================================================
   Dashboard controller
   ============================================================ */
const Dashboard = {
  init() {
    // Goals
    document.getElementById('goalForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('goalInput');
      if (input.value.trim()) {
        GoalStore.add(input.value.trim());
        input.value = '';
        this.renderGoals();
        this.renderStatCards();
      }
    });
    document.getElementById('goalList')?.addEventListener('click', (e) => {
      const id = e.target.closest('[data-goal-id]')?.dataset.goalId;
      if (!id) return;
      if (e.target.closest('[data-goal-action="toggle"]')) { GoalStore.toggle(id); this.renderGoals(); this.renderStatCards(); }
      if (e.target.closest('[data-goal-action="remove"]')) { GoalStore.remove(id); this.renderGoals(); this.renderStatCards(); }
    });

    // Habits
    document.getElementById('habitForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('habitInput');
      if (input.value.trim()) {
        HabitStore.add(input.value.trim());
        input.value = '';
        this.renderHabits();
      }
    });
    document.getElementById('habitList')?.addEventListener('click', (e) => {
      const id = e.target.closest('[data-habit-id]')?.dataset.habitId;
      if (!id) return;
      if (e.target.closest('[data-habit-action="toggle"]')) { HabitStore.toggleToday(id); this.renderHabits(); }
      if (e.target.closest('[data-habit-action="remove"]')) { HabitStore.remove(id); this.renderHabits(); }
    });

    // Notes
    document.getElementById('noteForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('noteInput');
      if (input.value.trim()) {
        NoteStore.add(input.value.trim(), NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)]);
        input.value = '';
        this.renderNotes();
      }
    });
    document.getElementById('noteSearch')?.addEventListener('input', (e) => {
      this.noteQuery = e.target.value.toLowerCase();
      this.renderNotes();
    });
    document.getElementById('noteList')?.addEventListener('click', (e) => {
      const id = e.target.closest('[data-note-id]')?.dataset.noteId;
      if (!id) return;
      if (e.target.closest('[data-note-action="pin"]')) { NoteStore.togglePin(id); this.renderNotes(); }
      if (e.target.closest('[data-note-action="remove"]')) { NoteStore.remove(id); this.renderNotes(); }
    });
    document.getElementById('noteList')?.addEventListener('input', (e) => {
      const id = e.target.closest('[data-note-id]')?.dataset.noteId;
      if (id && e.target.classList.contains('note-text')) {
        NoteStore.update(id, { text: e.target.value });
      }
    });

    // Water
    document.getElementById('waterAddBtn')?.addEventListener('click', () => { WaterStore.add(1); this.renderWater(); this.renderStatCards(); });
    document.getElementById('waterRemoveBtn')?.addEventListener('click', () => { WaterStore.add(-1); this.renderWater(); this.renderStatCards(); });

    // Export / print buttons (scheduler-related but live in dashboard toolbar)
    document.getElementById('exportCsvBtn')?.addEventListener('click', () => Scheduler.exportCSV());
    document.getElementById('printBtn')?.addEventListener('click', () => Scheduler.printSchedule());
    document.getElementById('exportPdfBtn')?.addEventListener('click', () => {
      UI.toast('Opening the print dialog — choose "Save as PDF" as the destination.', 'info');
      setTimeout(() => window.print(), 400);
    });

    this.renderGoals();
    this.renderHabits();
    this.renderNotes();
    this.renderWater();
    Timers.init();
  },

  renderStatCards() {
    const stats = TaskStore.stats();
    const streak = StreakStore.get();
    const water = WaterStore.get();
    const focusSeconds = Storage.get(STORAGE_KEYS.FOCUS_TIME, 0);
    const pomodoroCount = Storage.get(STORAGE_KEYS.POMODORO, 0);

    const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };

    set('statTotal', stats.total);
    set('statCompleted', stats.completed);
    set('statPending', stats.pending);
    set('statMissed', stats.missed);
    set('statInProgress', stats.inProgress);
    set('statProductivity', stats.productivity + '%');
    set('statStreak', streak.current + ' 🔥');
    set('statFocusTime', formatDuration(focusSeconds));
    set('statPomodoro', pomodoroCount);
    set('statWater', `${water.count}/${WATER_GOAL}`);
    set('statGoals', GoalStore.completionRate() + '%');

    const ring = document.getElementById('productivityRing');
    if (ring) ring.style.setProperty('--pct', stats.productivity);
  },

  renderGoals() {
    const list = document.getElementById('goalList');
    if (!list) return;
    const goals = GoalStore.getAll();
    list.innerHTML = goals.length ? goals.map(g => `
      <li class="goal-item ${g.done ? 'goal-item--done' : ''}" data-goal-id="${g.id}">
        <button class="goal-check" data-goal-action="toggle" aria-label="Toggle goal"><i class="fa-solid ${g.done ? 'fa-square-check' : 'fa-square'}"></i></button>
        <span>${escapeHtml(g.text)}</span>
        <button class="goal-remove" data-goal-action="remove" aria-label="Remove goal"><i class="fa-solid fa-xmark"></i></button>
      </li>`).join('') : `<li class="empty-hint">No goals yet — add your first one above.</li>`;

    const pct = GoalStore.completionRate();
    const bar = document.getElementById('goalProgressBar');
    if (bar) bar.style.width = pct + '%';
    const label = document.getElementById('goalProgressLabel');
    if (label) label.textContent = pct + '% complete';
  },

  renderHabits() {
    const list = document.getElementById('habitList');
    if (!list) return;
    const habits = HabitStore.getAll();
    const key = todayKey();
    list.innerHTML = habits.map(h => `
      <li class="habit-item" data-habit-id="${h.id}">
        <button class="habit-check ${h.history[key] ? 'habit-check--on' : ''}" data-habit-action="toggle" aria-label="Toggle habit for today">
          <i class="fa-solid ${h.history[key] ? 'fa-circle-check' : 'fa-circle'}"></i>
        </button>
        <span class="habit-name">${escapeHtml(h.name)}</span>
        <span class="habit-streak">🔥 ${h.streak}</span>
        <button class="habit-remove" data-habit-action="remove" aria-label="Remove habit"><i class="fa-solid fa-trash"></i></button>
      </li>`).join('');
  },

  renderNotes() {
    const list = document.getElementById('noteList');
    if (!list) return;
    let notes = NoteStore.getAll();
    if (this.noteQuery) notes = notes.filter(n => n.text.toLowerCase().includes(this.noteQuery));
    notes = [...notes].sort((a, b) => (b.pinned - a.pinned) || (b.createdAt - a.createdAt));

    list.innerHTML = notes.length ? notes.map(n => `
      <div class="sticky-note ${n.pinned ? 'sticky-note--pinned' : ''}" data-note-id="${n.id}" style="background:${n.color}">
        <div class="sticky-note__toolbar">
          <button data-note-action="pin" aria-label="Pin note"><i class="fa-solid fa-thumbtack"></i></button>
          <button data-note-action="remove" aria-label="Delete note"><i class="fa-solid fa-trash"></i></button>
        </div>
        <textarea class="note-text" rows="4">${escapeHtml(n.text)}</textarea>
      </div>`).join('') : `<p class="empty-hint">No notes match — try a different search, or add a new one.</p>`;
  },

  renderWater() {
    const water = WaterStore.get();
    const label = document.getElementById('waterCountLabel');
    if (label) label.textContent = `${water.count} / ${WATER_GOAL} glasses`;
    const fill = document.getElementById('waterFill');
    if (fill) fill.style.height = Math.min(100, (water.count / WATER_GOAL) * 100) + '%';
  }
};

function formatDuration(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/* ============================================================
   Motivation rotator
   ============================================================ */
const Motivation = {
  rotate() {
    this.setText('quoteText', pickRandom(MOTIVATIONAL_QUOTES));
    this.setText('tipText', pickRandom(PRODUCTIVITY_TIPS));
    this.setText('progTipText', pickRandom(PROGRAMMING_TIPS));
    this.setText('netTipText', pickRandom(NETWORKING_TIPS));
    document.getElementById('newQuoteBtn')?.addEventListener('click', () => this.rotate(), { once: true });
  },
  setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }
};

function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

/* ============================================================
   Timers: Pomodoro, Stopwatch, Countdown
   ============================================================ */
const Timers = {
  pomodoro: { mode: 'work', secondsLeft: 25 * 60, running: false, intervalId: null, sessionsCompleted: 0 },
  stopwatch: { seconds: 0, running: false, intervalId: null, laps: [] },
  countdown: { seconds: 0, running: false, intervalId: null, taskText: '' },

  init() {
    // Pomodoro controls
    document.getElementById('pomodoroStartBtn')?.addEventListener('click', () => this.pomodoroStart());
    document.getElementById('pomodoroPauseBtn')?.addEventListener('click', () => this.pomodoroPause());
    document.getElementById('pomodoroResetBtn')?.addEventListener('click', () => this.pomodoroReset());
    this.renderPomodoro();

    // Stopwatch controls
    document.getElementById('stopwatchStartBtn')?.addEventListener('click', () => this.stopwatchStart());
    document.getElementById('stopwatchPauseBtn')?.addEventListener('click', () => this.stopwatchPause());
    document.getElementById('stopwatchResetBtn')?.addEventListener('click', () => this.stopwatchReset());
    document.getElementById('stopwatchLapBtn')?.addEventListener('click', () => this.stopwatchLap());
    this.renderStopwatch();

    // Countdown controls
    document.getElementById('countdownStartBtn')?.addEventListener('click', () => {
      // Only load a fresh duration if nothing is currently counting down
      // (so pressing Start again after Pause resumes instead of resetting).
      if (this.countdown.seconds <= 0) {
        const mins = Number(document.getElementById('countdownMinutes').value || 5);
        this.countdown.seconds = mins * 60;
        this.countdown.taskText = 'Custom countdown';
      }
      this.countdownStart();
    });
    document.getElementById('countdownPauseBtn')?.addEventListener('click', () => this.countdownPause());
    document.getElementById('countdownResetBtn')?.addEventListener('click', () => this.countdownReset());
    this.renderCountdown();
  },

  /* --- Pomodoro --- */
  pomodoroDurations: { work: 25 * 60, shortBreak: 5 * 60, longBreak: 15 * 60 },

  pomodoroStart() {
    if (this.pomodoro.running) return;
    this.pomodoro.running = true;
    this.pomodoro.intervalId = setInterval(() => {
      this.pomodoro.secondsLeft--;
      if (this.pomodoro.mode === 'work') {
        Storage.set(STORAGE_KEYS.FOCUS_TIME, Storage.get(STORAGE_KEYS.FOCUS_TIME, 0) + 1);
      }
      if (this.pomodoro.secondsLeft <= 0) this.pomodoroAdvance();
      this.renderPomodoro();
      if (this.pomodoro.mode === 'work') Dashboard.renderStatCards();
    }, 1000);
    this.renderPomodoro();
  },

  pomodoroPause() {
    this.pomodoro.running = false;
    clearInterval(this.pomodoro.intervalId);
    this.renderPomodoro();
  },

  pomodoroReset() {
    this.pomodoroPause();
    this.pomodoro.mode = 'work';
    this.pomodoro.secondsLeft = this.pomodoroDurations.work;
    this.renderPomodoro();
  },

  pomodoroAdvance() {
    ReminderSystem.playAlarmTone();
    if (this.pomodoro.mode === 'work') {
      this.pomodoro.sessionsCompleted++;
      Storage.set(STORAGE_KEYS.POMODORO, Storage.get(STORAGE_KEYS.POMODORO, 0) + 1);
      const isLong = this.pomodoro.sessionsCompleted % 4 === 0;
      this.pomodoro.mode = isLong ? 'longBreak' : 'shortBreak';
      UI.toast(`Pomodoro complete! Starting ${isLong ? 'a long' : 'a short'} break.`, 'success');
    } else {
      this.pomodoro.mode = 'work';
      UI.toast('Break over — back to focus.', 'info');
    }
    this.pomodoro.secondsLeft = this.pomodoroDurations[this.pomodoro.mode];
    Dashboard.renderStatCards();
    // Auto-continue into the next session automatically.
  },

  renderPomodoro() {
    const label = { work: 'Focus', shortBreak: 'Short Break', longBreak: 'Long Break' }[this.pomodoro.mode];
    const el = document.getElementById('pomodoroTime');
    if (el) el.textContent = formatClock(this.pomodoro.secondsLeft);
    const modeEl = document.getElementById('pomodoroMode');
    if (modeEl) modeEl.textContent = label;
    const startBtn = document.getElementById('pomodoroStartBtn');
    if (startBtn) startBtn.disabled = this.pomodoro.running;
    const ring = document.getElementById('pomodoroRing');
    if (ring) {
      const total = this.pomodoroDurations[this.pomodoro.mode];
      const pct = 100 - Math.round((this.pomodoro.secondsLeft / total) * 100);
      ring.style.setProperty('--pct', pct);
    }
  },

  /* --- Stopwatch --- */
  stopwatchStart() {
    if (this.stopwatch.running) return;
    this.stopwatch.running = true;
    this.stopwatch.intervalId = setInterval(() => {
      this.stopwatch.seconds++;
      this.renderStopwatch();
    }, 1000);
  },
  stopwatchPause() {
    this.stopwatch.running = false;
    clearInterval(this.stopwatch.intervalId);
  },
  stopwatchReset() {
    this.stopwatchPause();
    this.stopwatch.seconds = 0;
    this.stopwatch.laps = [];
    this.renderStopwatch();
  },
  stopwatchLap() {
    this.stopwatch.laps.unshift(this.stopwatch.seconds);
    this.renderStopwatch();
  },
  renderStopwatch() {
    const el = document.getElementById('stopwatchTime');
    if (el) el.textContent = formatClock(this.stopwatch.seconds);
    const lapList = document.getElementById('stopwatchLaps');
    if (lapList) {
      lapList.innerHTML = this.stopwatch.laps.map((s, i) => `<li>Lap ${this.stopwatch.laps.length - i}: ${formatClock(s)}</li>`).join('');
    }
  },

  /* --- Countdown (per-task or ad-hoc) --- */
  startCountdownForTask(task) {
    this.countdown.taskText = task.text || 'Task';
    this.countdown.seconds = 15 * 60;
    this.countdownStart();
  },
  countdownStart() {
    if (this.countdown.running) return;
    if (this.countdown.seconds <= 0) return;
    this.countdown.running = true;
    this.countdown.intervalId = setInterval(() => {
      this.countdown.seconds--;
      if (this.countdown.seconds <= 0) {
        this.countdownPause();
        ReminderSystem.playAlarmTone();
        UI.toast(`⏱️ Countdown finished: ${this.countdown.taskText}`, 'success');
      }
      this.renderCountdown();
    }, 1000);
    this.renderCountdown();
  },
  countdownPause() {
    this.countdown.running = false;
    clearInterval(this.countdown.intervalId);
    this.renderCountdown();
  },
  countdownReset() {
    this.countdownPause();
    this.countdown.seconds = 0;
    this.renderCountdown();
  },
  renderCountdown() {
    const el = document.getElementById('countdownTime');
    if (el) el.textContent = formatClock(this.countdown.seconds);
    const label = document.getElementById('countdownLabel');
    if (label) label.textContent = this.countdown.taskText ? `For: ${this.countdown.taskText}` : '';
  }
};

function formatClock(totalSeconds) {
  const s = Math.max(0, totalSeconds);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}
