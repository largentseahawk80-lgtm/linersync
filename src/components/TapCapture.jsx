import React from "react";
import { RECORD_TYPES } from "../lib/records";

export default function TapCapture({
  session,
  setType,
  visible = true,
  onStartCapture,
  activeProject
}) {
  if (!visible) return null;

  if (!session) {
    return (
      <section className="page capture-page">
        <div className="card capture-ready-card">
          <p className="eyebrow">Tap Capture</p>
          <h2>Start a field record</h2>
          <p className="muted">
            Capture GPS/time first, then choose Repair, Seam, Panel, Roll, Wedge Test, Extrusion, Air Test, DT, or Daily.
          </p>

          <button
            className="project-create-btn"
            onClick={onStartCapture}
            disabled={!activeProject}
          >
            TAP TO CAPTURE GPS
          </button>

          {!activeProject ? (
            <p className="warning-text">Open a project before capturing records.</p>
          ) : null}
        </div>
      </section>
    );
  }

  const gpsText = session.gps?.lat
    ? `${session.gps.lat.toFixed(6)}, ${session.gps.lng.toFixed(6)} ±${Math.round(session.gps.accuracy || 0)}m`
    : session.gps?.error || "No GPS captured";

  return (
    <section className="page capture-page">
      <div className="card capture-ready-card">
        <p className="eyebrow">Capture Complete</p>
        <h2>Choose record type</h2>

        <div className="capture-facts">
          <span>Time</span>
          <strong>{session.capturedAt}</strong>
          <span>GPS</span>
          <strong>{gpsText}</strong>
        </div>

        <label>
          Record type
          <select
            value={session.selectedType || ""}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="">Select type</option>
            {RECORD_TYPES.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </label>

        <div className="type-count-grid capture-type-grid">
          {RECORD_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              className={session.selectedType === type ? "active-choice" : ""}
              onClick={() => setType(type)}
            >
              {type}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
