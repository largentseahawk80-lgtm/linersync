import { normalizeLog, normalizePoint, mergeImportedBackup } from "../src/lib/storage.js";

const logs = [{ id: "1", type: "Repair", status: "LOCKED", fields: { repairType: "Patch" } }, { type: "BAD" }];
const points = [{ id: "p1", kind: "Repair", x: 120, y: -20 }, { kind: "Nope", x: 1, y: 1 }];

const n1 = normalizeLog(logs[0], { existingIds: new Set() });
if (!n1 || n1.type !== "Repair") throw new Error("normalizeLog failed valid input");
if (normalizeLog(logs[1], { existingIds: new Set() }) !== null) throw new Error("normalizeLog should reject unknown type");

const p1 = normalizePoint(points[0], { existingIds: new Set() });
if (!p1 || p1.x !== 100 || p1.y !== 0) throw new Error("normalizePoint clamp failed");
if (normalizePoint(points[1], { existingIds: new Set() }) !== null) throw new Error("normalizePoint should reject unknown kind");

const merged = mergeImportedBackup({ logs, points }, { constants: {}, logs: [], points: [] });
if (merged.addedLogs !== 1 || merged.addedPoints !== 1) throw new Error("mergeImportedBackup counts failed");

console.log("normalize validation passed");
