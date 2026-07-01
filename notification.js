/* ============================================================
   notification.js
   Reminder engine for scheduled tasks and hourly water reminders.

   Note on the alarm sound: rather than shipping a binary alarm.mp3
   (which can't be generated as real audio here), the alert tone is
   synthesized live with the Web Audio API in playAlarmTone(). This
   avoids a silent/broken <audio src="sounds/alarm.mp3"> and still
   gives a real, working alarm sound with volume control.
   ============================================================ */

const ReminderSystem = {
  permission: 'default',
  titleFlashInterval: null,
  originalTitle: document.title,
  checkTimer: null,
  audioCtx: null,

  init() {
    if ('Notification' in window) {
      this.permission = Notification.permission;
    }
    // Check every 20 seconds for due reminders + hourly water nudges.
    this.checkTimer = setInterval(() => this.tick(), 20000);
    this.tick();
  },

  async requestPermission() {
    if (!('Notification' in window)) {
      UI.toast('Browser notifications are not supported here — in-page alerts will be used instead.', 'info');
      return 'unsupported';
    }
    const result = await Notification.requestPermission();
    this.permission = result;
    UI.toast(result === 'granted' ? 'Notifications enabled.' : 'Notifications blocked — in-page alerts will be used instead.', result === 'granted' ? 'success' : 'info');
    return result;
  },

  /** Runs periodically: finds tasks whose hour has arrived and fires reminders. */
  tick() {
    const now = new Date();
    const currentHour = now.getHours();
    const tasks = TaskStore.getAll();
    tasks.forEach(task => {
      if (!task.reminder) return;
      if (task.status === 'completed' || task.status === 'cancelled') return;
      if (!isToday(task)) return;
      if (task.snoozedUntil && Date.now() < task.snoozedUntil) return;

      const dueNow = task.hour === currentHour;
      const alreadyFiredThisHour = task.lastFiredHourKey === `${todayKey()}_${currentHour}`;

      if (dueNow && !alreadyFiredThisHour) {
        task.lastFiredHourKey = `${todayKey()}_${currentHour}`;
        task.snoozedUntil = null;
        TaskStore.update(task.id, task, { silent: true });
        this.fireTaskReminder(task);
      }
    });

    // Hourly water reminder, once per hour on the hour-ish tick.
    const settings = SettingsStore.get();
    if (settings.waterReminders) {
      const waterKey = `${todayKey()}_${currentHour}`;
      if (SettingsStore.get().lastWaterPromptKey !== waterKey) {
        SettingsStore.update({ lastWaterPromptKey: waterKey });
        // Skip the very first tick after page load to avoid an instant popup.
        if (this._booted) this.fireWaterReminder();
      }
    }
    this._booted = true;
  },

  fireTaskReminder(task) {
    const cat = CATEGORIES[task.category] || CATEGORIES.Custom;
    const title = `⏰ Time for: ${task.text || 'your task'}`;
    const body = `${cat.icon} ${task.category} · ${formatHour(task.hour)} · Priority: ${task.priority}`;

    this.playAlarmTone();
    this.flashTitle('⏰ Reminder!');
    this.showBrowserNotification(title, body);
    UI.openReminderModal(task, title, body);
  },

  fireWaterReminder() {
    this.playAlarmTone(true);
    this.showBrowserNotification('💧 Hydration check', 'Time for a glass of water!');
    UI.toast('💧 Hourly reminder: drink a glass of water!', 'info');
  },

  showBrowserNotification(title, body) {
    if (this.permission === 'granted' && 'Notification' in window) {
      try {
        const n = new Notification(title, { body, icon: undefined, tag: title });
        n.onclick = () => window.focus();
      } catch (err) {
        console.warn('Notification failed, falling back to in-page alert.', err);
      }
    }
  },

  flashTitle(flashText) {
    if (this.titleFlashInterval) clearInterval(this.titleFlashInterval);
    let showingFlash = true;
    let flashes = 0;
    this.titleFlashInterval = setInterval(() => {
      document.title = showingFlash ? flashText : this.originalTitle;
      showingFlash = !showingFlash;
      flashes++;
      if (flashes > 10) {
        clearInterval(this.titleFlashInterval);
        document.title = this.originalTitle;
      }
    }, 800);
    // Stop flashing as soon as the user looks at the tab.
    const stop = () => {
      if (document.visibilityState === 'visible') {
        clearInterval(this.titleFlashInterval);
        document.title = this.originalTitle;
        document.removeEventListener('visibilitychange', stop);
      }
    };
    document.addEventListener('visibilitychange', stop);
  },

  /** Synthesizes a short two-tone alarm beep with the Web Audio API. */
  playAlarmTone(soft = false) {
    const settings = SettingsStore.get();
    if (!settings.soundEnabled) return;
    try {
      if (!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = this.audioCtx;
      const volume = (settings.volume ?? 70) / 100 * (soft ? 0.5 : 1);
      const now = ctx.currentTime;
      const tones = soft ? [880] : [880, 660, 880, 660];

      tones.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const start = now + i * 0.22;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(volume, start + 0.03);
        gain.gain.linearRampToValueAtTime(0, start + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.22);
      });
    } catch (err) {
      console.warn('Web Audio alarm failed:', err);
    }
  },

  snooze(taskId, minutes) {
    const task = TaskStore.getById(taskId);
    if (!task) return;
    task.snoozedUntil = Date.now() + minutes * 60 * 1000;
    TaskStore.update(taskId, task, { silent: true });
    UI.toast(`Snoozed for ${minutes} minutes.`, 'info');
    UI.closeReminderModal();
  }
};

/** Formats a 0-23 hour integer as "12:00 AM" style label. */
function formatHour(hour) {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const suffix = hour < 12 ? 'AM' : 'PM';
  return `${String(h12).padStart(2, '0')}:00 ${suffix}`;
}
