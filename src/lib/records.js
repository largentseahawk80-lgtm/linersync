export const RECORD_TYPES = ["Repair","Seam","Panel","Roll","Wedge Test","Extrusion","Air Test","DT","Daily"];

export const FIELDS_BY_TYPE = {
  Repair: ["repairId", "repairType", "verifiedBy"],
  Seam: ["seam", "panelA", "panelB", "welder"],
  Panel: ["panel", "roll"],
  Roll: ["roll", "manufacturer", "lot", "certStatus"],
  "Wedge Test": ["seam", "machine", "peel", "shear", "result"],
  Extrusion: ["repairId", "rodLot", "result"],
  "Air Test": ["seam", "startPsi", "endPsi", "holdMinutes", "result"],
  DT: ["dtNumber", "seam", "result"],
  Daily: ["crew", "weather"]
};

export const colorForType = (type) => ({
  Repair: "#f59e0b", Seam: "#38bdf8", Panel: "#22c55e", Roll: "#a78bfa",
  "Wedge Test": "#fb7185", Extrusion: "#06b6d4", "Air Test": "#f97316", DT: "#ef4444", Daily: "#84cc16"
}[type] || "#94a3b8");

export const uid = (prefix = "LS") => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
export const nowIso = () => new Date().toISOString();
