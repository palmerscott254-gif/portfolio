export const store = {
  theme: "dark",
  activeFilter: "all",
  projects: [],
  analyticsSummary: { totalEvents: 0 },
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
