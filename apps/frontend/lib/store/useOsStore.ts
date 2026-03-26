import { create } from "zustand";
import type { Pulse } from "@/lib/api";

type Mode = "legacy" | "modern" | "spatial";
type Theme = "dark" | "light";

type TerminalLine = { type: "cmd" | "out"; text: string };

type Project = {
  id: string;
  name: string;
  desc: string;
  impact: string;
  tags: string[];
};

type TwinMessage = { role: "user" | "assistant"; text: string };

type OsState = {
  pulse: Pulse;
  mode: Mode;
  theme: Theme;
  projects: Project[];
  terminalHistory: string[];
  terminalLines: TerminalLine[];
  twinMessages: TwinMessage[];
  analyticsTotal: number;
  setPulse: (pulse: Pulse) => void;
  setMode: (mode: Mode) => void;
  setTheme: (theme: Theme) => void;
  setProjects: (projects: Project[]) => void;
  pushTerminal: (line: TerminalLine) => void;
  pushHistory: (cmd: string) => void;
  clearTerminal: () => void;
  pushTwin: (msg: TwinMessage) => void;
  setAnalyticsTotal: (n: number) => void;
};

const defaultPulse: Pulse = {
  server_date: "--",
  server_time: "--",
  visitor_count: 0,
  neural_activity: 0,
  archive_sync_status: "ACTIVE"
};

export const useOsStore = create<OsState>((set) => ({
  pulse: defaultPulse,
  mode: "modern",
  theme: "dark",
  projects: [],
  terminalHistory: [],
  terminalLines: [{ type: "out", text: "Digital OS boot complete. Type help." }],
  twinMessages: [],
  analyticsTotal: 0,
  setPulse: (pulse) => set({ pulse }),
  setMode: (mode) => set({ mode }),
  setTheme: (theme) => set({ theme }),
  setProjects: (projects) => set({ projects }),
  pushTerminal: (line) => set((s) => ({ terminalLines: [...s.terminalLines, line] })),
  pushHistory: (cmd) =>
    set((s) => ({ terminalHistory: [...s.terminalHistory, cmd].slice(-200) })),
  clearTerminal: () => set({ terminalLines: [] }),
  pushTwin: (msg) => set((s) => ({ twinMessages: [...s.twinMessages, msg] })),
  setAnalyticsTotal: (analyticsTotal) => set({ analyticsTotal })
}));
