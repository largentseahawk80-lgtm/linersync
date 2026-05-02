import React from "react";

function clampPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 50;
  return Math.max(2, Math.min(98, number));
}

export default function AsBuiltMap({ points = [], addPoint, orphanCount = 0 }) {
  return (
    <section className="page">
      <div className="section-title-row">
        <h3>As-Built</h3>
        {orphanCount > 0 ? (
          <span className="warning-text small">{orphanCount} unlinked points hidden</span>
        ) : null}
      </div>

      {!points.length && !orphanCount ? (
        <div className="card empty-state">
          <p className="muted">No as-built points yet. Capture a GPS record first, or tap the map to place a manual point.</p>
        </div>
      ) : null}

      <div className="mapbox" onClick={addPoint}>
        {points.map((point) => {
          const left = clampPercent(point.x);
          const top = clampPercent(point.y);
          const label = String(point.kind || point.type || "P").charAt(0).toUpperCase();

          return (
            <div
              key={point.id}
              className="pin"
              style={{
                left: `${left}%`,
                top: `${top}%`,
                background: point.color || "#f59e0b"
              }}
              title={point.label || "As-built point"}
            >
              {label}
            </div>
          );
        })}
      </div>

      {orphanCount > 0 ? (
        <p className="muted" style={{ marginTop: 8, textAlign: "center", fontSize: "0.78rem" }}>
          {orphanCount} unlinked map points hidden from production map for data integrity.
        </p>
      ) : null}
    </section>
  );
}
