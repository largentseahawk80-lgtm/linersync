import React, { useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";

const STORAGE_KEY = "linersync_working_field_app_v2";
const TYPES = ["Repair", "Seam", "Panel", "Roll", "Wedge Test", "Extrusion", "Air Test", "DT", "Daily"];

function now12() {
  return new Date().toLocaleString([], { hour12: true });
}

function uid() {
  return `LS-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function blankConstants() {
  return {
    project: "",
    qcTech: "",
    installer: "",
    activeRoll: "",
    activePanel: "",
    activeSeam: "",
    linerType: "HDPE",
    thickness: "60 mil",
    width: "23 ft",
    weather: ""
  };
}

function App() {
  const [tab, setTab] = useState("capture");
  const [constants, setConstants] = useState(blankConstants);
  const [logs, setLogs] = useState([]);
  const [type, setType] = useState("Repair");
  const [form, setForm] = useState({});
  const [gps, setGps] = useState(null);
  const [status, setStatus] = useState("App loaded. Ready to log field data.");

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (saved) {
        setConstants({ ...blankConstants(), ...(saved.constants || {}) });
        setLogs(saved.logs || []);
        setStatus("Restored saved phone data.");
      }
    } catch {
      setStatus("Started clean. Save will still work.");
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ constants, logs }));
  }, [constants, logs]);

  const draft = useMemo(() => ({
    ...form,
    roll: form.roll || constants.activeRoll,
    panel: form.panel || constants.activePanel,
    seam: form.seam || constants.activeSeam,
    linerType: constants.linerType,
    thickness: constants.thickness,
    width: constants.width
  }), [form, constants]);

  function patchConstants(key, value) {
    setConstants((old) => ({ ...old, [key]: value }));
  }

  function patchForm(key, value) {
    setForm((old) => ({ ...old, [key]: value }));
  }

  function captureGps() {
    if (!navigator.geolocation) {
      setStatus("GPS not available in this browser.");
      return;
    }
    setStatus("Requesting GPS permission...");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const point = {
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          accuracyFt: Math.round((p.coords.accuracy || 0) * 3.28084),
          time: now12()
        };
        setGps(point);
        setStatus(`GPS captured ±${point.accuracyFt} ft.`);
      },
      () => setStatus("GPS blocked. Allow location permission for this site."),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  function saveLog(locked = false) {
    const record = {
      id: uid(),
      type,
      status: locked ? "LOCKED" : "DRAFT",
      time: now12(),
      gps,
      constants: { ...constants },
      fields: { ...draft },
      notes: form.notes || ""
    };
    setLogs((old) => [record, ...old]);
    setForm({});
    setGps(null);
    setTab("logs");
    setStatus(`${type} saved.`);
  }

  function download(name, text, mime) {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportCsv() {
    const headers = ["id", "type", "status", "time", "project", "roll", "panel", "seam", "lat", "lng", "accuracyFt", "fields", "notes"];
    const rows = logs.map((r) => [
      r.id, r.type, r.status, r.time, r.constants.project, r.fields.roll, r.fields.panel, r.fields.seam,
      r.gps?.lat || "", r.gps?.lng || "", r.gps?.accuracyFt || "", JSON.stringify(r.fields), r.notes
    ]);
    const esc = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;
    const csv = [headers.join(","), ...rows.map((row) => row.map(esc).join(","))].join("\n");
    download("linersync_logs.csv", csv, "text/csv");
  }

  function exportKml() {
    const marks = logs.filter((r) => r.gps).map((r) => `<Placemark><name>${r.type} ${r.fields.repairId || r.fields.seam || r.fields.panel || r.id}</name><description><![CDATA[${r.time}<br/>Roll: ${r.fields.roll || ""}<br/>Panel: ${r.fields.panel || ""}<br/>Seam: ${r.fields.seam || ""}<br/>Notes: ${r.notes || ""}]]></description><Point><coordinates>${r.gps.lng},${r.gps.lat},0</coordinates></Point></Placemark>`).join("\n");
    download("linersync_points.kml", `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>LinerSync Points</name>${marks}</Document></kml>`, "application/vnd.google-earth.kml+xml");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">LS</div><div><h1>LINERSYNC</h1><p>WORKING FIELD APP</p></div></div>
        <nav>{["capture", "logs", "exports"].map((x) => <button key={x} className={tab === x ? "active" : ""} onClick={() => setTab(x)}>{x.toUpperCase()}</button>)}</nav>
        <div className="side-card"><div className="tiny">ACTIVE</div><strong>Roll {constants.activeRoll || "-"} • Panel {constants.activePanel || "-"} • Seam {constants.activeSeam || "-"}</strong></div>
        <div className="side-card"><div className="tiny">SAVED LOGS</div><strong>{logs.length}</strong></div>
      </aside>

      <main className="main">
        <header className="topbar"><div><div className="tiny">Current Build</div><strong>LinerSync Field Current App</strong></div><div className="gps-pill">{gps ? `${gps.lat.toFixed(6)}, ${gps.lng.toFixed(6)}` : "GPS ready"}</div></header>

        {tab === "capture" && <section className="page">
          <h2>Tap Capture</h2>
          <p className="muted">This version loads, saves logs on the phone, captures GPS, keeps constant job data, and exports CSV/KML.</p>

          <div className="card"><h3>Constant Job Data</h3><div className="form-grid">
            <label>Project<input value={constants.project} onChange={(e) => patchConstants("project", e.target.value)} /></label>
            <label>QC Tech<input value={constants.qcTech} onChange={(e) => patchConstants("qcTech", e.target.value)} /></label>
            <label>Installer<input value={constants.installer} onChange={(e) => patchConstants("installer", e.target.value)} /></label>
            <label>Active Roll<input value={constants.activeRoll} onChange={(e) => patchConstants("activeRoll", e.target.value)} /></label>
            <label>Active Panel<input value={constants.activePanel} onChange={(e) => patchConstants("activePanel", e.target.value)} /></label>
            <label>Active Seam<input value={constants.activeSeam} onChange={(e) => patchConstants("activeSeam", e.target.value)} /></label>
            <label>Liner Type<input value={constants.linerType} onChange={(e) => patchConstants("linerType", e.target.value)} /></label>
            <label>Thickness<input value={constants.thickness} onChange={(e) => patchConstants("thickness", e.target.value)} /></label>
            <label>Width<input value={constants.width} onChange={(e) => patchConstants("width", e.target.value)} /></label>
            <label>Weather<input value={constants.weather} onChange={(e) => patchConstants("weather", e.target.value)} /></label>
          </div></div>

          <div className="card"><h3>New Field Log</h3><div className="form-grid">
            <label>Type<select value={type} onChange={(e) => setType(e.target.value)}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
            <label>Repair ID<input value={form.repairId || ""} onChange={(e) => patchForm("repairId", e.target.value)} /></label>
            <label>Repair Type<input placeholder="patch, bead, cap" value={form.repairType || ""} onChange={(e) => patchForm("repairType", e.target.value)} /></label>
            <label>Roll<input value={draft.roll || ""} onChange={(e) => patchForm("roll", e.target.value)} /></label>
            <label>Panel<input value={draft.panel || ""} onChange={(e) => patchForm("panel", e.target.value)} /></label>
            <label>Seam<input value={draft.seam || ""} onChange={(e) => patchForm("seam", e.target.value)} /></label>
            <label>East AT Feet<input value={form.eastATFt || ""} onChange={(e) => patchForm("eastATFt", e.target.value)} /></label>
            <label>South AT Feet<input value={form.southATFt || ""} onChange={(e) => patchForm("southATFt", e.target.value)} /></label>
            <label>Result<input value={form.result || ""} onChange={(e) => patchForm("result", e.target.value)} /></label>
          </div><label>Notes<textarea value={form.notes || ""} onChange={(e) => patchForm("notes", e.target.value)} /></label>
          <div className="button-row"><button onClick={captureGps}>Capture GPS</button><button onClick={() => saveLog(false)}>Save Draft</button><button className="green" onClick={() => saveLog(true)}>Approve / Lock</button></div>
          </div>
        </section>}

        {tab === "logs" && <section className="page"><h2>Last Logs</h2><div className="kpis"><div className="kpi"><strong>{logs.length}</strong><span>Total</span></div><div className="kpi"><strong>{logs.filter((l) => l.status === "LOCKED").length}</strong><span>Locked</span></div></div><div className="log-list">{logs.map((r) => <article className="log" key={r.id}><strong>{r.type} • {r.status}</strong><p>{r.time}</p><p>Roll {r.fields.roll || "-"} • Panel {r.fields.panel || "-"} • Seam {r.fields.seam || "-"}</p><p>{r.gps ? `GPS ${r.gps.lat.toFixed(6)}, ${r.gps.lng.toFixed(6)} ±${r.gps.accuracyFt}ft` : "No GPS"}</p><pre>{JSON.stringify(r.fields, null, 2)}</pre><div className="button-row"><button onClick={() => setLogs((old) => old.filter((x) => x.id !== r.id))}>Delete</button></div></article>)}</div></section>}

        {tab === "exports" && <section className="page"><h2>Exports</h2><div className="export-grid"><div className="card"><h3>CSV</h3><p className="muted">Office / Excel log export.</p><button onClick={exportCsv}>Download CSV</button></div><div className="card"><h3>KML</h3><p className="muted">Google Earth GPS point export.</p><button onClick={exportKml}>Download KML</button></div><div className="card"><h3>JSON Backup</h3><button onClick={() => download("linersync_backup.json", JSON.stringify({ constants, logs }, null, 2), "application/json")}>Download Backup</button></div></div></section>}
      </main>
      <div className="status-bar">{status}</div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
