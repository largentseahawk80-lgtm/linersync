import { FIELDS_BY_TYPE } from "./records";

const needsSeam = ["Seam", "Wedge Test", "Air Test", "DT", "Repair", "Extrusion"];

export function buildMythosAudit(session, overrideReason = "") {
  const warnings = [];
  const blockers = [];
  const fields = session.fields || {};
  const type = session.selectedType;
  const c = session.activeContext || {};

  if (!c.project) warnings.push("Missing project");
  if (!c.activeRoll) warnings.push("Missing active roll");
  if (!c.activePanel) warnings.push("Missing active panel");
  if (needsSeam.includes(type) && !(fields.seam || c.activeSeam)) warnings.push("Missing active seam");
  if (!session.gps?.lat || !session.gps?.lng) blockers.push("Missing GPS");
  if (!type) blockers.push("Missing record type");

  (FIELDS_BY_TYPE[type] || []).forEach((name) => { if (!fields[name]) blockers.push(`Missing required field: ${name}`); });

  if (type === "Air Test") {
    if (Number(fields.holdMinutes || 0) < 5) blockers.push("Air Test holdMinutes below 5");
    if (!fields.startPsi || !fields.endPsi) blockers.push("Missing startPsi/endPsi");
  }
  if (type === "Wedge Test") {
    if (!fields.seam && !c.activeSeam) blockers.push("Missing seam");
    if (!fields.machine) warnings.push("Missing machine");
    if (!fields.peel || !fields.shear || !fields.result) blockers.push("Missing peel/shear/result");
  }
  if (type === "Extrusion") {
    if (!fields.repairId) warnings.push("Missing repairId");
    if (!fields.rodLot) warnings.push("Missing rodLot");
    if (!fields.result) blockers.push("Missing result");
  }
  if (type === "Repair") {
    if (!fields.repairId) warnings.push("Missing repairId");
    if (!fields.repairType) blockers.push("Missing repairType");
  }
  if (type === "DT" && (!fields.dtNumber || !(fields.seam || c.activeSeam) || !fields.result)) blockers.push("DT requires dtNumber, seam, result");
  if (type === "Panel" && (!fields.panel || !fields.roll)) blockers.push("Panel requires panel and roll");
  if (type === "Roll" && !fields.roll) blockers.push("Roll requires roll");
  if (type === "Daily" && (!fields.crew || !fields.weather)) warnings.push("Missing crew/weather");

  const canLock = blockers.length === 0 || Boolean(overrideReason?.trim());
  return { warnings, blockers, canLock, overrideUsed: Boolean(overrideReason?.trim()) };
}
