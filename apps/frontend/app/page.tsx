"use client";

import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  askTwin,
  createPulseSocket,
  getAnalyticsSummary,
  getArchiveState,
  getLedger,
  getMonitorStatus,
  getProjects,
  syncArchive,
  trackAnalytics
} from "@/lib/api";
import { useOsStore } from "@/lib/store/useOsStore";

type Tab = "design" | "performance" | "forensic";

const terminalCatalog = {
  help: "help, ls, cd, open, find me <query>, clear",
  ls: "profile pulse projects terminal ai archive ledger monitor analytics",
  cd: "stacked-layout-only: all modules are always visible",
  open: "Use smooth scroll; modules are already mounted"
};

function moduleClass(theme: "dark" | "light") {
  return `glass rounded-2xl p-5 md:p-6 shadow-glow ${theme === "light" ? "text-slate-900" : "text-slate-100"}`;
}

export default function DigitalOSPage() {
  const {
    pulse,
    mode,
    theme,
    projects,
    terminalLines,
    terminalHistory,
    twinMessages,
    analyticsTotal,
    setPulse,
    setMode,
    setTheme,
    setProjects,
    pushTerminal,
    pushHistory,
    clearTerminal,
    pushTwin,
    setAnalyticsTotal
  } = useOsStore();

  const [tab, setTab] = useState<Tab>("design");
  const [query, setQuery] = useState("");
  const [archive, setArchive] = useState<any>(null);
  const [ledger, setLedger] = useState<any[]>([]);
  const [monitor, setMonitor] = useState<any>(null);
  const [command, setCommand] = useState("");
  const [chat, setChat] = useState("");
  const [autoPoll, setAutoPoll] = useState(true);
  const sectionRefs = useRef<HTMLElement[]>([]);

  useEffect(() => {
    document.body.setAttribute("data-theme", theme);
    document.body.classList.remove("mode-legacy", "mode-modern", "mode-spatial");
    document.body.classList.add(`mode-${mode}`);
    localStorage.setItem("digital-os-theme", theme);
    localStorage.setItem("digital-os-mode", mode);
  }, [mode, theme]);

  useEffect(() => {
    const savedTheme = (localStorage.getItem("digital-os-theme") as "dark" | "light") || "dark";
    const savedMode = (localStorage.getItem("digital-os-mode") as "legacy" | "modern" | "spatial") || "modern";
    const history = JSON.parse(localStorage.getItem("digital-os-terminal-history") || "[]");
    setTheme(savedTheme);
    setMode(savedMode);
    if (Array.isArray(history)) {
      history.forEach((h: string) => pushHistory(h));
    }
  }, [pushHistory, setMode, setTheme]);

  useEffect(() => {
    const connect = () => {
      const ws = createPulseSocket((data) => setPulse(data));
      ws.onclose = () => setTimeout(connect, 1200);
      return ws;
    };
    const ws = connect();
    return () => ws.close();
  }, [setPulse]);

  useEffect(() => {
    const boot = async () => {
      const [p, a, l, m, summary] = await Promise.all([
        getProjects(),
        getArchiveState(),
        getLedger(),
        getMonitorStatus(),
        getAnalyticsSummary()
      ]);
      setProjects(p.projects || []);
      setArchive(a);
      setLedger(l.entries || []);
      setMonitor(m);
      setAnalyticsTotal(summary.total_events || 0);
    };
    void boot();
  }, [setAnalyticsTotal, setProjects]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.target.id) {
            void trackAnalytics("section_visit", { id: entry.target.id });
          }
        });
      },
      { threshold: 0.55 }
    );

    sectionRefs.current.forEach((s) => s && observer.observe(s));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!autoPoll) return;
    const timer = setInterval(async () => {
      const status = await getMonitorStatus();
      setMonitor(status);
    }, 8000);
    return () => clearInterval(timer);
  }, [autoPoll]);

  const ownerBlock = useMemo(
    () => `owner = {\n  "name": "Newton",\n  "role": "Full Stack Developer",\n  "focus": ["Realtime Systems", "AI Product Engineering", "Performance Architecture"],\n  "location": "Kenya",\n  "status": "ONLINE",\n  "summary": "Building durable software systems for the long horizon.",\n  "server_date": "${pulse.server_date}",\n  "server_time": "${pulse.server_time}",\n  "visitor_count": ${pulse.visitor_count},\n  "neural_activity": ${pulse.neural_activity},\n  "archive_sync_status": "${pulse.archive_sync_status}"\n}`,
    [pulse]
  );

  async function runCommand(raw: string) {
    const cmd = raw.trim();
    if (!cmd) return;
    pushTerminal({ type: "cmd", text: `> ${cmd}` });
    pushHistory(cmd);
    localStorage.setItem("digital-os-terminal-history", JSON.stringify([...terminalHistory, cmd].slice(-200)));
    void trackAnalytics("terminal_usage", { cmd });

    if (cmd === "clear") {
      clearTerminal();
      return;
    }
    if (cmd in terminalCatalog) {
      pushTerminal({ type: "out", text: terminalCatalog[cmd as keyof typeof terminalCatalog] });
      return;
    }
    if (cmd.startsWith("find me ")) {
      const q = cmd.replace(/^find me\s+/i, "").trim();
      setQuery(q);
      const hit = projects.filter((p) => `${p.name} ${p.desc} ${p.impact} ${p.tags.join(" ")}`.toLowerCase().includes(q.toLowerCase()));
      pushTerminal({ type: "out", text: hit.length ? hit.map((h) => `match: ${h.name}`).join(" | ") : "no indexed result" });
      return;
    }
    if (cmd.startsWith("open ")) {
      const id = cmd.replace(/^open\s+/i, "").toLowerCase();
      const node = document.getElementById(id);
      if (node) {
        node.scrollIntoView({ behavior: "smooth", block: "start" });
        pushTerminal({ type: "out", text: `opened ${id}` });
      } else {
        pushTerminal({ type: "out", text: "module not found" });
      }
      return;
    }
    pushTerminal({ type: "out", text: "unknown command. run help" });
  }

  async function ask(queryText: string) {
    if (!queryText.trim()) return;
    pushTwin({ role: "user", text: queryText });
    setChat("");
    void trackAnalytics("ai_chat_usage", { q: queryText });
    const res = await askTwin(queryText);
    pushTwin({ role: "assistant", text: res.answer || "No response." });
  }

  function monitorColor(state: string) {
    if (state === "online") return "text-emerald-400";
    if (state === "degraded") return "text-yellow-300";
    if (state === "offline") return "text-red-400";
    return "text-slate-400";
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-5 px-4 py-5 md:space-y-6 md:px-6">
      <motion.header
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={moduleClass(theme)}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold tracking-wide md:text-2xl">Newton Digital OS</h1>
          <div className="flex gap-2">
            <select
              className="rounded-lg border border-white/20 bg-black/20 px-3 py-2 text-sm"
              value={mode}
              onChange={(e) => {
                setMode(e.target.value as any);
                void trackAnalytics("mode_change", { mode: e.target.value });
              }}
            >
              <option value="legacy">Legacy Mode</option>
              <option value="modern">Modern Mode</option>
              <option value="spatial">Spatial Mode</option>
            </select>
            <button
              className="rounded-lg border border-white/20 px-3 py-2 text-sm"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? "Light" : "Dark"} Mode
            </button>
          </div>
        </div>
      </motion.header>

      <section
        id="pulse"
        ref={(el) => {
          if (el) sectionRefs.current[0] = el;
        }}
        className={moduleClass(theme)}
      >
        <h2 className="mb-3 text-lg">Pulse Panel</h2>
        <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-5">
          <div>Visitors: <span className="text-cyan">{pulse.visitor_count}</span></div>
          <div>Neural: <span className="text-violet">{pulse.neural_activity}%</span></div>
          <div>Archive: <span className="text-electric">{pulse.archive_sync_status}</span></div>
          <div>Date: {pulse.server_date}</div>
          <div>Time: {pulse.server_time}</div>
        </div>
      </section>

      <section
        id="profile"
        ref={(el) => {
          if (el) sectionRefs.current[1] = el;
        }}
        className={moduleClass(theme)}
      >
        <h2 className="mb-3 text-lg">Owner Profile</h2>
        <pre className="overflow-x-auto rounded-xl border border-white/15 bg-black/40 p-4 text-xs md:text-sm">{ownerBlock}</pre>
        <div className="mt-3 text-sm text-slate-300">&gt; whoami<br />&gt; stack<br />&gt; mode</div>
      </section>

      <section
        id="projects"
        ref={(el) => {
          if (el) sectionRefs.current[2] = el;
        }}
        className={moduleClass(theme)}
      >
        <h2 className="mb-3 text-lg">Projects Matrix</h2>
        {query && <p className="mb-3 text-xs text-cyan">semantic query: {query}</p>}
        <div className="grid gap-3 md:grid-cols-2">
          {projects.map((project) => (
            <article key={project.id} className="rounded-xl border border-white/15 bg-black/25 p-4">
              <h3 className="font-semibold">{project.name}</h3>
              <p className="mt-2 text-sm text-slate-300">{project.desc}</p>
              <p className="mt-2 text-sm"><span className="text-cyan">Impact:</span> {project.impact}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                {project.tags.map((tag) => (
                  <span key={tag} className="rounded border border-white/20 px-2 py-1">{tag}</span>
                ))}
              </div>
            </article>
          ))}
        </div>
        <div className="mt-4 rounded-xl border border-white/20 bg-black/25 p-4">
          <div className="mb-3 flex gap-2 text-sm">
            <button className="rounded border border-white/20 px-2 py-1" onClick={() => setTab("design")}>System Design</button>
            <button className="rounded border border-white/20 px-2 py-1" onClick={() => setTab("performance")}>Performance Metrics</button>
            <button className="rounded border border-white/20 px-2 py-1" onClick={() => setTab("forensic")}>Forensic Cache</button>
          </div>
          {tab === "design" && <p className="text-sm">Architecture: Next.js App Router UI, Zustand shared client state, FastAPI realtime engine, PostgreSQL telemetry, FAISS retrieval context.</p>}
          {tab === "performance" && <p className="text-sm">Latency: 42ms avg WS push | Uptime: 99.96% target | Throughput: 2,400 event writes/day baseline.</p>}
          {tab === "forensic" && <p className="text-sm">Traces: pulse stream events, monitor snapshots, sync chronology from immutable ledger chain.</p>}
        </div>
      </section>

      <section
        id="terminal"
        ref={(el) => {
          if (el) sectionRefs.current[3] = el;
        }}
        className={moduleClass(theme)}
      >
        <h2 className="mb-3 text-lg">Terminal System</h2>
        <div className="h-56 overflow-y-auto rounded-xl border border-white/20 bg-black/40 p-3 text-sm">
          {terminalLines.map((line, idx) => (
            <p key={`${line.text}-${idx}`} className={line.type === "cmd" ? "text-cyan" : "text-slate-300"}>{line.text}</p>
          ))}
        </div>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void runCommand(command);
            setCommand("");
          }}
        >
          <input className="w-full rounded-lg border border-white/20 bg-black/20 px-3 py-2 text-sm" value={command} onChange={(e) => setCommand(e.target.value)} placeholder="help | ls | cd | open profile | find me security | clear" />
          <button className="rounded-lg border border-white/20 px-3 py-2">run</button>
        </form>
      </section>

      <section
        id="ai"
        ref={(el) => {
          if (el) sectionRefs.current[4] = el;
        }}
        className={moduleClass(theme)}
      >
        <h2 className="mb-3 text-lg">AI Digital Twin (RAG)</h2>
        <div className="h-56 overflow-y-auto rounded-xl border border-white/20 bg-black/35 p-3 text-sm">
          {twinMessages.map((msg, idx) => (
            <p key={`${msg.role}-${idx}`} className={msg.role === "user" ? "text-cyan" : "text-slate-300"}>{msg.role}: {msg.text}</p>
          ))}
        </div>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void ask(chat);
          }}
        >
          <input className="w-full rounded-lg border border-white/20 bg-black/20 px-3 py-2 text-sm" value={chat} onChange={(e) => setChat(e.target.value)} placeholder="Ask Newton's twin..." />
          <button className="rounded-lg border border-white/20 px-3 py-2">ask</button>
        </form>
      </section>

      <section
        id="archive"
        ref={(el) => {
          if (el) sectionRefs.current[5] = el;
        }}
        className={moduleClass(theme)}
      >
        <h2 className="mb-3 text-lg">Archive Sync System</h2>
        <p className="text-sm">Source: {archive?.source} | Commits: {archive?.stats?.total_commits ?? 0} | Repositories: {archive?.github?.publicRepos ?? 0} | Years: {archive?.yearsExperience ?? 0}</p>
        <p className="mt-2 text-sm">Status: <span className="text-electric">{pulse.archive_sync_status}</span></p>
        <button
          className="mt-3 rounded-lg border border-white/20 px-3 py-2 text-sm"
          onClick={async () => {
            await syncArchive();
            const state = await getArchiveState();
            setArchive(state);
          }}
        >
          Sync Now
        </button>
      </section>

      <section
        id="ledger"
        ref={(el) => {
          if (el) sectionRefs.current[6] = el;
        }}
        className={moduleClass(theme)}
      >
        <h2 className="mb-3 text-lg">Immutable Work Ledger</h2>
        <div className="space-y-2 text-xs md:text-sm">
          {ledger.map((item) => (
            <div key={item.hash} className="rounded-lg border border-white/20 bg-black/25 p-3">
              <p>project: {item.project_name || item.eventType || "system"}</p>
              <p>timestamp: {item.timestamp || item.at}</p>
              <p>hash: {item.hash}</p>
              <p>previous hash: {item.previous_hash || item.prevHash}</p>
            </div>
          ))}
        </div>
      </section>

      <section
        id="monitor"
        ref={(el) => {
          if (el) sectionRefs.current[7] = el;
        }}
        className={moduleClass(theme)}
      >
        <h2 className="mb-3 text-lg">Settings Monitor Dashboard</h2>
        <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
          {monitor && Object.entries(monitor).map(([k, v]) => (
            <div key={k} className="rounded-lg border border-white/20 bg-black/20 p-3">
              <p className="font-semibold">{k}</p>
              <p className={monitorColor(String(v))}>{String(v)}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <button className="rounded-lg border border-white/20 px-3 py-2 text-sm" onClick={async () => setMonitor(await getMonitorStatus())}>Refresh</button>
          <button className="rounded-lg border border-white/20 px-3 py-2 text-sm" onClick={() => setAutoPoll((v) => !v)}>{autoPoll ? "Disable" : "Enable"} Auto Poll</button>
        </div>
      </section>

      <section
        id="analytics"
        ref={(el) => {
          if (el) sectionRefs.current[8] = el;
        }}
        className={moduleClass(theme)}
      >
        <h2 className="mb-3 text-lg">Analytics System</h2>
        <p className="text-sm">Tracked events total: {analyticsTotal}</p>
        <p className="mt-2 text-sm">Includes section visits, terminal usage, project interactions, and AI chat usage.</p>
      </section>
    </main>
  );
}
