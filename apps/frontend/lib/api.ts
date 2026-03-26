const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

export type Pulse = {
  server_date: string;
  server_time: string;
  visitor_count: number;
  neural_activity: number;
  archive_sync_status: "ACTIVE" | "SYNCING" | "ERROR";
};

export async function getProjects() {
  const res = await fetch(`${API_BASE}/api/projects`, { cache: "no-store" });
  return res.json();
}

export async function getArchiveState() {
  const res = await fetch(`${API_BASE}/api/archive/state`, { cache: "no-store" });
  return res.json();
}

export async function syncArchive() {
  const res = await fetch(`${API_BASE}/api/archive/sync`, { method: "POST" });
  return res.json();
}

export async function getLedger() {
  const res = await fetch(`${API_BASE}/api/ledger`, { cache: "no-store" });
  return res.json();
}

export async function getMonitorStatus() {
  const res = await fetch(`${API_BASE}/api/monitor/status`, { cache: "no-store" });
  return res.json();
}

export async function askTwin(query: string) {
  const res = await fetch(`${API_BASE}/api/ai/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query })
  });
  return res.json();
}

export async function trackAnalytics(event: string, payload: Record<string, unknown> = {}) {
  await fetch(`${API_BASE}/api/analytics/track`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, payload })
  });
}

export async function getAnalyticsSummary() {
  const res = await fetch(`${API_BASE}/api/analytics/summary`, { cache: "no-store" });
  return res.json();
}

export function createPulseSocket(onMessage: (pulse: Pulse) => void) {
  const wsBase = API_BASE.replace(/^http/, "ws");
  const ws = new WebSocket(`${wsBase}/ws/pulse`);
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as Pulse;
      onMessage(data);
    } catch {
    }
  };
  return ws;
}
