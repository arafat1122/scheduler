/* ============================================================
   theme.js
   Theme presets (mode + accent) and persistence.
   Themes are applied by toggling attributes on <html>, which
   CSS variables in style.css key off of.
   ============================================================ */

const THEME_ACCENTS = ['default', 'blue', 'purple', 'green', 'orange'];

const ThemeManager = {
  state: {
    mode: 'dark',      // 'dark' | 'light'
    accent: 'default'  // one of THEME_ACCENTS
  },

  init() {
    const saved = Storage.get(STORAGE_KEYS.THEME, null);
    if (saved) {
      this.state = { ...this.state, ...saved };
    } else {
      // Respect the OS preference on first visit.
      const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
      this.state.mode = prefersLight ? 'light' : 'dark';
    }
    this.apply();
  },

  apply() {
    document.documentElement.setAttribute('data-mode', this.state.mode);
    document.documentElement.setAttribute('data-accent', this.state.accent);
    this.persist();
    this.updateToggleIcon();
  },

  persist() {
    Storage.set(STORAGE_KEYS.THEME, this.state);
  },

  toggleMode() {
    this.state.mode = this.state.mode === 'dark' ? 'light' : 'dark';
    this.apply();
  },

  setAccent(accent) {
    if (!THEME_ACCENTS.includes(accent)) return;
    this.state.accent = accent;
    this.apply();
  },

  updateToggleIcon() {
    const icon = document.getElementById('themeToggleIcon');
    if (!icon) return;
    icon.className = this.state.mode === 'dark' ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
  }
};
