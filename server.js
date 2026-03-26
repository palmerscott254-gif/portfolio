import express from "express";
import dotenv from "dotenv";
import fs from "node:fs/promises";
import path from "node:path";
import http from "node:http";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const PORT = Number(process.env.PORT || 3000);

const dataDir = path.join(__dirname, "data");
const seedProjectsPath = path.join(dataDir, "projects.seed.json");
const analyticsLogPath = path.join(dataDir, "analytics.log");
const workLedgerPath = path.join(dataDir, "work-ledger.jsonl");
const archiveStatePath = path.join(dataDir, "archive-state.json");
const ragDir = path.join(dataDir, "rag");

const pulseClients = new Set();
let pulseTick = 0;
let lastLedgerHash = "GENESIS";

const wss = new WebSocketServer({ server, path: "/ws/pulse" });

const archiveState = {
  source: "seed",
  lastSyncAt: null,
  yearsExperience: 0,
  github: {
    username: process.env.GITHUB_USERNAME || null,
    followers: 0,
    publicRepos: 0,
    stars: 0,
    topStacks: []
  },
  linkedIn: {
    profile: process.env.LINKEDIN_PROFILE || null,
    headline: process.env.LINKEDIN_HEADLINE || "Developer building durable systems"
  }
};

const neuralStates = [
  "Coding: portfolio/desktop-os",
  "Deep Work: architecture review",
  "Syncing archive metadata",
  "Offline focus block"
];

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
  const fallbackId = item?.sys?.id || fields.slug || String(fields.title || "untitled").toLowerCase().replace(/\s+/g, "-");
  return {
    id: fallbackId,
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

  try {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
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
  } catch {
    return { source: "seed", projects: await readSeedProjects(), cmsError: "Contentful fetch error" };
  }
}

function parseTopStacks(repos) {
  const counts = repos.reduce((acc, repo) => {
    const language = repo?.language;
    if (!language) return acc;
    acc[language] = (acc[language] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, count]) => ({ name, count }));
}

async function loadArchiveState() {
  try {
    const raw = await fs.readFile(archiveStatePath, "utf-8");
    Object.assign(archiveState, JSON.parse(raw));
  } catch {
  }
}

async function persistArchiveState() {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(archiveStatePath, JSON.stringify(archiveState, null, 2), "utf-8");
}

async function loadLatestLedgerHash() {
  try {
    const raw = await fs.readFile(workLedgerPath, "utf-8");
    const lines = raw.trim().split("\n").filter(Boolean);
    if (!lines.length) {
      lastLedgerHash = "GENESIS";
      return;
    }
    const latest = JSON.parse(lines[lines.length - 1]);
    lastLedgerHash = latest.hash || "GENESIS";
  } catch {
    lastLedgerHash = "GENESIS";
  }
}

async function appendLedger(eventType, payload = {}) {
  const record = {
    at: new Date().toISOString(),
    eventType,
    payload,
    prevHash: lastLedgerHash
  };
  const hash = crypto.createHash("sha256").update(JSON.stringify(record)).digest("hex");
  const chainRecord = { ...record, hash };

  await fs.mkdir(dataDir, { recursive: true });
  await fs.appendFile(workLedgerPath, `${JSON.stringify(chainRecord)}\n`, "utf-8");
  lastLedgerHash = hash;
}

async function readWorkLedger(limit = 20) {
  try {
    const raw = await fs.readFile(workLedgerPath, "utf-8");
    const rows = raw.split("\n").filter(Boolean).map((line) => JSON.parse(line));
    return rows.slice(-limit);
  } catch {
    return [];
  }
}

async function syncArchive() {
  const githubUsername = process.env.GITHUB_USERNAME;
  const startYear = Number(process.env.CAREER_START_YEAR || 2016);
  const nowYear = new Date().getFullYear();

  archiveState.yearsExperience = Math.max(1, nowYear - startYear);
  archiveState.lastSyncAt = new Date().toISOString();

  if (!githubUsername) {
    archiveState.source = "seed";
    await persistArchiveState();
    await appendLedger("archive_sync", { source: "seed" });
    return archiveState;
  }

  try {
    const userResponse = await fetch(`https://api.github.com/users/${githubUsername}`);
    const reposResponse = await fetch(`https://api.github.com/users/${githubUsername}/repos?per_page=100`);

    if (!userResponse.ok || !reposResponse.ok) {
      archiveState.source = "seed";
      await persistArchiveState();
      await appendLedger("archive_sync", { source: "seed", reason: "github_fetch_failed" });
      return archiveState;
    }

    const user = await userResponse.json();
    const repos = await reposResponse.json();
    const totalStars = Array.isArray(repos)
      ? repos.reduce((acc, repo) => acc + Number(repo?.stargazers_count || 0), 0)
      : 0;

    archiveState.source = "github";
    archiveState.github = {
      username: githubUsername,
      followers: Number(user?.followers || 0),
      publicRepos: Number(user?.public_repos || 0),
      stars: totalStars,
      topStacks: Array.isArray(repos) ? parseTopStacks(repos) : []
    };

    await persistArchiveState();
    await appendLedger("archive_sync", {
      source: "github",
      username: githubUsername,
      publicRepos: archiveState.github.publicRepos
    });

    return archiveState;
  } catch {
    archiveState.source = "seed";
    await persistArchiveState();
    await appendLedger("archive_sync", { source: "seed", reason: "archive_sync_error" });
    return archiveState;
  }
}

async function appendAnalytics(event) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.appendFile(analyticsLogPath, `${JSON.stringify(event)}\n`, "utf-8");
  await appendLedger("analytics_event", { event: event.event, path: event.path });
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

async function loadKnowledgeDocuments(projects) {
  const docs = [
    {
      id: "projects_context",
      text: projects
        .map((project) => `${project.name}. ${project.desc}. Impact: ${project.impact}. Tags: ${(project.tags || []).join(", ")}`)
        .join(" ")
    }
  ];

  try {
    const entries = await fs.readdir(ragDir, { withFileTypes: true });
    const files = entries.filter((entry) => entry.isFile() && /\.(md|txt|json)$/i.test(entry.name));

    for (const file of files) {
      const fullPath = path.join(ragDir, file.name);
      const content = await fs.readFile(fullPath, "utf-8");
      docs.push({ id: file.name, text: content });
    }
  } catch {
  }

  return docs;
}

function scoreDoc(query, text) {
  const terms = query.toLowerCase().split(/\W+/).filter(Boolean);
  const corpus = text.toLowerCase();
  return terms.reduce((acc, term) => (corpus.includes(term) ? acc + 1 : acc), 0);
}

function retrieveContext(query, docs) {
  return docs
    .map((doc) => ({ ...doc, score: scoreDoc(query, doc.text) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((doc) => `# ${doc.id}\n${doc.text.slice(0, 1800)}`)
    .join("\n\n");
}

function currentNeuralActivity() {
  pulseTick += 1;
  return neuralStates[pulseTick % neuralStates.length];
}

function pulseSnapshot() {
  return {
    at: new Date().toISOString(),
    visitors: pulseClients.size,
    neuralActivity: currentNeuralActivity(),
    archiveLastSync: archiveState.lastSyncAt,
    yearsExperience: archiveState.yearsExperience
  };
}

function broadcastPulse() {
  const payload = JSON.stringify({ type: "pulse", data: pulseSnapshot() });
  for (const client of pulseClients) {
    if (client.readyState === client.OPEN) {
      client.send(payload);
    }
  }
}

wss.on("connection", (socket) => {
  pulseClients.add(socket);
  socket.send(JSON.stringify({ type: "pulse", data: pulseSnapshot() }));

  socket.on("close", () => {
    pulseClients.delete(socket);
  });
});

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

app.get("/api/archive/status", async (_req, res) => {
  await loadArchiveState();
  res.json(archiveState);
});

app.post("/api/archive/sync", async (_req, res) => {
  const state = await syncArchive();
  res.status(202).json({ accepted: true, state });
});

app.get("/api/ledger", async (req, res) => {
  const limit = Math.min(200, Math.max(1, Number(req.query.limit || 30)));
  const entries = await readWorkLedger(limit);
  res.json({ entries, latestHash: lastLedgerHash });
});

app.post("/api/chat", async (req, res) => {
  const message = String(req.body?.message || "").trim();
  if (!message) {
    return res.status(400).json({ error: "message is required" });
  }

  const { projects } = await fetchContentfulProjects();
  const docs = await loadKnowledgeDocuments(projects);
  const ragContext = retrieveContext(message, docs);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const fallback = `RAG context loaded from your local archive:\n${ragContext}\n\nBased on your question ("${message}"), I would lead with the most relevant projects and explain trade-offs, scalability risks, and execution sequence.`;
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
                text: "You are Newton's digital twin assistant. Use retrieval context first, ground claims in the archive, answer concisely, and provide concrete engineering rationale."
              }
            ]
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `Retrieved context:\n${ragContext}\n\nUser question: ${message}`
              }
            ]
          }
        ],
        max_output_tokens: 320
      })
    });

    if (!aiResponse.ok) {
      return res.status(502).json({ reply: "Assistant temporarily unavailable from provider. Please try again shortly.", mode: "provider-error" });
    }

    const payload = await aiResponse.json();
    const reply = payload?.output_text || "No response generated.";
    return res.json({ reply, mode: "ai" });
  } catch {
    return res.status(500).json({ reply: "Assistant request failed unexpectedly.", mode: "server-error" });
  }
});

setInterval(() => {
  broadcastPulse();
}, 5000);

setInterval(() => {
  syncArchive();
}, 1000 * 60 * 30);

await loadLatestLedgerHash();
await loadArchiveState();
await syncArchive();

server.listen(PORT, () => {
  console.log(`Portfolio Phase 2 backend running on http://localhost:${PORT}`);
});
