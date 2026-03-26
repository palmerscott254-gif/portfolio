export const FILTERS = ["all", "growth", "automation", "experience", "innovation"];

export const FALLBACK_PROJECTS = [
  {
    id: "pie-global-furnitures",
    name: "PIE Global Furnitures Website",
    desc: "Product showcase and lead generation platform for furniture clients.",
    impact: "Improved brand visibility and inquiry conversion flow.",
    tags: ["growth", "experience"],
    monitorUrl: ""
  },
  {
    id: "cpa-academy",
    name: "CPA Academy Website",
    desc: "Education platform experience for academy programs and onboarding.",
    impact: "Streamlined access to learning programs and enrollment information.",
    tags: ["experience", "growth"],
    monitorUrl: ""
  },
  {
    id: "scholsey-security-app",
    name: "Scholsey Security App",
    desc: "Security-focused application for monitoring and operational response.",
    impact: "Strengthened visibility and response workflows for security operations.",
    tags: ["automation", "innovation"],
    monitorUrl: ""
  },
  {
    id: "portfolio-monitor",
    name: "Portfolio Monitor",
    desc: "Unified dashboard to track health, latency, and status across deployed projects.",
    impact: "Single view of uptime signals for project fleet reliability.",
    tags: ["automation", "growth", "innovation"],
    monitorUrl: ""
  }
];

export const TERMINAL_HELP = [
  "help — list commands",
  "ls — list apps",
  "cd projects|assistant|pulse|settings — change context",
  "open projects|assistant|pulse|settings|terminal — focus app",
  "find me <query> — semantic project filter",
  "clear — clear terminal history"
];

export const PROJECT_DEEP_DIVES = {
  default: {
    mermaid: "graph TD\nClient[Web Client] --> API[API Gateway]\nAPI --> SVC[Domain Services]\nSVC --> DB[(Data Store)]\nSVC --> OBS[(Observability)]",
    perf: {
      lighthouse: 92,
      p95LatencyMs: 220,
      availability: "99.95%"
    },
    forensic: {
      available: true,
      note: "Cached forensic replay is archived locally to mitigate link rot."
    }
  }
};
