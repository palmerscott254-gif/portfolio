export async function apiGet(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`GET ${path} failed`);
  return response.json();
}

export async function apiPost(path, body) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    throw new Error(payload?.error || `POST ${path} failed`);
  }

  return response.json();
}

export async function getHealth() {
  return apiGet("/api/health");
}

export async function getProjects() {
  return apiGet("/api/projects");
}

export async function trackEvent(event, metadata = {}) {
  try {
    await apiPost("/api/analytics/events", {
      event,
      path: location.pathname,
      metadata
    });
  } catch {
  }
}

export async function getAnalyticsSummary() {
  try {
    return await apiGet("/api/analytics/summary");
  } catch {
    return { totalEvents: 0 };
  }
}

export async function askAssistant(message, activeFilter) {
  return apiPost("/api/chat", { message, activeFilter });
}
