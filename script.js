const $ = (id) => document.getElementById(id);

const defaultState = {
  mode: "study",
  running: false,
  studyMinutes: 50,
  breakMinutes: 5,
  remaining: 50 * 60,
  totalModeSeconds: 50 * 60,
  todaySeconds: 0,
  sessions: 0,
  goalMinutes: 240,
  tasks: [],
  subject: "DSA",
  streak: 1,
  lastDate: ""
};

let state = JSON.parse(localStorage.getItem("focusFlowState") || "null") || defaultState;
let interval = null;

const quotes = [
  "Small progress is still progress.",
  "Focus on what you can do right now.",
  "Your future self will thank you.",
  "Start before you feel ready.",
  "One session. One goal. No distractions.",
  "Consistency beats intensity."
];

function save() {
  localStorage.setItem("focusFlowState", JSON.stringify(state));
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function resetDailyIfNeeded() {
  const today = todayKey();
  if (state.lastDate !== today) {
    state.todaySeconds = 0;
    state.sessions = 0;
    state.lastDate = today;
    state.streak = Math.max(1, state.streak || 1);
    save();
  }
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatMinutes(mins) {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function renderDate() {
  const now = new Date();
  $("dayName").textContent = now.toLocaleDateString("en-IN", { weekday: "long" });
  $("dateText").textContent = now.toLocaleDateString("en-IN", {
    day: "numeric", month: "long", year: "numeric"
  });

  const hour = now.getHours();
  $("greeting").textContent =
    hour < 12 ? "Good morning." :
    hour < 18 ? "Good afternoon." : "Good evening.";
}

function setMode(mode, reset = true) {
  state.mode = mode;
  if (mode === "study") {
    state.totalModeSeconds = state.studyMinutes * 60;
    $("timerMode").textContent = "STUDY";
    $("timerHint").textContent = "Deep work";
    $("sessionLabel").textContent = "Focus session";
  } else if (mode === "short") {
    state.totalModeSeconds = state.breakMinutes * 60;
    $("timerMode").textContent = "BREAK";
    $("timerHint").textContent = "Recharge";
    $("sessionLabel").textContent = "Short break";
  } else {
    state.totalModeSeconds = 15 * 60;
    $("timerMode").textContent = "BREAK";
    $("timerHint").textContent = "Long recharge";
    $("sessionLabel").textContent = "Long break";
  }

  if (reset) state.remaining = state.totalModeSeconds;

  document.querySelectorAll(".mode").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.mode === mode);
  });

  updateTimer();
  save();
}

function updateTimer() {
  $("timer").textContent = formatTime(state.remaining);

  const radius = 128;
  const circumference = 2 * Math.PI * radius;
  const progress = state.remaining / state.totalModeSeconds;
  const offset = circumference * (1 - progress);

  $("ring").style.strokeDasharray = circumference;
  $("ring").style.strokeDashoffset = offset;

  document.title = `${formatTime(state.remaining)} • FocusFlow`;
}

function updateStats() {
  $("todayTime").textContent = formatMinutes(Math.floor(state.todaySeconds / 60));
  $("sessions").textContent = state.sessions;
  $("streak").textContent = `${state.streak} day${state.streak === 1 ? "" : "s"}`;

  const percent = Math.min(100, (state.todaySeconds / (state.goalMinutes * 60)) * 100);
  $("goalProgress").style.width = `${percent}%`;
  $("goalPercent").textContent = `${Math.round(percent)}%`;
  $("goalDone").textContent = `${Math.floor(state.todaySeconds / 60)} min completed`;
  $("goalMinutes").textContent = formatMinutes(state.goalMinutes);

  $("taskCount").textContent =
    `${state.tasks.filter(t => t.done).length}/${state.tasks.length}`;
}

function renderTasks() {
  const list = $("taskList");
  list.innerHTML = "";

  if (!state.tasks.length) {
    list.innerHTML = `<div style="color:var(--muted);font-size:11px;padding:18px 3px;">
      No tasks yet. Add something you want to study.
    </div>`;
    updateStats();
    return;
  }

  state.tasks.forEach(task => {
    const row = document.createElement("div");
    row.className = `task-item ${task.done ? "done" : ""}`;
    row.innerHTML = `
      <button class="task-check" aria-label="Complete task">${task.done ? "✓" : ""}</button>
      <div>
        <div class="task-title">${escapeHTML(task.title)}</div>
        <div class="task-tag">${escapeHTML(task.subject)}</div>
      </div>
      <button class="delete-task" aria-label="Delete task">×</button>
    `;

    row.querySelector(".task-check").onclick = () => {
      task.done = !task.done;
      save();
      renderTasks();
    };

    row.querySelector(".delete-task").onclick = () => {
      state.tasks = state.tasks.filter(t => t.id !== task.id);
      save();
      renderTasks();
    };

    list.appendChild(row);
  });

  updateStats();
}

function escapeHTML(str) {
  return str.replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[ch]));
}

function showToast(message) {
  $("toast").textContent = message;
  $("toast").classList.add("show");
  setTimeout(() => $("toast").classList.remove("show"), 2500);
}

function finishSession() {
  clearInterval(interval);
  interval = null;
  state.running = false;
  $("startBtn").innerHTML = "▶ Start";

  if (state.mode === "study") {
    state.sessions++;
    showToast("Study session complete ✨ Time for a break.");
    setMode("short");
  } else {
    showToast("Break complete. Ready to focus? 🚀");
    setMode("study");
  }

  save();
  updateStats();

  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("FocusFlow", { body: "Your session is complete!" });
  }
}

function tick() {
  if (state.remaining <= 0) {
    finishSession();
    return;
  }

  state.remaining--;

  if (state.mode === "study") state.todaySeconds++;

  updateTimer();
  updateStats();

  // Save periodically rather than every second.
  if (state.remaining % 10 === 0) save();
}

function startTimer() {
  if (state.running) return;
  state.running = true;
  $("startBtn").innerHTML = "Ⅱ Pause";
  interval = setInterval(tick, 1000);

  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
}

function pauseTimer() {
  state.running = false;
  clearInterval(interval);
  interval = null;
  $("startBtn").innerHTML = "▶ Resume";
  save();
}

function resetTimer() {
  pauseTimer();
  state.remaining = state.totalModeSeconds;
  $("startBtn").innerHTML = "▶ Start";
  updateTimer();
  save();
}

$("startBtn").onclick = () => state.running ? pauseTimer() : startTimer();
$("resetBtn").onclick = resetTimer;

$("skipBtn").onclick = () => {
  pauseTimer();
  if (state.mode === "study") setMode("short");
  else setMode("study");
};

document.querySelectorAll(".mode").forEach(btn => {
  btn.onclick = () => {
    pauseTimer();
    setMode(btn.dataset.mode);
  };
});

$("studyLength").onchange = (e) => {
  state.studyMinutes = Number(e.target.value);
  if (state.mode === "study") setMode("study");
  save();
};

$("breakLength").onchange = (e) => {
  state.breakMinutes = Number(e.target.value);
  if (state.mode === "short") setMode("short");
  save();
};

$("goalLength").onchange = (e) => {
  state.goalMinutes = Number(e.target.value);
  updateStats();
  save();
};

$("taskForm").onsubmit = (e) => {
  e.preventDefault();
  const input = $("taskInput");
  const title = input.value.trim();
  if (!title) return;

  state.tasks.push({
    id: Date.now(),
    title,
    subject: $("taskSubject").value,
    done: false
  });

  input.value = "";
  save();
  renderTasks();
};

document.querySelectorAll(".subject").forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll(".subject").forEach(x => x.classList.remove("active"));
    btn.classList.add("active");
    state.subject = btn.dataset.subject;
    $("currentSubject").textContent = state.subject;
    save();
  };
});

$("themeBtn").onclick = () => {
  document.body.classList.toggle("light");
  const light = document.body.classList.contains("light");
  $("themeBtn").textContent = light ? "☀" : "☾";
  localStorage.setItem("focusFlowTheme", light ? "light" : "dark");
};

function restore() {
  resetDailyIfNeeded();

  const theme = localStorage.getItem("focusFlowTheme");
  if (theme === "light") {
    document.body.classList.add("light");
    $("themeBtn").textContent = "☀";
  }

  $("studyLength").value = state.studyMinutes;
  $("breakLength").value = state.breakMinutes;
  $("goalLength").value = state.goalMinutes;
  $("currentSubject").textContent = state.subject;

  document.querySelectorAll(".subject").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.subject === state.subject);
  });

  setMode(state.mode, false);
  renderTasks();
  updateStats();
  renderDate();
  $("quote").textContent = quotes[new Date().getDate() % quotes.length];
}

restore();
