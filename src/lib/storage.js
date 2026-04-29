import { RECORD_TYPES, colorForType, nowIso, uid } from "./records.js";

const KEY = "linersync_field_state_v1";
const APP = "linersync-field-current-app";
const VERSION = "1.0.0";

const isObject = (v) => v && typeof v === "object" && !Array.isArray(v);
const safeString = (v) => (typeof v === "string" ? v : "");
const toFinite = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

export const defaultState = () => ({
  constants: { project: "", qcTech: "", activeRoll: "", activePanel: "", activeSeam: "" },
  logs: [],
  points: []
});

function normalizeGps(raw) {
  if (!isObject(raw)) return null;
  const lat = toFinite(raw.lat);
  const lng = toFinite(raw.lng);
  if (lat === null || lng === null) return null;
  const accuracy = toFinite(raw.accuracy ?? raw.accuracyFt);
  return { lat, lng, accuracy: accuracy ?? undefined };
}

function normalizeMythosAudit(raw) {
  if (!isObject(raw)) return { warnings: [], blockers: [], canLock: false, overrideUsed: false };
  const warnings = Array.isArray(raw.warnings) ? raw.warnings.map(safeString).filter(Boolean) : [];
  const blockers = Array.isArray(raw.blockers) ? raw.blockers.map(safeString).filter(Boolean) : [];
  return { warnings, blockers, canLock: Boolean(raw.canLock), overrideUsed: Boolean(raw.overrideUsed) };
}

export function normalizeLog(raw, { existingIds = new Set() } = {}) {
  if (!isObject(raw)) return null;
  const type = RECORD_TYPES.includes(raw.type) ? raw.type : null;
  if (!type) return null;

  let id = safeString(raw.id) || uid("LOG");
  while (existingIds.has(id)) id = uid("LOG");
  existingIds.add(id);

  const status = raw.status === "LOCKED" ? "LOCKED" : "DRAFT";
  const fields = isObject(raw.fields) ? raw.fields : {};
  const constants = isObject(raw.constants) ? raw.constants : defaultState().constants;
  const title = safeString(raw.title) || `${type} - ${fields.repairId || fields.seam || fields.panel || fields.roll || "record"}`;

  return {
    id,
    type,
    title,
    status,
    time: safeString(raw.time) || nowIso(),
    capturedAt: safeString(raw.capturedAt) || nowIso(),
    gps: normalizeGps(raw.gps),
    constants,
    fields,
    notes: safeString(raw.notes),
    photo: safeString(raw.photo),
    mythosAudit: normalizeMythosAudit(raw.mythosAudit),
    verifiedBy: safeString(raw.verifiedBy),
    verifiedAt: safeString(raw.verifiedAt),
    overrideReason: safeString(raw.overrideReason)
  };
}

export function normalizePoint(raw, { existingIds = new Set() } = {}) {
  if (!isObject(raw)) return null;
  const kind = RECORD_TYPES.includes(raw.kind) ? raw.kind : null;
  const x = toFinite(raw.x);
  const y = toFinite(raw.y);
  if (!kind || x === null || y === null) return null;

  let id = safeString(raw.id) || uid("PT");
  while (existingIds.has(id)) id = uid("PT");
  existingIds.add(id);

  return {
    id,
    kind,
    label: safeString(raw.label) || "Point",
    x: clamp(x, 0, 100),
    y: clamp(y, 0, 100),
    color: safeString(raw.color) || colorForType(kind),
    recordId: safeString(raw.recordId),
    gps: normalizeGps(raw.gps)
  };
}

function normalizeState(parsed) {
  const state = defaultState();
  if (!isObject(parsed)) return { state, repaired: false };

  const logIds = new Set();
  const pointIds = new Set();
  const rawLogs = Array.isArray(parsed.logs) ? parsed.logs : [];
  const rawPoints = Array.isArray(parsed.points) ? parsed.points : [];

  const logs = rawLogs.map((r) => normalizeLog(r, { existingIds: logIds })).filter(Boolean);
  const points = rawPoints.map((r) => normalizePoint(r, { existingIds: pointIds })).filter(Boolean);
  const constants = isObject(parsed.constants) ? { ...state.constants, ...parsed.constants } : state.constants;

  const repaired = logs.length !== rawLogs.length || points.length !== rawPoints.length;
  return { state: { constants, logs, points }, repaired };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = JSON.parse(raw || "null");
    return normalizeState(parsed);
  } catch {
    return { state: defaultState(), repaired: true };
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Storage may be blocked in some browser/privacy modes.
  }
}

export function buildBackupPayload({ constants, logs, points }) {
  return {
    app: APP,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    constants,
    logs,
    points
  };
}

export function mergeImportedBackup(parsed, currentState) {
  if (!isObject(parsed)) return { ...currentState, addedLogs: 0, addedPoints: 0, skippedLogs: 0, skippedPoints: 0 };
  const existingLogIds = new Set(currentState.logs.map((l) => l.id));
  const existingPointIds = new Set(currentState.points.map((p) => p.id));

  const rawLogs = Array.isArray(parsed.logs) ? parsed.logs : [];
  const rawPoints = Array.isArray(parsed.points) ? parsed.points : [];
  const normalizedLogs = rawLogs.map((r) => normalizeLog(r, { existingIds: existingLogIds })).filter(Boolean);
  const normalizedPoints = rawPoints.map((r) => normalizePoint(r, { existingIds: existingPointIds })).filter(Boolean);

  return {
    constants: currentState.constants,
    logs: [...normalizedLogs, ...currentState.logs],
    points: [...normalizedPoints, ...currentState.points],
    addedLogs: normalizedLogs.length,
    addedPoints: normalizedPoints.length,
    skippedLogs: rawLogs.length - normalizedLogs.length,
    skippedPoints: rawPoints.length - normalizedPoints.length
  };
}

export function clearKeysOnResetQuery() {
  const params = new URLSearchParams(window.location.search);
  if (!params.has("reset")) return;

  const match = (k) => ["linersync", "qc", "field"].some((t) => String(k || "").toLowerCase().includes(t));

  [localStorage, sessionStorage].forEach((store) => {
    try {
      const keys = [];
      for (let i = 0; i < store.length; i += 1) {
        const k = store.key(i);
        if (match(k)) keys.push(k);
      }
      keys.forEach((k) => store.removeItem(k));
    } catch {}
  });

  try { window.history.replaceState({}, "", window.location.pathname); } catch {}
}
