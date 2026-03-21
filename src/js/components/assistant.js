import { askAssistant, trackEvent, getAnalyticsSummary } from "../api/client.js";
import { setState, store } from "../state/store.js";

export function initAssistant() {
  const input = document.getElementById("assistantInput");
  const send = document.getElementById("assistantSend");
  const chatLog = document.getElementById("chatLog");
  const eventsTotal = document.getElementById("eventsTotal");

  function addMessage(role, text) {
    const msg = document.createElement("div");
    msg.className = `msg ${role}`;
    msg.textContent = text;
    chatLog.appendChild(msg);
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  async function refreshAnalytics() {
    const summary = await getAnalyticsSummary();
    setState({ analyticsSummary: summary });
    eventsTotal.textContent = String(summary.totalEvents || 0);
  }

  async function run() {
    const message = input.value.trim();
    if (!message) return;

    input.value = "";
    addMessage("user", message);
    send.disabled = true;

    try {
      const payload = await askAssistant(message, store.activeFilter);
      addMessage("assistant", payload.reply || "No response returned.");
    } catch {
      addMessage("assistant", "Assistant backend is unavailable. Ensure server is running.");
    } finally {
      send.disabled = false;
      await trackEvent("assistant_asked", { chars: message.length });
      await refreshAnalytics();
    }
  }

  addMessage("assistant", "Ask me what to show for your audience, and I’ll map the best case studies.");

  send.addEventListener("click", run);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      run();
    }
  });
}
