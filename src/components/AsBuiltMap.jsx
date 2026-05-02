import React from "react";

function clampPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 50;
  return Math.max(2, Math.min(98, number));
}

export default function AsBuiltMap({ points = [], addPoint }) {
  return (
    <section className="page">
      <h3>As-Built</h3>

      {!points.length ? (
        <div className="card empty-state">
          <p className="muted">
            No as-built points yet. Capture a GPS record first, or tap the map to place a manual point.
          </p>
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
    </section>
  );
}
