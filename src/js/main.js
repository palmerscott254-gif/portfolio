import {
  FALLBACK_PROJECTS,
  FILTERS,
  PROJECT_DEEP_DIVES,
  TERMINAL_HELP
} from "./constants.js";
import {
  getHealth,
  getProjects,
  getAnalyticsSummary,
  trackEvent,
  askAssistant,
  getArchiveStatus,
  syncArchiveNow,
  getLedger
} from "./api/client.js";
import { store, setState } from "./state/store.js";
import { renderFilterBar, renderProjectGrid } from "./components/projects.js";
import { initCursorGlow } from "./effects/cursor.js";
import { initParticleCanvas } from "./effects/particles.js";

const root = document.documentElement;
const desktop = document.getElementById("desktop");
const startMenu = document.getElementById("startMenu");
const startToggle = document.getElementById("startToggle");
const modeSelect = document.getElementById("modeSelect");
const themeToggle = document.getElementById("themeToggle");
const systemHealth = document.getElementById("systemHealth");
const projectFilterBar = document.getElementById("projectFilterBar");
const projectGrid = document.getElementById("projectGrid");
const projectTitle = document.getElementById("projectTitle");
const projectDesc = document.getElementById("projectDesc");
const projectMermaid = document.getElementById("projectMermaid");
const projectPerf = document.getElementById("projectPerf");
const projectForensic = document.getElementById("projectForensic");
const archiveSummary = document.getElementById("archiveSummary");
const archiveSyncBtn = document.getElementById("archiveSyncBtn");
const resetLayoutBtn = document.getElementById("resetLayoutBtn");
const ledgerHash = document.getElementById("ledgerHash");
const pulseVisitors = document.getElementById("pulseVisitors");
const pulseActivity = document.getElementById("pulseActivity");
const pulseSynced = document.getElementById("pulseSynced");
const terminalOutput = document.getElementById("terminalOutput");
const terminalForm = document.getElementById("terminalForm");
const terminalInput = document.getElementById("terminalInput");
const assistantLog = document.getElementById("assistantLog");
const assistantInput = document.getElementById("assistantInput");
const assistantSend = document.getElementById("assistantSend");
const eventsTotal = document.getElementById("eventsTotal");

function saveLayout() {
  localStorage.setItem("desktop.layout", JSON.stringify(store.windows));
}

function loadLayout() {
  try {
    const parsed = JSON.parse(localStorage.getItem("desktop.layout") || "{}");
    if (parsed && typeof parsed === "object") {
      const sanitized = Object.entries(parsed).reduce((acc, [key, value]) => {
        if (!value || typeof value !== "object") return acc;
        const next = {
          x: Number.isFinite(value.x) ? value.x : undefined,
          y: Number.isFinite(value.y) ? value.y : undefined,
          w: Number.isFinite(value.w) ? value.w : undefined,
          h: Number.isFinite(value.h) ? value.h : undefined,
          z: Number.isFinite(value.z) ? value.z : undefined,
          minimized: Boolean(value.minimized)
        };
        acc[key] = next;
        return acc;
      }, {});
      setState({ windows: sanitized });
    }
  } catch {
  }
}

function saveTerminalHistory() {
  localStorage.setItem("terminal.history", JSON.stringify(store.terminalHistory.slice(-200)));
}

function loadTerminalHistory() {
  try {
    const history = JSON.parse(localStorage.getItem("terminal.history") || "[]");
    if (Array.isArray(history)) {
      setState({ terminalHistory: history.slice(-200) });
    }
  } catch {
  }
}

function detectMode() {
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const lowPower = (navigator.hardwareConcurrency || 4) <= 4 || (navigator.deviceMemory || 4) <= 4;
  if (reduced || lowPower) return "legacy";
  if ("xr" in navigator) return "spatial";
  return "modern";
}

function applyTheme(theme) {
  root.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
  setState({ theme });
}

function setupTheme() {
  const saved = localStorage.getItem("theme") || "dark";
  applyTheme(saved);
  themeToggle.addEventListener("click", async () => {
    const next = store.theme === "dark" ? "light" : "dark";
    applyTheme(next);
    await trackEvent("theme_toggle", { next });
  });
}

function applyMode(mode) {
  root.setAttribute("data-mode", mode);
  modeSelect.value = mode;
  setState({ mode });
  localStorage.setItem("system.mode", mode);
}

function setupMode() {
  const saved = localStorage.getItem("system.mode") || detectMode();
  applyMode(saved);
  modeSelect.addEventListener("change", async () => {
    applyMode(modeSelect.value);
    await trackEvent("mode_change", { mode: modeSelect.value });
  });
}

function setWindowState(id, patch) {
  const current = store.windows[id] || {};
  const next = { ...current, ...patch };
  const windows = { ...store.windows, [id]: next };
  setState({ windows });
  saveLayout();
}

function isCompactViewport() {
  return window.matchMedia("(max-width: 1024px)").matches;
}

function clampWindowToViewport(windowEl, proposed) {
  const maxW = Math.max(320, window.innerWidth - 24);
  const maxH = Math.max(220, window.innerHeight - 140);
  const w = Math.min(Math.max(320, proposed.w), maxW);
  const h = Math.min(Math.max(220, proposed.h), maxH);
  const x = Math.min(Math.max(8, proposed.x), Math.max(8, window.innerWidth - w - 8));
  const y = Math.min(Math.max(44, proposed.y), Math.max(44, window.innerHeight - h - 90));

  Object.assign(windowEl.style, {
    left: `${x}px`,
    top: `${y}px`,
    width: `${w}px`,
    height: `${h}px`
  });

  return { x, y, w, h };
}

function focusWindow(id) {
  const zCounter = store.zCounter + 1;
  setState({ zCounter });
  setWindowState(id, { z: zCounter, minimized: false });
  const node = desktop.querySelector(`.os-window[data-window='${id}']`);
  if (node) node.style.zIndex = String(zCounter);
}

function initWindowManager() {
  const windows = [...desktop.querySelectorAll(".os-window")];
  const compact = isCompactViewport();

  windows.forEach((windowEl, index) => {
    const id = windowEl.dataset.window;
    const header = windowEl.querySelector(".window-head");
    const resizeHandle = windowEl.querySelector(".window-resize");
    const minimizeBtn = windowEl.querySelector("[data-action='minimize']");
    const closeBtn = windowEl.querySelector("[data-action='close']");

    const saved = store.windows[id] || {};
    const startX = saved.x ?? (60 + index * 30);
    const startY = saved.y ?? (80 + index * 24);
    const startW = saved.w ?? Number(windowEl.dataset.w || 500);
    const startH = saved.h ?? Number(windowEl.dataset.h || 340);
    const startZ = saved.z ?? (10 + index);

    windowEl.style.zIndex = String(startZ);
    windowEl.style.display = saved.minimized ? "none" : "grid";

    if (compact) {
      Object.assign(windowEl.style, {
        left: "",
        top: "",
        width: "",
        height: ""
      });
      setWindowState(id, { z: startZ, minimized: Boolean(saved.minimized) });
    } else {
      const clamped = clampWindowToViewport(windowEl, {
        x: startX,
        y: startY,
        w: startW,
        h: startH
      });
      setWindowState(id, { ...clamped, z: startZ, minimized: Boolean(saved.minimized) });
    }

    let drag = null;
    header.addEventListener("pointerdown", (event) => {
      focusWindow(id);
      drag = {
        sx: event.clientX,
        sy: event.clientY,
        x: windowEl.offsetLeft,
        y: windowEl.offsetTop
      };
      header.setPointerCapture(event.pointerId);
    });

    header.addEventListener("pointermove", (event) => {
      if (!drag) return;
      if (isCompactViewport()) return;
      const nx = Math.max(8, drag.x + (event.clientX - drag.sx));
      const ny = Math.max(44, drag.y + (event.clientY - drag.sy));
      windowEl.style.left = `${nx}px`;
      windowEl.style.top = `${ny}px`;
    });

    header.addEventListener("pointerup", () => {
      if (!drag) return;
      if (isCompactViewport()) {
        drag = null;
        return;
      }
      setWindowState(id, { x: windowEl.offsetLeft, y: windowEl.offsetTop });
      drag = null;
    });

    let resize = null;
    resizeHandle?.addEventListener("pointerdown", (event) => {
      focusWindow(id);
      resize = {
        sx: event.clientX,
        sy: event.clientY,
        w: windowEl.offsetWidth,
        h: windowEl.offsetHeight
      };
      resizeHandle.setPointerCapture(event.pointerId);
    });

    resizeHandle?.addEventListener("pointermove", (event) => {
      if (!resize) return;
      if (isCompactViewport()) return;
      const nw = Math.max(320, resize.w + (event.clientX - resize.sx));
      const nh = Math.max(220, resize.h + (event.clientY - resize.sy));
      windowEl.style.width = `${nw}px`;
      windowEl.style.height = `${nh}px`;
    });

    resizeHandle?.addEventListener("pointerup", () => {
      if (!resize) return;
      if (isCompactViewport()) {
        resize = null;
        return;
      }
      setWindowState(id, { w: windowEl.offsetWidth, h: windowEl.offsetHeight });
      resize = null;
    });

    windowEl.addEventListener("pointerdown", () => focusWindow(id));

    minimizeBtn?.addEventListener("click", async () => {
      windowEl.style.display = "none";
      setWindowState(id, { minimized: true });
      await trackEvent("window_minimize", { id });
    });

    closeBtn?.addEventListener("click", async () => {
      windowEl.style.display = "none";
      setWindowState(id, { minimized: true });
      await trackEvent("window_close", { id });
    });
  });
}

function reflowWindowsForViewport() {
  const compact = isCompactViewport();
  desktop.querySelectorAll(".os-window").forEach((windowEl) => {
    const id = windowEl.dataset.window;
    const saved = store.windows[id] || {};
    if (compact) {
      Object.assign(windowEl.style, {
        left: "",
        top: "",
        width: "",
        height: ""
      });
      return;
    }

    const clamped = clampWindowToViewport(windowEl, {
      x: Number.isFinite(saved.x) ? saved.x : windowEl.offsetLeft,
      y: Number.isFinite(saved.y) ? saved.y : windowEl.offsetTop,
      w: Number.isFinite(saved.w) ? saved.w : windowEl.offsetWidth,
      h: Number.isFinite(saved.h) ? saved.h : windowEl.offsetHeight
    });
    setWindowState(id, clamped);
  });
}

function openWindow(id) {
  const node = desktop.querySelector(`.os-window[data-window='${id}']`);
  if (!node) return;
  node.style.display = "grid";
  focusWindow(id);
  setWindowState(id, { minimized: false });
}

function setupLaunchers() {
  function isPopoverOpen() {
    if (typeof startMenu.matches === "function") {
      try {
        if (startMenu.matches(":popover-open")) return true;
      } catch {
      }
    }
    return startMenu.classList.contains("is-open");
  }

  function openStartMenu() {
    if (typeof startMenu.showPopover === "function") {
      startMenu.showPopover();
      return;
    }
    startMenu.classList.add("is-open");
  }

  function closeStartMenu() {
    if (typeof startMenu.hidePopover === "function") {
      startMenu.hidePopover();
      return;
    }
    startMenu.classList.remove("is-open");
  }

  document.querySelectorAll("[data-open]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.open;
      openWindow(id);
      if (isPopoverOpen()) closeStartMenu();
    });
  });

  startToggle.addEventListener("click", () => {
    if (isPopoverOpen()) closeStartMenu();
    else openStartMenu();
  });

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (!isPopoverOpen()) return;
    if (startMenu.contains(target) || startToggle.contains(target)) return;
    closeStartMenu();
  });
}

function renderProjectDetails(project) {
  if (!project) return;
  const deep = PROJECT_DEEP_DIVES[project.id] || PROJECT_DEEP_DIVES.default;

  projectTitle.textContent = project.name;
  projectDesc.textContent = `${project.desc} Impact: ${project.impact || "TBD"}`;
  projectMermaid.textContent = deep.mermaid;
  projectPerf.innerHTML = `
    <div>Lighthouse: <b>${deep.perf.lighthouse}</b></div>
    <div>P95 latency: <b>${deep.perf.p95LatencyMs}ms</b></div>
    <div>Availability: <b>${deep.perf.availability}</b></div>
  `;
  projectForensic.textContent = deep.forensic.note;
}

function setupProjectTabs() {
  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      const tab = button.dataset.tab;
      document.querySelectorAll(".project-tab").forEach((panel) => {
        panel.hidden = panel.dataset.panel !== tab;
      });
      document.querySelectorAll("[data-tab]").forEach((btn) => {
        btn.classList.toggle("is-active", btn === button);
      });
    });
  });
}

function renderProjects() {
  renderFilterBar({
    filterBar: projectFilterBar,
    activeFilter: store.activeFilter,
    onFilterChange: async (activeFilter) => {
      setState({ activeFilter });
      renderProjects();
      await trackEvent("project_filter", { activeFilter });
    }
  });

  renderProjectGrid({
    projectGrid,
    projects: store.projects,
    activeFilter: store.activeFilter,
    onOpenProject: (project) => {
      openWindow("projects");
      renderProjectDetails(project);
      trackEvent("project_open", { project: project.id });
    }
  });

  const visible = store.activeFilter === "all"
    ? store.projects
    : store.projects.filter((project) => project.tags.includes(store.activeFilter));
  renderProjectDetails(visible[0] || store.projects[0]);
}

async function loadProjects() {
  try {
    const payload = await getProjects();
    setState({ projects: payload.projects?.length ? payload.projects : FALLBACK_PROJECTS });
  } catch {
    setState({ projects: FALLBACK_PROJECTS });
  }
  renderProjects();
}

function terminalPrint(text) {
  const line = document.createElement("div");
  line.className = "term-line";
  line.textContent = text;
  terminalOutput.appendChild(line);
  terminalOutput.scrollTop = terminalOutput.scrollHeight;
}

function semanticFilter(input) {
  const query = input.toLowerCase();
  const candidate = FILTERS.find((item) => item !== "all" && query.includes(item));
  if (!candidate) return false;
  setState({ activeFilter: candidate });
  renderProjects();
  terminalPrint(`Applied filter: ${candidate}`);
  openWindow("projects");
  return true;
}

function runTerminal(command) {
  const value = command.trim();
  if (!value) return;

  terminalPrint(`$ ${value}`);
  const nextHistory = [...store.terminalHistory, value].slice(-200);
  setState({ terminalHistory: nextHistory });
  saveTerminalHistory();

  const parts = value.split(/\s+/);
  const [cmd, ...rest] = parts;

  if (/^find\s+me\s+/i.test(value)) {
    const handled = semanticFilter(value);
    if (!handled) terminalPrint("No semantic filter matched. Try 'find me automation apps'.");
    return;
  }

  if (cmd === "help") {
    TERMINAL_HELP.forEach((line) => terminalPrint(line));
    return;
  }

  if (cmd === "ls") {
    terminalPrint("projects assistant pulse settings terminal");
    return;
  }

  if (cmd === "cd") {
    const target = (rest[0] || "/").replace(/^\/+/, "");
    if (!target) {
      setState({ terminalPath: "/" });
      terminalPrint("Changed directory to /");
      return;
    }
    if (["projects", "assistant", "pulse", "settings"].includes(target)) {
      setState({ terminalPath: `/${target}` });
      terminalPrint(`Changed directory to /${target}`);
      return;
    }
    terminalPrint(`cd: no such app: ${target}`);
    return;
  }

  if (cmd === "open") {
    const target = rest[0];
    if (!target) {
      terminalPrint("open: missing app name");
      return;
    }
    openWindow(target);
    terminalPrint(`Opened ${target}`);
    return;
  }

  if (cmd === "clear") {
    terminalOutput.innerHTML = "";
    setState({ terminalHistory: [] });
    saveTerminalHistory();
    return;
  }

  terminalPrint(`Unknown command: ${cmd}. Run 'help'.`);
}

function setupTerminal() {
  terminalPrint("Persistent Digital OS terminal online. Run 'help'.");
  store.terminalHistory.slice(-8).forEach((entry) => terminalPrint(`history: ${entry}`));

  terminalForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const cmd = terminalInput.value;
    terminalInput.value = "";
    runTerminal(cmd);
    await trackEvent("terminal_command", { cmd: cmd.slice(0, 80) });
  });
}

function addAssistantMessage(role, text) {
  const node = document.createElement("div");
  node.className = `msg ${role}`;
  node.textContent = text;
  assistantLog.appendChild(node);
  assistantLog.scrollTop = assistantLog.scrollHeight;
}

function setupAssistant() {
  addAssistantMessage("assistant", "Digital Twin ready. Ask about architecture, scale, or project fit.");

  const run = async () => {
    const message = assistantInput.value.trim();
    if (!message) return;
    assistantInput.value = "";
    addAssistantMessage("user", message);

    assistantSend.disabled = true;
    try {
      const payload = await askAssistant(message, store.activeFilter);
      addAssistantMessage("assistant", payload.reply || "No response generated.");
      await trackEvent("assistant_asked", { chars: message.length });
    } catch {
      addAssistantMessage("assistant", "Assistant unavailable. Verify backend/API keys.");
    } finally {
      assistantSend.disabled = false;
    }
  };

  assistantSend.addEventListener("click", run);
  assistantInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      run();
    }
  });
}

function setupPulse() {
  try {
    const protocol = location.protocol === "https:" ? "wss" : "ws";
    const socket = new WebSocket(`${protocol}://${location.host}/ws/pulse`);
    socket.addEventListener("message", (event) => {
      const payload = JSON.parse(event.data || "{}");
      if (payload.type !== "pulse") return;
      const data = payload.data || {};
      pulseVisitors.textContent = String(data.visitors ?? 0);
      pulseActivity.textContent = data.neuralActivity || "No activity";
      pulseSynced.textContent = data.archiveLastSync
        ? new Date(data.archiveLastSync).toLocaleTimeString()
        : "pending";
    });
  } catch {
    pulseActivity.textContent = "Realtime channel unavailable";
  }
}

async function loadHealth() {
  try {
    const health = await getHealth();
    systemHealth.textContent = `online (${health.service})`;
  } catch {
    systemHealth.textContent = "offline";
  }
}

async function loadAnalytics() {
  const summary = await getAnalyticsSummary();
  setState({ analyticsSummary: summary });
  eventsTotal.textContent = String(summary.totalEvents || 0);
}

function renderArchiveSummary(state) {
  archiveSummary.innerHTML = `
    <div>Source: <b>${state.source}</b></div>
    <div>Years experience: <b>${state.yearsExperience}</b></div>
    <div>GitHub repos: <b>${state.github?.publicRepos ?? 0}</b></div>
    <div>Total stars: <b>${state.github?.stars ?? 0}</b></div>
  `;
}

async function loadArchive() {
  try {
    const status = await getArchiveStatus();
    setState({ archiveStatus: status });
    renderArchiveSummary(status);
  } catch {
    archiveSummary.textContent = "Archive unavailable.";
  }

  try {
    const ledger = await getLedger(1);
    ledgerHash.textContent = ledger.latestHash || "GENESIS";
  } catch {
    ledgerHash.textContent = "N/A";
  }

  archiveSyncBtn.addEventListener("click", async () => {
    archiveSyncBtn.disabled = true;
    await syncArchiveNow();
    await loadArchive();
    archiveSyncBtn.disabled = false;
  });
}

async function init() {
  loadLayout();
  loadTerminalHistory();

  setupTheme();
  setupMode();
  setupLaunchers();
  initWindowManager();
  window.addEventListener("resize", reflowWindowsForViewport);
  setupProjectTabs();
  setupTerminal();
  setupAssistant();
  setupPulse();
  initCursorGlow();
  initParticleCanvas();

  await Promise.all([
    loadProjects(),
    loadHealth(),
    loadAnalytics(),
    loadArchive()
  ]);

  resetLayoutBtn?.addEventListener("click", () => {
    localStorage.removeItem("desktop.layout");
    localStorage.removeItem("terminal.history");
    location.reload();
  });

  await trackEvent("page_view", { title: document.title });
}

init();
