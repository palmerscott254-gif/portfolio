export const FILTERS = ["all", "growth", "automation", "experience", "innovation"];

export const FALLBACK_PROJECTS = [
  {
    id: "fintech-grid",
    name: "Pan-African Fintech Grid",
    desc: "Interoperable payment rails for fragmented markets.",
    impact: "Enabled cross-border settlement pilots and reduced transfer friction.",
    tags: ["growth", "automation"]
  },
  {
    id: "medical-copilot",
    name: "Medical Triage Copilot",
    desc: "Reduced emergency triage decision latency by 41%.",
    impact: "Improved triage confidence and faster patient routing decisions.",
    tags: ["automation", "experience"]
  },
  {
    id: "climate-engine",
    name: "Climate Signal Engine",
    desc: "Forecast-ready dashboard for policy and logistics teams.",
    impact: "Unified climate indicators with decision-ready operational alerts.",
    tags: ["innovation", "growth"]
  },
  {
    id: "story-commerce",
    name: "Neural Story Commerce",
    desc: "Adaptive storytelling that increased conversion quality.",
    impact: "Lifted qualified pipeline and reduced bounce for premium segments.",
    tags: ["experience", "innovation"]
  },
  {
    id: "ops-pulse",
    name: "Ops Pulse Platform",
    desc: "Unified observability across engineering and business units.",
    impact: "Faster incident detection and clearer cross-team accountability.",
    tags: ["automation", "growth"]
  },
  {
    id: "public-service-ux",
    name: "Public Service UX Stack",
    desc: "Modernized digital access for high-volume civic workflows.",
    impact: "Improved completion rates and reduced support overhead.",
    tags: ["experience"]
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
