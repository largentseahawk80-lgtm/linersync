import React from "react";

export default function AppShell({ status, tab, setTab, children }) {
  return (
    <div className="app-shell" data-linersync-mounted="true">
      <div className="button-row">
        <button className={tab === "dashboard" ? "green" : ""} onClick={() => setTab("dashboard")}>Dashboard</button>
        <button className={tab === "capture" ? "green" : ""} onClick={() => setTab("capture")}>Capture</button>
        <button className={tab === "logs" ? "green" : ""} onClick={() => setTab("logs")}>Logs</button>
        <button className={tab === "asbuilt" ? "green" : ""} onClick={() => setTab("asbuilt")}>As-Built</button>
        <button className={tab === "exports" ? "green" : ""} onClick={() => setTab("exports")}>Exports</button>
      </div>
      <main className="main">{children}</main>
      <div className="status-bar">{status}</div>
    </div>
  );
}
