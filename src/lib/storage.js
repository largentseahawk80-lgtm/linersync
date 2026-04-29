import { normalizeState } from "./normalize";

const KEY = "linersync_field_state_v1";

export const defaultState = () => ({
  constants: { project: "", qcTech: "", activeRoll: "", activePanel: "", activeSeam: "" },
  logs: [],
  points: []
});

export function loadState() {
  const raw = localStorage.getItem(KEY);
  if (raw === null) return { ...defaultState(), repaired: false };

  try {
    const parsed = JSON.parse(raw);
    const normalized = normalizeState(parsed);
    return { ...defaultState(), ...normalized.state, repaired: normalized.repaired };
  } catch {
    return { ...defaultState(), repaired: true };
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
