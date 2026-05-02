import React from "react";

function getGpsVisual(gps = {}) {
  if (!gps.supported) return { label: "NO GPS", color: "#ef4444", bars: 0, detail: "Not supported" };
  if (gps.error === "PERMISSION_DENIED") return { label: "NO GPS", color: "#ef4444", bars: 0, detail: "Permission denied" };
  if (gps.error) return { label: "NO GPS", color: "#ef4444", bars: 0, detail: gps.error };
  if (!gps.timestamp || gps.accuracyFt == null) return { label: "WAIT", color: "#f59e0b", bars: 1, detail: "Looking for GPS" };

  const ageSeconds = Math.floor((Date.now() - gps.timestamp) / 1000);
  if (ageSeconds > 20) return { label: "WAIT", color: "#f59e0b", bars: 1, detail: `Stale ${ageSeconds}s` };
  if (gps.accuracyFt <= 35) return { label: "GOOD", color: "#22c55e", bars: 4, detail: `±${gps.accuracyFt} ft` };
  if (gps.accuracyFt <= 80) return { label: "WAIT", color: "#f59e0b", bars: 2, detail: `±${gps.accuracyFt} ft` };
  return { label: "NO GPS", color: "#ef4444", bars: 1, detail: `Weak ±${gps.accuracyFt} ft` };
}

function GpsShellMeter({ gpsMeter = {} }) {
  const gpsVisual = getGpsVisual(gpsMeter);

  return (
    <div
      title={`GPS Signal: ${gpsVisual.label} ${gpsVisual.detail}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        border: "1px solid #213b63",
        borderRadius: 12,
        background: "#081a36",
        minWidth: 150,
        justifyContent: "space-between"
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-end", gap: 3, minHeight: 24 }}>
        {[1, 2, 3, 4].map((level) => (
          <div
            key={level}
            style={{
              width: 6,
              height: level * 6,
              borderRadius: 2,
              background: level <= gpsVisual.bars ? gpsVisual.color : "#20324f"
            }}
          />
        ))}
      </div>
      <div style={{ lineHeight: 1.1, textAlign: "right" }}>
        <strong style={{ display: "block", color: gpsVisual.color, fontSize: 12 }}>{gpsVisual.label}</strong>
        <small style={{ color: "#d7e3f4", fontSize: 10 }}>{gpsVisual.detail}</small>
      </div>
    </div>
  );
}

export default function AppShell({ status, tab, setTab, children, activeProject, onExitProject, gpsMeter }) {
  const tabs = [["dashboard", "Dashboard"], ["capture", "Capture"], ["logs", "Logs"], ["asbuilt", "As-Built"], ["exports", "Exports"]];

  return (
    <div className="app-shell" data-linersync-mounted="true">
      <header className="shell-header">
        <button className="project-back-btn" onClick={onExitProject}> ‹ Projects </button>
        <div className="shell-project">
          <strong>{activeProject?.name}</strong>
          <span>{[activeProject?.site, activeProject?.area].filter(Boolean).join(" · ") || "Active Job"}</span>
        </div>
        <GpsShellMeter gpsMeter={gpsMeter} />
      </header>
      <nav className="tab-row">
        {tabs.map(([k, l]) => (
          <button key={k} className={tab === k ? " green active " : ""} onClick={() => setTab(k)}>{l}</button>
        ))}
      </nav>
      <main className="main">{children}</main>
      <div className="status-bar">{status}</div>
    </div>
  );
}
