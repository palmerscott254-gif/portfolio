import { FALLBACK_PROJECTS, HORIZON_EVENTS, ADVISOR_ROUTES } from "./constants.js";
import { getHealth, getProjects, getAnalyticsSummary, trackEvent } from "./api/client.js";
import { store, setState } from "./state/store.js";
import { renderFilterBar, renderProjectGrid } from "./components/projects.js";
import { initCommandPalette } from "./components/palette.js";
import { initReveal } from "./effects/reveal.js";
import { initTilt } from "./effects/tilt.js";
import { initCursorGlow } from "./effects/cursor.js";
import { initParticleCanvas } from "./effects/particles.js";

const root = document.documentElement;
const year = document.getElementById("year");
const localClock = document.getElementById("localClock");
const availability = document.getElementById("availability");
const apiHealth = document.getElementById("apiHealth");
const eventsTotal = document.getElementById("eventsTotal");
const projectSource = document.getElementById("projectSource");
const filterBar = document.getElementById("filterBar");
const projectGrid = document.getElementById("projectGrid");
const goalSelect = document.getElementById("goalSelect");
const advisorOutput = document.getElementById("advisorOutput");
const runAdvisor = document.getElementById("runAdvisor");
const horizonRange = document.getElementById("horizonRange");
const horizonYear = document.getElementById("horizonYear");
const horizonInsight = document.getElementById("horizonInsight");

function nearestHorizonYear(value) {
  const years = Object.keys(HORIZON_EVENTS).map(Number);
  return years.reduce((prev, curr) => (Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev));
}

function applyTheme(theme) {
  root.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
  setState({ theme });
}

function setupTheme() {
  const saved = localStorage.getItem("theme");
  if (saved) {
    applyTheme(saved);
  } else {
    const hour = new Date().getHours();
    applyTheme(hour >= 7 && hour <= 18 ? "light" : "dark");
  }

  document.getElementById("themeToggle").addEventListener("click", async () => {
    const current = root.getAttribute("data-theme") || "dark";
    const next = current === "dark" ? "light" : "dark";
    applyTheme(next);
    await trackEvent("theme_toggle", { next });
  });
}

function setupClock() {
  function tick() {
    const now = new Date();
    localClock.textContent = now.toLocaleTimeString();
    const hour = now.getHours();
    const online = hour >= 7 && hour <= 20;
    availability.textContent = online ? "online" : "async-mode";
    availability.style.color = online ? "var(--ok)" : "var(--warn)";
  }
  tick();
  setInterval(tick, 1000);
}

function animateKpis() {
  const counters = document.querySelectorAll("[data-kpi]");
  counters.forEach((node) => {
    const target = Number(node.getAttribute("data-target") || 0);
    let value = 0;
    const step = Math.max(1, Math.floor(target / 36));
    const id = setInterval(() => {
      value += step;
      if (value >= target) {
        value = target;
        clearInterval(id);
      }
      node.textContent = `${value}%`;
    }, 24);
  });
}

function renderProjects() {
  renderFilterBar({
    filterBar,
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
    activeFilter: store.activeFilter
  });

  initTilt();
}

async function loadProjects() {
  try {
    const payload = await getProjects();
    setState({ projects: payload.projects?.length ? payload.projects : FALLBACK_PROJECTS });
    projectSource.textContent = payload.source || "seed";
    await trackEvent("projects_loaded", { source: payload.source || "seed" });
  } catch {
    setState({ projects: FALLBACK_PROJECTS });
    projectSource.textContent = "seed";
  }
  renderProjects();
}

async function updateAnalyticsSummary() {
  const summary = await getAnalyticsSummary();
  setState({ analyticsSummary: summary });
  eventsTotal.textContent = String(summary.totalEvents || 0);
}

async function checkHealth() {
  try {
    const payload = await getHealth();
    apiHealth.textContent = `online (${payload.service})`;
    apiHealth.style.color = "var(--ok)";
  } catch {
    apiHealth.textContent = "offline";
    apiHealth.style.color = "var(--warn)";
  }
}

function setupAdvisor() {
  const run = async () => {
    const goal = goalSelect.value;
    advisorOutput.textContent = ADVISOR_ROUTES[goal];
    await trackEvent("advisor_run", { goal });
    await updateAnalyticsSummary();
  };

  runAdvisor.addEventListener("click", run);
  return run;
}

function setupHorizon() {
  const render = () => {
    const yearValue = Number(horizonRange.value);
    const nearest = nearestHorizonYear(yearValue);
    horizonYear.textContent = String(yearValue);
    horizonInsight.textContent = HORIZON_EVENTS[nearest];
  };

  horizonRange.addEventListener("input", render);
  horizonRange.addEventListener("change", async () => {
    await trackEvent("horizon_change", { year: Number(horizonRange.value) });
    await updateAnalyticsSummary();
  });

  render();
}

function setupForms() {
  const form = document.getElementById("contactForm");
  const copyState = document.getElementById("copyState");
  const vcardBtn = document.getElementById("vcardBtn");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const scope = document.getElementById("scope").value.trim();
    const subject = `Project Inquiry from ${name}`;
    const body = `Name: ${name}\nEmail: ${email}\n\nScope:\n${scope}`;
    window.location.href = `mailto:hello@newton.build?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    await trackEvent("contact_mailto", { hasScope: Boolean(scope) });
    await updateAnalyticsSummary();
  });

  copyState.addEventListener("click", async () => {
    const snapshot = {
      at: new Date().toISOString(),
      theme: store.theme,
      filter: store.activeFilter,
      projects: store.projects.length,
      horizonYear: Number(horizonRange.value)
    };

    try {
      await navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2));
      await trackEvent("snapshot_copy");
      await updateAnalyticsSummary();
      alert("Snapshot copied.");
    } catch {
      alert("Clipboard unavailable.");
    }
  });

  vcardBtn.addEventListener("click", async () => {
    const card = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      "FN:Newton",
      "TITLE:Product Designer & Full-Stack Developer",
      "EMAIL:hello@newton.build",
      "URL:https://portfolio.newton.build",
      "NOTE:Futuristic, measurable, durable digital systems.",
      "END:VCARD"
    ].join("\n");

    const blob = new Blob([card], { type: "text/vcard;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "newton-contact.vcf";
    link.click();
    URL.revokeObjectURL(link.href);

    await trackEvent("vcard_download");
    await updateAnalyticsSummary();
  });
}

async function lazyInitAssistant() {
  const section = document.getElementById("assistant");
  let loaded = false;

  const observer = new IntersectionObserver(async (entries) => {
    const entry = entries[0];
    if (!entry?.isIntersecting || loaded) return;
    loaded = true;
    observer.disconnect();
    const { initAssistant } = await import("./components/assistant.js");
    initAssistant();
  }, { threshold: 0.2 });

  observer.observe(section);
}

async function initThreeWhenIdle() {
  const run = async () => {
    try {
      const { initThreeHero } = await import("./effects/three-hero.js");
      await initThreeHero("threeMount");
    } catch {
    }
  };

  if ("requestIdleCallback" in window) {
    requestIdleCallback(run, { timeout: 1800 });
  } else {
    setTimeout(run, 900);
  }
}

function init() {
  year.textContent = String(new Date().getFullYear());
  setupTheme();
  setupClock();
  animateKpis();
  setupHorizon();
  setupForms();
  initReveal();
  initCursorGlow();
  initParticleCanvas();

  const runAdvisor = setupAdvisor();
  initCommandPalette({ onRunAdvisor: runAdvisor });

  loadProjects();
  checkHealth();
  updateAnalyticsSummary();
  lazyInitAssistant();
  initThreeWhenIdle();

  trackEvent("page_view", { title: document.title });
}

init();
