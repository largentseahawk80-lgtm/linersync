import React from "react";
import { RECORD_TYPES } from "../lib/records";

export default function TapCapture({ session, setType, visible = true }) {
  if (!visible || !session) return null;

  return (
    <section className="page">
      <div className="card">
        <h3>Capture Complete</h3>
        <p>{session.capturedAt}</p>
        <p>
          {session.gps?.lat
            ? `${session.gps.lat.toFixed(6)}, ${session.gps.lng.toFixed(6)} ±${Math.round(session.gps.accuracy || 0)}m`
            : session.gps?.error || "No GPS"}
        </p>
        <select value={session.selectedType || ""} onChange={(e) => setType(e.target.value)}>
          <option value="">Select type</option>
          {RECORD_TYPES.map((type) => <option key={type}>{type}</option>)}
        </select>
      </div>
    </section>
  );
}
