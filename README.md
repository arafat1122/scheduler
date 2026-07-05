# Daily Productivity Scheduler Pro

A glassmorphism daily scheduler built with plain HTML, CSS and JavaScript — no
frameworks, no build step. Open `index.html` in a browser and it works.

## Running it

1. Unzip / copy the `DailyScheduler` folder anywhere.
2. Double-click `index.html` (or open it from your browser with `File → Open`).
3. That's it — everything else, including charts and icons, loads from CDNs
   (Google Fonts, Font Awesome, Chart.js) the first time you're online. All
   your data is stored locally in the browser via `localStorage`, so it works
   offline after that first load, and nothing is ever sent to a server.

## File structure

```
DailyScheduler/
├── index.html        All markup: navbar, panels, reminder modal
├── style.css          Glassmorphism theme, layout, animations
├── storage.js          localStorage read/write helpers + backup/restore
├── theme.js            Dark/light + accent theme switching
├── script.js           Constants, Task/Settings stores, UI helpers, nav, clock, shortcuts
├── notification.js     Reminder engine: browser notifications, alarm tone, snooze
├── scheduler.js        24-hour timeline: add/edit/delete/search/filter/sort/drag-drop
├── dashboard.js        Stat cards, goals, habits, notes, water tracker, timers
├── charts.js           Chart.js visualizations, statistics panel, mini calendar
├── sounds/             (see note below)
└── images/             Reserved for any custom icons/screenshots you add
```

## A note on the alarm sound

The brief asked for `sounds/alarm.mp3`, but this build doesn't ship a binary
audio file — instead, `notification.js` synthesizes the alert tone live with
the Web Audio API (`ReminderSystem.playAlarmTone`). This means the alarm
always works, even freshly downloaded, with no missing-file silence, and it
still respects the in-app volume slider and sound toggle. If you'd rather use
a real recorded alarm, drop an `alarm.mp3` into `sounds/` and swap the
`playAlarmTone()` calls for an `<audio>` element pointed at that file.

## Feature map

- **Dashboard** — 11 live stat cards (tasks, productivity ring, streak, focus
  time, Pomodoro count, water, goal completion), motivational quotes/tips,
  and a water tracker.
- **Scheduler** — every hour from 12:00 AM to 11:00 PM, each holding any
  number of tasks with text, category, priority, status, color label,
  reminder toggle, and complete / duplicate / delete / countdown actions.
  Tasks can be dragged between hours. Instant search, filters, and 7 sort
  modes are built in, plus CSV export, print, and "export as PDF" (via the
  browser's print-to-PDF dialog).
- **Statistics** — completion rate, average completion time, longest/current
  streak, best/worst day, and four Chart.js charts (status pie, category bar,
  hourly line, 14-day productivity trend).
- **Calendar** — mini month view highlighting today and color-coding each
  day's productivity.
- **Notes** — color sticky notes with pin, edit-in-place, delete, and search.
- **Habits** — a starter set of habits (Wake Up Early, Exercise, Prayer,
  Reading, Coding, Networking Practice, Cloud Study, Meditation, Water
  Intake) plus custom habits, each tracking a streak.
- **Goals** — a simple daily goal list with a live completion percentage.
- **Timers** — Pomodoro (25/5/15 with auto-advance), a stopwatch with laps,
  and a countdown timer that can also be launched straight from a task card.
- **Settings** — accent color, dark/light mode, sound + volume, hourly water
  reminders, browser notification permission, fullscreen, JSON backup /
  restore, undo, and a full data reset.
- **Reminders** — when a task's hour arrives and its reminder toggle is on,
  the app plays a tone, flashes the tab title, fires a real browser
  notification (if permitted), and opens an in-page modal with Snooze 5/10,
  Dismiss, Complete, and Start Timer — so reminders still work even if
  notification permission is denied.
- **Everything persists** — tasks, notes, habits, goals, theme, settings, and
  streak history all survive a page reload via `localStorage`.

## Keyboard shortcuts

| Keys | Action |
|---|---|
| `Ctrl+N` | Jump to the scheduler and add a task |
| `Ctrl+S` | Confirms auto-save (saving is automatic) |
| `Delete` | Remove the selected task |
| `Space` | Toggle complete on the selected task |
| `Esc` | Close any open modal |

## Browser support notes

- Desktop notifications require the site to be granted permission (see
  Settings → "Enable browser notifications"); if denied or unsupported, the
  in-page reminder modal still fires every time.
- `backdrop-filter` (the frosted-glass blur) needs a reasonably modern
  browser — Chrome, Edge, Safari, and Firefox 103+ all support it.

  ---
  Live Demo Link- https://arafat1122.github.io/scheduler/
