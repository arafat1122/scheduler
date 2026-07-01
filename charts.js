/* ============================================================
   charts.js
   Chart.js visualizations (status pie, category bar, hourly line,
   weekly/monthly productivity trend), the Statistics panel, and
   the mini calendar with productivity highlighting.
   ============================================================ */

const Charts = {
  instances: {},
  calendarMonthOffset: 0,

  init() {
    if (typeof Chart === 'undefined') {
      console.warn('Chart.js failed to load — charts will be skipped.');
      return;
    }
    Chart.defaults.color = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary') || '#cbd5e1';
    Chart.defaults.font.family = "'Poppins', sans-serif";

    this.instances.statusPie = new Chart(document.getElementById('statusPieChart'), {
      type: 'pie',
      data: { labels: [], datasets: [{ data: [], backgroundColor: [] }] },
      options: { plugins: { legend: { position: 'bottom' } }, responsive: true, maintainAspectRatio: false }
    });

    this.instances.categoryBar = new Chart(document.getElementById('categoryBarChart'), {
      type: 'bar',
      data: { labels: [], datasets: [{ label: 'Tasks', data: [], backgroundColor: [] }] },
      options: { plugins: { legend: { display: false } }, responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
    });

    this.instances.hourlyLine = new Chart(document.getElementById('hourlyLineChart'), {
      type: 'line',
      data: { labels: [], datasets: [{ label: 'Completed', data: [], borderColor: '#60a5fa', backgroundColor: 'rgba(96,165,250,0.2)', fill: true, tension: 0.35 }] },
      options: { plugins: { legend: { display: false } }, responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
    });

    this.instances.weeklyTrend = new Chart(document.getElementById('weeklyTrendChart'), {
      type: 'line',
      data: { labels: [], datasets: [{ label: 'Productivity %', data: [], borderColor: '#a78bfa', backgroundColor: 'rgba(167,139,250,0.2)', fill: true, tension: 0.35 }] },
      options: { plugins: { legend: { display: false } }, responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100 } } }
    });

    document.getElementById('calPrevBtn')?.addEventListener('click', () => { this.calendarMonthOffset--; this.renderCalendar(); });
    document.getElementById('calNextBtn')?.addEventListener('click', () => { this.calendarMonthOffset++; this.renderCalendar(); });

    this.refreshAll();
  },

  refreshAll() {
    if (typeof Chart === 'undefined') return;
    this.updateStatusPie();
    this.updateCategoryBar();
    this.updateHourlyLine();
    this.updateWeeklyTrend();
    this.updateStatsPanel();
    this.renderCalendar();
  },

  updateStatusPie() {
    const tasks = TaskStore.getAll().filter(isToday);
    const labels = Object.keys(STATUSES);
    const data = labels.map(s => tasks.filter(t => t.status === s).length);
    const colors = labels.map(s => STATUSES[s].color);
    const chart = this.instances.statusPie;
    chart.data.labels = labels;
    chart.data.datasets[0].data = data;
    chart.data.datasets[0].backgroundColor = colors;
    chart.update();
  },

  updateCategoryBar() {
    const tasks = TaskStore.getAll().filter(isToday);
    const labels = Object.keys(CATEGORIES);
    const data = labels.map(c => tasks.filter(t => t.category === c).length);
    const colors = labels.map(c => CATEGORIES[c].color);
    const chart = this.instances.categoryBar;
    chart.data.labels = labels;
    chart.data.datasets[0].data = data;
    chart.data.datasets[0].backgroundColor = colors;
    chart.update();
  },

  updateHourlyLine() {
    const tasks = TaskStore.getAll().filter(isToday);
    const labels = Array.from({ length: 24 }, (_, h) => formatHour(h));
    const data = Array.from({ length: 24 }, (_, h) => tasks.filter(t => t.hour === h && t.status === 'Completed').length);
    const chart = this.instances.hourlyLine;
    chart.data.labels = labels;
    chart.data.datasets[0].data = data;
    chart.update();
  },

  updateWeeklyTrend() {
    const log = StreakStore.get().log || {};
    const days = Object.keys(log).sort().slice(-14);
    const chart = this.instances.weeklyTrend;
    chart.data.labels = days.map(d => d.slice(5)); // MM-DD
    chart.data.datasets[0].data = days.map(d => log[d]);
    chart.update();
  },

  updateStatsPanel() {
    const stats = TaskStore.stats();
    const streak = StreakStore.get();
    const completedTasks = TaskStore.getAll().filter(t => t.status === 'Completed' && t.completedAt);
    const avgMinutes = completedTasks.length
      ? Math.round(completedTasks.reduce((sum, t) => sum + ((t.completedAt - t.createdAt) / 60000), 0) / completedTasks.length)
      : 0;

    const log = streak.log || {};
    const entries = Object.entries(log);
    let bestDay = '—', worstDay = '—';
    if (entries.length) {
      entries.sort((a, b) => b[1] - a[1]);
      bestDay = `${entries[0][0]} (${entries[0][1]}%)`;
      worstDay = `${entries[entries.length - 1][0]} (${entries[entries.length - 1][1]}%)`;
    }

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('stpTotal', stats.total);
    set('stpCompleted', stats.completed);
    set('stpPending', stats.pending);
    set('stpMissed', stats.missed);
    set('stpRate', stats.productivity + '%');
    set('stpAvgTime', avgMinutes + ' min');
    set('stpLongestStreak', streak.longest);
    set('stpCurrentStreak', streak.current);
    set('stpBestDay', bestDay);
    set('stpWorstDay', worstDay);
  },

  renderCalendar() {
    const container = document.getElementById('miniCalendar');
    if (!container) return;
    const now = new Date();
    const viewDate = new Date(now.getFullYear(), now.getMonth() + this.calendarMonthOffset, 1);
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const log = StreakStore.get().log || {};

    const monthLabel = document.getElementById('calMonthLabel');
    if (monthLabel) monthLabel.textContent = viewDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

    let cells = '';
    const weekdayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    cells += weekdayNames.map(d => `<div class="cal-weekday">${d}</div>`).join('');
    for (let i = 0; i < firstWeekday; i++) cells += `<div class="cal-cell cal-cell--empty"></div>`;

    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(year, month, day);
      const key = todayKey(dateObj);
      const isToday = key === todayKey();
      const productivity = log[key];
      let cls = 'cal-cell';
      if (isToday) cls += ' cal-cell--today';
      if (productivity !== undefined) {
        if (productivity >= 80) cls += ' cal-cell--high';
        else if (productivity >= 40) cls += ' cal-cell--mid';
        else cls += ' cal-cell--missed';
      }
      cells += `<div class="${cls}" title="${productivity !== undefined ? productivity + '% productivity' : 'No data'}">${day}</div>`;
    }

    container.innerHTML = cells;
  }
};
