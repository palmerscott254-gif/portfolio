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

export const HORIZON_EVENTS = {
  2026: "Foundation phase: robust accessibility, observability, and resilience by default.",
  2038: "Interoperable products across ecosystems with portable architecture boundaries.",
  2050: "Human-AI co-creation patterns mature with governance and trust controls.",
  2075: "Portfolio evolves from products to adaptive infrastructure systems.",
  2100: "Intergenerational maintainability and institutional memory become first-class.",
  2126: "Legacy systems intentionally transfer knowledge to future operators."
};

export const ADVISOR_ROUTES = {
  growth: "Start with Fintech Grid → Ops Pulse Platform → Climate Signal Engine.",
  automation: "Start with Medical Triage Copilot → Ops Pulse Platform → Fintech Grid.",
  experience: "Start with Neural Story Commerce → Public Service UX Stack → Medical Triage Copilot.",
  innovation: "Start with Climate Signal Engine → Neural Story Commerce → Architecture Lab workshop."
};
