const KEY = "linersync_field_state_v1";

export const defaultState = () => ({
  constants: { project: "", qcTech: "", activeRoll: "", activePanel: "", activeSeam: "" },
  logs: [],
  points: []
});

export function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "null");
    return parsed && typeof parsed === "object" ? { ...defaultState(), ...parsed } : defaultState();
  } catch {
    return defaultState();
  }
}

export function saveState(state) { localStorage.setItem(KEY, JSON.stringify(state)); }

export function clearKeysOnResetQuery() {
  const params = new URLSearchParams(window.location.search);
  if (!params.has("reset")) return;
  const match = (k) => ["linersync", "qc", "field"].some((t) => String(k || "").toLowerCase().includes(t));
  [localStorage, sessionStorage].forEach((store) => {
    const keys = [];
    for (let i = 0; i < store.length; i += 1) {
      const k = store.key(i);
      if (match(k)) keys.push(k);
    }
    keys.forEach((k) => store.removeItem(k));
  });
  window.history.replaceState({}, "", window.location.pathname);
}
