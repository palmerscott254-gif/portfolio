export const store = {
  theme: "dark",
  mode: "modern",
  activeFilter: "all",
  projects: [],
  analyticsSummary: { totalEvents: 0 },
  archiveStatus: null,
  terminalHistory: [],
  terminalPath: "/",
  windows: {},
  zCounter: 20,
  subscribers: new Set()
};

export function setState(patch) {
  Object.assign(store, patch);
  store.subscribers.forEach((callback) => callback(store));
}

export function subscribe(callback) {
  store.subscribers.add(callback);
  return () => store.subscribers.delete(callback);
}
