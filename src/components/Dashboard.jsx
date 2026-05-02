import React, { useMemo } from "react";

export default function Dashboard({
  startCapture,
  visible = true,
  activeProject = null,
  logs = [],
  setTab,
  orphanCount = 0
}) {
  const latestLogs = useMemo(() => logs.slice(0, 5), [logs]);
  const lockedCount = useMemo(() => logs.filter((l) => l.status === "LOCKED").length, [logs]);

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
