import { RECORD_TYPES, uid } from "./records";

const ALLOWED_STATUSES = new Set(["DRAFT", "LOCKED"]);
const ALLOWED_TYPES = new Set(RECORD_TYPES);

const isPlainObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const safeString = (value) => (typeof value === "string" ? value : "");
const safeStringArray = (value) => Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];

export function normalizeGps(gps) {
  if (!isPlainObject(gps)) return null;
  const lat = Number(gps.lat);
  const lng = Number(gps.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const normalized = { lat, lng };
  const accuracy = Number(gps.accuracy);
  if (Number.isFinite(accuracy)) normalized.accuracy = accuracy;
  if (typeof gps.capturedAt === "string") normalized.capturedAt = gps.capturedAt;
  return normalized;
}

export function normalizeFields(fields) {
  if (!isPlainObject(fields)) return {};
  const normalized = {};
  Object.entries(fields).forEach(([key, value]) => {
    if (["string", "number", "boolean"].includes(typeof value) || value === null) {
      normalized[key] = value;
      return;
    }
    if (Array.isArray(value) || isPlainObject(value)) {
      try {
        normalized[key] = JSON.stringify(value);
      } catch {
        // skip unstringifiable nested values
      }
    }
  });
  return normalized;
}

export function normalizeMythosAudit(mythosAudit) {
  const source = isPlainObject(mythosAudit) ? mythosAudit : {};
  return {
    warnings: safeStringArray(source.warnings),
    blockers: safeStringArray(source.blockers),
    canLock: Boolean(source.canLock),
    overrideUsed: Boolean(source.overrideUsed)
  };
}

export function normalizeLog(log) {
  if (!isPlainObject(log)) return null;
  if (!ALLOWED_TYPES.has(log.type)) return null;
  return {
    id: safeString(log.id),
    type: log.type,
    title: safeString(log.title),
    status: ALLOWED_STATUSES.has(log.status) ? log.status : "DRAFT",
    time: safeString(log.time),
    capturedAt: safeString(log.capturedAt),
    gps: normalizeGps(log.gps),
    constants: isPlainObject(log.constants) ? { ...log.constants } : {},
    fields: normalizeFields(log.fields),
    notes: safeString(log.notes),
    photo: safeString(log.photo),
    mythosAudit: normalizeMythosAudit(log.mythosAudit),
    verifiedBy: safeString(log.verifiedBy),
    verifiedAt: safeString(log.verifiedAt),
    overrideReason: safeString(log.overrideReason)
  };
}

const clamp100 = (n) => Math.max(0, Math.min(100, n));

export function normalizePoint(point) {
  if (!isPlainObject(point)) return null;
  const x = Number(point.x);
  const y = Number(point.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const kind = ALLOWED_TYPES.has(point.kind) ? point.kind : "Repair";
  return {
    id: safeString(point.id),
    kind,
    label: safeString(point.label),
    x: clamp100(x),
    y: clamp100(y),
    color: safeString(point.color),
    recordId: safeString(point.recordId),
    gps: normalizeGps(point.gps)
  };
}

export function normalizeState(state) {
  const base = { constants: {}, logs: [], points: [] };
  if (!isPlainObject(state)) return { state: base, repaired: true };
  const logs = Array.isArray(state.logs) ? state.logs.map(normalizeLog).filter(Boolean) : [];
  const points = Array.isArray(state.points) ? state.points.map(normalizePoint).filter(Boolean) : [];
  const constants = isPlainObject(state.constants) ? { ...state.constants } : {};
  const repaired = !Array.isArray(state.logs) || !Array.isArray(state.points) || !isPlainObject(state.constants)
    || logs.length !== state.logs.length || points.length !== state.points.length;
  return { state: { constants, logs, points }, repaired };
}

export function mergeImportedData(existingLogs, existingPoints, parsed) {
  const importedLogs = Array.isArray(parsed?.logs) ? parsed.logs : Array.isArray(parsed?.records) ? parsed.records : [];
  const importedPoints = Array.isArray(parsed?.points) ? parsed.points : [];

  const existingLogIds = new Set(existingLogs.map((log) => log.id));
  const existingPointIds = new Set(existingPoints.map((point) => point.id));
  const idMap = new Map();

  let skippedLogs = 0;
  const newLogs = [];
  importedLogs.forEach((entry) => {
    const normalized = normalizeLog(entry);
    if (!normalized) {
      skippedLogs += 1;
      return;
    }
    let nextId = normalized.id || uid("LOG");
    while (existingLogIds.has(nextId)) nextId = uid("LOG");
    if (normalized.id && nextId !== normalized.id) idMap.set(normalized.id, nextId);
    normalized.id = nextId;
    existingLogIds.add(nextId);
    newLogs.push(normalized);
  });

  let skippedPoints = 0;
  const newPoints = [];
  importedPoints.forEach((entry) => {
    const normalized = normalizePoint(entry);
    if (!normalized) {
      skippedPoints += 1;
      return;
    }
    if (normalized.recordId && idMap.has(normalized.recordId)) normalized.recordId = idMap.get(normalized.recordId);
    let nextId = normalized.id || uid("PT");
    while (existingPointIds.has(nextId)) nextId = uid("PT");
    normalized.id = nextId;
    existingPointIds.add(nextId);
    newPoints.push(normalized);
  });

  return {
    logs: [...newLogs, ...existingLogs],
    points: [...newPoints, ...existingPoints],
    skippedLogs,
    skippedPoints,
    importedLogs: newLogs.length,
    importedPoints: newPoints.length
  };
}
