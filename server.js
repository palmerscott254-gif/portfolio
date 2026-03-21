import express from "express";
import dotenv from "dotenv";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || 3000);
const dataDir = path.join(__dirname, "data");
const seedProjectsPath = path.join(dataDir, "projects.seed.json");
const analyticsLogPath = path.join(dataDir, "analytics.log");

app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));

async function readSeedProjects() {
  try {
    const raw = await fs.readFile(seedProjectsPath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function normalizeContentfulProject(item) {
  const fields = item?.fields || {};
  return {
    id: item?.sys?.id || fields.slug || fields.title || crypto.randomUUID(),
    name: fields.title || "Untitled case study",
    desc: fields.summary || fields.description || "No summary provided.",
    impact: fields.impact || "Impact details pending.",
    tags: Array.isArray(fields.tags) ? fields.tags : ["innovation"]
  };
}

async function fetchContentfulProjects() {
  const space = process.env.CONTENTFUL_SPACE_ID;
  const token = process.env.CONTENTFUL_ACCESS_TOKEN;
  const contentType = process.env.CONTENTFUL_CONTENT_TYPE || "caseStudy";

  if (!space || !token) {
    return { source: "seed", projects: await readSeedProjects() };
  }

  const url = new URL(`https://cdn.contentful.com/spaces/${space}/environments/master/entries`);
  url.searchParams.set("content_type", contentType);
  url.searchParams.set("limit", "50");

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    return { source: "seed", projects: await readSeedProjects(), cmsError: "Contentful request failed" };
  }

  const payload = await response.json();
  const projects = Array.isArray(payload?.items)
    ? payload.items.map(normalizeContentfulProject)
    : [];

  if (!projects.length) {
    return { source: "seed", projects: await readSeedProjects() };
  }

  return { source: "cms", projects };
}

async function appendAnalytics(event) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.appendFile(analyticsLogPath, `${JSON.stringify(event)}\n`, "utf-8");
}

async function readAnalytics() {
  try {
    const raw = await fs.readFile(analyticsLogPath, "utf-8");
    return raw
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "portfolio-phase-2", timestamp: new Date().toISOString() });
});

app.get("/api/projects", async (_req, res) => {
  const result = await fetchContentfulProjects();
  res.json(result);
});

app.post("/api/analytics/events", async (req, res) => {
  const { event = "unknown", path: pagePath = "/", metadata = {} } = req.body || {};
  const record = {
    at: new Date().toISOString(),
    event,
    path: pagePath,
    metadata,
    ua: req.get("user-agent") || "unknown",
    ip: req.ip
  };

  await appendAnalytics(record);
  res.status(202).json({ accepted: true });
});

app.get("/api/analytics/summary", async (_req, res) => {
  const rows = await readAnalytics();
  const eventsByName = rows.reduce((acc, row) => {
    acc[row.event] = (acc[row.event] || 0) + 1;
    return acc;
  }, {});

  res.json({
    totalEvents: rows.length,
    eventsByName,
    latestEvent: rows[rows.length - 1] || null
  });
});

app.post("/api/chat", async (req, res) => {
  const message = String(req.body?.message || "").trim();
  if (!message) {
    return res.status(400).json({ error: "message is required" });
  }

  const { projects } = await fetchContentfulProjects();
  const caseStudyContext = projects
    .map((project) => `- ${project.name}: ${project.desc}. Impact: ${project.impact}`)
    .join("\n");

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const fallback = `I can guide you using these case studies:\n${caseStudyContext}\n\nBased on your question ("${message}"), start with projects aligned to growth/automation first, then layer experience and innovation.`;
    return res.json({ reply: fallback, mode: "fallback" });
  }

  try {
    const model = process.env.AI_MODEL || "gpt-4.1-mini";
    const aiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text: "You are Newton's portfolio assistant. Answer concisely using only the provided case studies when possible. Recommend specific projects and rationale."
              }
            ]
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `Case studies:\n${caseStudyContext}\n\nUser question: ${message}`
              }
            ]
          }
        ],
        max_output_tokens: 320
      })
    });

    if (!aiResponse.ok) {
      const fallback = "Assistant temporarily unavailable from provider. Please try again shortly.";
      return res.status(502).json({ reply: fallback, mode: "provider-error" });
    }

    const payload = await aiResponse.json();
    const reply = payload?.output_text || "No response generated.";
    return res.json({ reply, mode: "ai" });
  } catch {
    return res.status(500).json({ reply: "Assistant request failed unexpectedly.", mode: "server-error" });
  }
});

app.listen(PORT, () => {
  console.log(`Portfolio Phase 2 backend running on http://localhost:${PORT}`);
});
