import React from "react";

export default function Dashboard({ startCapture, visible = true }) {
  if (!visible) return null;
  return (
    <section className="page">
      <button className="tap-btn" onClick={startCapture}>TAP CAPTURE</button>
    </section>
  );
}
