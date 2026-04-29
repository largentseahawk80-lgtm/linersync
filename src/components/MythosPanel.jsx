import React from "react";

export default function MythosPanel({ audit }) {
  if (!audit) return null;
  return <div className="card"><h3>Mythos Audit</h3><p>Can Lock: <strong>{audit.canLock ? "YES" : "NO"}</strong></p><p>Warnings: {(audit.warnings || []).join(", ") || "None"}</p><p>Blockers: {(audit.blockers || []).join(", ") || "None"}</p></div>;
}
