import React from "react";

export default function Logs({ logs = [], onEdit, onCopy, onDelete, onLock }) {
  if (!logs.length) {
    return (
      <section className="page">
        <div className="card empty-state">
          <h3>Logs</h3>
          <p className="muted">No records saved for this project yet.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="page log-list">
      <h3>Logs</h3>

      {logs.map((log) => {
        const gpsText = log.gps?.lat
          ? `${Number(log.gps.lat).toFixed(6)}, ${Number(log.gps.lng).toFixed(6)}`
          : "No GPS";

        const warnings = log.mythosAudit?.warnings?.length
          ? log.mythosAudit.warnings.join("; ")
          : "None";

        return (
          <article key={log.id} className="log-card card">
            <div className="log-header">
              <strong>{log.title || log.type || "Field record"}</strong>
              <span className={`status-pill ${log.status || "DRAFT"}`}>
                {log.status || "DRAFT"}
              </span>
            </div>

            <div className="log-meta">
              <small>Type: {log.type || "Unknown"}</small>
              <small>Time: {log.capturedAt || log.time || "No time"}</small>
              <small>GPS: {gpsText}</small>
              <small>Warnings: {warnings}</small>
            </div>

            <div className="button-row">
              <button onClick={() => onEdit(log)}>Edit</button>
              <button onClick={() => onCopy(log)}>Copy</button>
              <button onClick={() => onDelete(log.id)}>Delete</button>
              <button onClick={() => onLock(log)}>Lock</button>
            </div>
          </article>
        );
      })}
    </section>
  );
}
