import React, { useMemo } from "react";

function getAuditLabel(status = "", auditReport = null) {
  const reportStatus = String(auditReport?.status || "").toUpperCase();
  if (["PASS", "WARNING", "CRITICAL"].includes(reportStatus)) return reportStatus;
  if (status.includes("Audit PASS")) return "PASS";
  if (status.includes("Audit WARNING")) return "WARNING";
  if (status.includes("Audit CRITICAL")) return "CRITICAL";
  if (status.includes("Audit error")) return "ERROR";
  if (status.includes("Audit skipped")) return "SKIPPED";
  if (status.includes("Mirror synced")) return "SYNCED";
  return "STANDBY";
}

function getHealthText(auditLabel) {
  if (auditLabel === "PASS") return "Ready for export checks";
  if (auditLabel === "WARNING") return "Warnings found";
  if (auditLabel === "CRITICAL") return "Fix before final export";
  if (auditLabel === "ERROR") return "Audit needs attention";
  if (auditLabel === "SKIPPED") return "Audit skipped";
  if (auditLabel === "SYNCED") return "Mirror synced";
  return "Waiting for next locked log";
}

export default function Dashboard({
  startCapture,
  visible = true,
  activeProject = null,
  logs = [],
  setTab,
  orphanCount = 0,
  status = "Ready",
  auditReport = null,
  gpsMeter = null
}) {
  const latestLogs = useMemo(() => logs.slice(0, 5), [logs]);
  const lockedCount = useMemo(() => logs.filter((l) => l.status === "LOCKED").length, [logs]);
  const auditLabel = useMemo(() => getAuditLabel(status, auditReport), [status, auditReport]);
  const criticalCount = auditReport?.summary?.criticalCount || 0;
  const warningCount = auditReport?.summary?.warningCount || 0;
  const unresolvedRepairs = auditReport?.summary?.unresolvedRepairs || 0;
  const exportBlocked = Boolean(auditReport?.exportBlocked || auditLabel === "CRITICAL");
  const lastAuditTime = auditReport?.generatedAt
    ? new Date(auditReport.generatedAt).toLocaleString()
    : "Not run yet";

  if (!visible) return null;

  return (
    <section className="page dashboard-page">
      <div className="card project-banner">
        <p className="eyebrow">CURRENT PROJECT</p>
        <h2>{activeProject?.name || "LinerSync"}</h2>
        <p className="muted">
          {[activeProject?.client, activeProject?.site, activeProject?.area].filter(Boolean).join(" · ") || "Field QC"}
        </p>
        {orphanCount > 0 ? (
          <p className="warning-text">Orphan map points hidden: {orphanCount}</p>
        ) : null}
      </div>

      <button className="tap-btn" onClick={startCapture}>TAP CAPTURE</button>

      <div className="dashboard-grid">
        <div className="card stat-card"><span>Total Logs</span><strong>{logs.length}</strong></div>
        <div className="card stat-card"><span>Locked</span><strong>{lockedCount}</strong></div>
        <div className="card stat-card"><span>Audit Status</span><strong>{auditLabel}</strong></div>
      </div>

      <div className="card">
        <div className="section-title-row">
          <h3>Project Health</h3>
          <strong>{auditLabel}</strong>
        </div>
        <p>{getHealthText(auditLabel)}</p>
        <div className="dashboard-grid">
          <div className="stat-card"><span>Critical</span><strong>{criticalCount}</strong></div>
          <div className="stat-card"><span>Warnings</span><strong>{warningCount}</strong></div>
          <div className="stat-card"><span>Repairs Open</span><strong>{unresolvedRepairs}</strong></div>
        </div>
        <p className={exportBlocked ? "warning-text" : "muted"}>
          Export blocked: {exportBlocked ? "YES" : "NO"} · Last audit: {lastAuditTime}
        </p>
        {gpsMeter?.error ? <p className="warning-text">GPS warning: {gpsMeter.error}</p> : null}
      </div>

      <div className="card">
        <div className="section-title-row">
          <h3>Latest Audit</h3>
        </div>
        <p>{status}</p>
      </div>

      <div className="card">
        <div className="section-title-row">
          <h3>Latest Logs</h3>
          <button className="small-btn" onClick={() => setTab("logs")}>View All</button>
        </div>
        {latestLogs.length === 0 ? (
          <p className="muted">No records saved yet.</p>
        ) : (
          <div className="latest-log-list">
            {latestLogs.map((l) => (
              <article key={l.id} className="latest-log-item">
                <strong>{l.title || l.type}</strong>
                <span>{l.status} • {l.type}</span>
                <small>{l.time || ""}</small>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
