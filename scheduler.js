/* ============================================================
   scheduler.js
   Renders the 12 AM → 11 PM timeline, and owns all task-level
   interactions: add / edit / delete / duplicate / complete /
   collapse, plus search, filter, sort and drag & drop.
   ============================================================ */

const Scheduler = {
  selectedTaskId: null,
  query: '',
  filter: 'all',
  sort: 'time',
  collapsedHours: new Set(),
  dragTaskId: null,

  init() {
    this.container = document.getElementById('timelineContainer');

    document.getElementById('taskSearch')?.addEventListener('input', (e) => {
      this.query = e.target.value.trim().toLowerCase();
      this.render();
    });
    document.getElementById('taskFilter')?.addEventListener('change', (e) => {
      this.filter = e.target.value;
      this.render();
    });
    document.getElementById('taskSort')?.addEventListener('change', (e) => {
      this.sort = e.target.value;
      this.render();
    });
    document.getElementById('collapseAllBtn')?.addEventListener('click', () => {
      const allCollapsed = this.collapsedHours.size === 24;
      this.collapsedHours = allCollapsed ? new Set() : new Set(Array.from({ length: 24 }, (_, i) => i));
      this.render();
    });

    // Event delegation for everything inside the timeline.
    this.container.addEventListener('click', (e) => this.handleClick(e));
    this.container.addEventListener('change', (e) => this.handleChange(e));
    this.container.addEventListener('dragstart', (e) => this.handleDragStart(e));
    this.container.addEventListener('dragover', (e) => this.handleDragOver(e));
    this.container.addEventListener('drop', (e) => this.handleDrop(e));
    this.container.addEventListener('dragend', () => this.container.querySelectorAll('.hour-slot--dragover').forEach(el => el.classList.remove('hour-slot--dragover')));

    this.render();
  },

  focusFirstEmptyInput() {
    const firstAdd = this.container.querySelector('.hour-add-btn');
    firstAdd?.click();
  },

  /* ---------- Filtering / sorting pipeline ---------- */

  getVisibleTasks() {
    let tasks = TaskStore.getAll().filter(isToday);

    if (this.query) {
      tasks = tasks.filter(t =>
        (t.text || '').toLowerCase().includes(this.query) ||
        t.category.toLowerCase().includes(this.query) ||
        t.priority.toLowerCase().includes(this.query) ||
        t.status.toLowerCase().includes(this.query) ||
        formatHour(t.hour).toLowerCase().includes(this.query)
      );
    }

    switch (this.filter) {
      case 'completed': tasks = tasks.filter(t => t.status === 'Completed'); break;
      case 'pending': tasks = tasks.filter(t => t.status === 'Pending'); break;
      case 'missed': tasks = tasks.filter(t => t.status === 'Missed'); break;
      case 'highPriority': tasks = tasks.filter(t => t.priority === 'High' || t.priority === 'Critical'); break;
      case 'study': tasks = tasks.filter(t => t.category === 'Study'); break;
      case 'programming': tasks = tasks.filter(t => t.category === 'Programming'); break;
      case 'networking': tasks = tasks.filter(t => t.category === 'Networking' || t.category === 'CCNA'); break;
      case 'today': break; // the board is always "today" in this single-day model
      default: break;
    }

    const byPriorityOrder = (t) => PRIORITIES[t.priority]?.order ?? 0;
    switch (this.sort) {
      case 'priority': tasks.sort((a, b) => byPriorityOrder(b) - byPriorityOrder(a)); break;
      case 'category': tasks.sort((a, b) => a.category.localeCompare(b.category)); break;
      case 'status': tasks.sort((a, b) => a.status.localeCompare(b.status)); break;
      case 'alphabetical': tasks.sort((a, b) => (a.text || '').localeCompare(b.text || '')); break;
      case 'newest': tasks.sort((a, b) => b.createdAt - a.createdAt); break;
      case 'oldest': tasks.sort((a, b) => a.createdAt - b.createdAt); break;
      case 'time':
      default: tasks.sort((a, b) => a.hour - b.hour || a.createdAt - b.createdAt); break;
    }

    return tasks;
  },

  /* ---------- Rendering ---------- */

  render() {
    const visible = this.getVisibleTasks();
    const byHour = {};
    visible.forEach(t => { (byHour[t.hour] = byHour[t.hour] || []).push(t); });

    const isFiltering = this.query || this.filter !== 'all';
    let html = '';

    for (let hour = 0; hour < 24; hour++) {
      const tasksInHour = byHour[hour] || [];
      if (isFiltering && tasksInHour.length === 0) continue; // hide empty hours while searching/filtering

      const collapsed = this.collapsedHours.has(hour);
      html += `
        <div class="hour-slot ${collapsed ? 'hour-slot--collapsed' : ''}" data-hour="${hour}">
          <div class="hour-slot__header">
            <button class="hour-collapse-btn" data-action="collapseHour" data-hour="${hour}" aria-label="Collapse hour">
              <i class="fa-solid fa-chevron-${collapsed ? 'right' : 'down'}"></i>
            </button>
            <span class="hour-slot__time">${formatHour(hour)}</span>
            <span class="hour-slot__count">${tasksInHour.length} task${tasksInHour.length === 1 ? '' : 's'}</span>
            <button class="hour-add-btn" data-action="addTask" data-hour="${hour}" aria-label="Add task at ${formatHour(hour)}">
              <i class="fa-solid fa-plus"></i> Add
            </button>
          </div>
          <div class="hour-slot__body">
            ${tasksInHour.map(t => this.renderTaskCard(t)).join('') || `<p class="hour-slot__empty">No tasks yet.</p>`}
          </div>
        </div>`;
    }

    if (!html) {
      html = `<div class="empty-state"><i class="fa-solid fa-magnifying-glass"></i><p>No tasks match your search or filter.</p></div>`;
    }

    this.container.innerHTML = html;
  },

  renderTaskCard(task) {
    const cat = CATEGORIES[task.category] || CATEGORIES.Custom;
    const pr = PRIORITIES[task.priority] || PRIORITIES.Medium;
    const st = STATUSES[task.status] || STATUSES.Pending;
    const selected = task.id === this.selectedTaskId ? 'task-card--selected' : '';
    const completed = task.status === 'Completed' ? 'task-card--completed' : '';

    return `
    <div class="task-card ${selected} ${completed}" draggable="true" data-task-id="${task.id}" style="--task-color:${task.color || cat.color}" tabindex="0">
      <div class="task-card__colorbar" style="background:${task.color || cat.color}"></div>
      <div class="task-card__main">
        <input type="text" class="task-input" data-field="text" placeholder="What needs to happen at ${formatHour(task.hour)}?" value="${escapeHtml(task.text)}" aria-label="Task description">

        <div class="task-card__row">
          <select class="task-select" data-field="category" aria-label="Category">
            ${Object.keys(CATEGORIES).map(c => `<option value="${c}" ${c === task.category ? 'selected' : ''}>${CATEGORIES[c].icon} ${c}</option>`).join('')}
          </select>

          <select class="task-select" data-field="priority" aria-label="Priority">
            ${Object.keys(PRIORITIES).map(p => `<option value="${p}" ${p === task.priority ? 'selected' : ''}>${p}</option>`).join('')}
          </select>

          <select class="task-select" data-field="status" aria-label="Status">
            ${Object.keys(STATUSES).map(s => `<option value="${s}" ${s === task.status ? 'selected' : ''}>${s}</option>`).join('')}
          </select>

          <input type="color" class="task-color" data-field="color" value="${task.color || cat.color}" aria-label="Color label">

          <label class="task-reminder-toggle" title="Reminder">
            <input type="checkbox" data-field="reminder" ${task.reminder ? 'checked' : ''} aria-label="Enable reminder">
            <i class="fa-solid fa-bell"></i>
          </label>
        </div>

        <div class="task-card__row task-card__row--recurrence">
          <select class="task-select" data-field="recurrence" aria-label="Recurrence">
            <option value="daily" ${task.recurrence === 'daily' ? 'selected' : ''}>Daily</option>
            <option value="weekly" ${task.recurrence === 'weekly' ? 'selected' : ''}>Weekly</option>
            <option value="monthly" ${task.recurrence === 'monthly' ? 'selected' : ''}>Monthly</option>
            <option value="date" ${task.recurrence === 'date' ? 'selected' : ''}>Specific date</option>
          </select>
          <input type="text" class="task-input" data-field="weeklyDays" placeholder="Weekly days 0-6" value="${escapeHtml((task.weeklyDays || []).join(','))}" aria-label="Weekly days">
          <input type="number" class="task-input" data-field="monthlyDay" min="1" max="31" placeholder="Monthly day" value="${escapeHtml(task.monthlyDay || '')}" aria-label="Monthly day">
          <input type="date" class="task-input" data-field="specificDate" value="${escapeHtml(task.specificDate || '')}" aria-label="Specific date">
        </div>

        <div class="task-card__badges">
          <span class="badge" style="background:${pr.color}22;color:${pr.color};border-color:${pr.color}55">${task.priority}</span>
          <span class="badge" style="background:${st.color}22;color:${st.color};border-color:${st.color}55"><i class="fa-solid ${st.icon}"></i> ${task.status}</span>
          <span class="badge badge--muted">${cat.icon} ${task.category}</span>
        </div>
      </div>

      <div class="task-card__actions">
        <button data-action="complete" title="Mark complete"><i class="fa-solid fa-check"></i></button>
        <button data-action="duplicate" title="Duplicate"><i class="fa-solid fa-clone"></i></button>
        <button data-action="countdown" title="Start countdown"><i class="fa-solid fa-stopwatch"></i></button>
        <button data-action="delete" title="Delete" class="danger"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>`;
  },

  /* ---------- Event handling ---------- */

  handleClick(e) {
    const actionBtn = e.target.closest('[data-action]');
    if (!actionBtn) {
      const card = e.target.closest('.task-card');
      if (card) this.selectedTaskId = card.dataset.taskId;
      return;
    }
    const action = actionBtn.dataset.action;
    const hour = actionBtn.dataset.hour;
    const taskId = actionBtn.closest('.task-card')?.dataset.taskId;

    if (action === 'addTask') this.addTask(Number(hour));
    if (action === 'collapseHour') this.toggleCollapse(Number(hour));
    if (action === 'complete') this.toggleComplete(taskId);
    if (action === 'duplicate') this.duplicateTask(taskId);
    if (action === 'delete') this.deleteTask(taskId);
    if (action === 'countdown') this.startCountdownFor(taskId);
  },

  handleChange(e) {
    const card = e.target.closest('.task-card');
    if (!card) return;
    const field = e.target.dataset.field;
    if (!field) return;
    const taskId = card.dataset.taskId;
    let value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;

    if (field === 'weeklyDays') {
      value = String(value)
        .split(',')
        .map(item => item.trim())
        .filter(item => item !== '');
    }

    if (field === 'monthlyDay') {
      value = String(value).trim();
    }

    if (field === 'specificDate') {
      value = String(value).trim();
    }

    TaskStore.update(taskId, { [field]: value }, { silent: true });

    if (field === 'status' || field === 'category' || field === 'priority') {
      this.render(); // re-render to refresh badges/colors immediately
    }
    Dashboard.renderStatCards();
    Charts.refreshAll();
  },

  addTask(hour) {
    const task = TaskStore.add({ hour, text: '' });
    this.render();
    const card = this.container.querySelector(`[data-task-id="${task.id}"] .task-input`);
    card?.focus();
    UI.toast(`Task added at ${formatHour(hour)}.`, 'success');
  },

  deleteTask(taskId) {
    if (!taskId) return;
    TaskStore.remove(taskId);
    if (this.selectedTaskId === taskId) this.selectedTaskId = null;
    this.render();
    UI.toast('Task deleted. Use Undo to bring it back.', 'info');
  },

  duplicateTask(taskId) {
    if (!taskId) return;
    TaskStore.duplicate(taskId);
    this.render();
    UI.toast('Task duplicated.', 'success');
  },

  toggleComplete(taskId, force) {
    const task = TaskStore.getById(taskId);
    if (!task) return;
    const nextStatus = force || (task.status === 'Completed' ? 'Pending' : 'Completed');
    TaskStore.update(taskId, { status: nextStatus });
    this.render();
    Dashboard.renderStatCards();
    Charts.refreshAll();
    this.maybeCelebrate();
  },

  maybeCelebrate() {
    const stats = TaskStore.stats();
    if (stats.total > 0 && stats.completed === stats.total) {
      UI.confetti();
      UI.toast('🎉 All tasks complete for today!', 'success');
    }
  },

  toggleCollapse(hour) {
    if (this.collapsedHours.has(hour)) this.collapsedHours.delete(hour);
    else this.collapsedHours.add(hour);
    this.render();
  },

  startCountdownFor(taskId) {
    const task = TaskStore.getById(taskId);
    if (!task) return;
    Nav.show('timers');
    Timers.startCountdownForTask(task);
  },

  /* ---------- Drag & drop between hours ---------- */

  handleDragStart(e) {
    const card = e.target.closest('.task-card');
    if (!card) return;
    this.dragTaskId = card.dataset.taskId;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.dragTaskId);
  },

  handleDragOver(e) {
    const slot = e.target.closest('.hour-slot');
    if (!slot) return;
    e.preventDefault();
    this.container.querySelectorAll('.hour-slot--dragover').forEach(el => el.classList.remove('hour-slot--dragover'));
    slot.classList.add('hour-slot--dragover');
  },

  handleDrop(e) {
    const slot = e.target.closest('.hour-slot');
    if (!slot) return;
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain') || this.dragTaskId;
    const newHour = Number(slot.dataset.hour);
    if (taskId) {
      TaskStore.update(taskId, { hour: newHour });
      this.render();
      UI.toast(`Moved to ${formatHour(newHour)}.`, 'success');
    }
    this.dragTaskId = null;
  },

  /* ---------- Export / print ---------- */

  exportCSV() {
    const rows = [['Time', 'Task', 'Category', 'Priority', 'Status', 'Reminder']];
    TaskStore.getAll().sort((a, b) => a.hour - b.hour).forEach(t => {
      rows.push([formatHour(t.hour), t.text, t.category, t.priority, t.status, t.reminder ? 'Yes' : 'No']);
    });
    const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    downloadFile(`schedule-${todayKey()}.csv`, csv, 'text/csv');
  },

  printSchedule() {
    window.print();
  }
};
