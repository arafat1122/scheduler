/* ============================================================
   storage.js
   Centralized localStorage persistence layer.
   Every other module reads/writes app data through this file
   so the storage format only needs to change in one place.
   ============================================================ */

const STORAGE_KEYS = {
  TASKS: 'dps_tasks',
  THEME: 'dps_theme',
  NOTES: 'dps_notes',
  HABITS: 'dps_habits',
  GOALS: 'dps_goals',
  SETTINGS: 'dps_settings',
  WATER: 'dps_water',
  POMODORO: 'dps_pomodoro_count',
  FOCUS_TIME: 'dps_focus_time_seconds',
  STREAK: 'dps_streak',
  CALENDAR_LOG: 'dps_calendar_log', // per-day completion snapshot
  UNDO_STACK: 'dps_undo_stack'
};

const Storage = {
  /** Read and JSON-parse a key, returning fallback if missing/broken. */
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null || raw === undefined) return fallback;
      return JSON.parse(raw);
    } catch (err) {
      console.warn(`Storage.get failed for "${key}":`, err);
      return fallback;
    }
  },

  /** JSON-stringify and persist a value under a key. */
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      console.warn(`Storage.set failed for "${key}":`, err);
      return false;
    }
  },

  remove(key) {
    localStorage.removeItem(key);
  },

  /** Wipe every key this app owns (used by "Reset app" in Settings). */
  clearAll() {
    Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
  },

  /** Bundle everything into one object for backup/export. */
  exportAll() {
    const bundle = {};
    Object.entries(STORAGE_KEYS).forEach(([name, key]) => {
      bundle[key] = this.get(key, null);
    });
    bundle.__exportedAt = new Date().toISOString();
    bundle.__version = 1;
    return bundle;
  },

  /** Restore a bundle produced by exportAll(). */
  importAll(bundle) {
    if (!bundle || typeof bundle !== 'object') return false;
    Object.values(STORAGE_KEYS).forEach(key => {
      if (key in bundle && bundle[key] !== null) {
        this.set(key, bundle[key]);
      }
    });
    return true;
  }
};

/** Generates a reasonably unique id without external libraries. */
function generateId() {
  return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

/** Returns a YYYY-MM-DD key for "today" (local time, not UTC). */
function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
