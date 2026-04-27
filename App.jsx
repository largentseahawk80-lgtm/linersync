
import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity, Archive, Brain, Camera, CheckCircle2, Copy, Crosshair, Download,
  Eye, FileText, Grid3X3, Map, Package, Plus, Radio, Save, Search,
  ShieldCheck, Trash2, Wrench, Zap
} from "lucide-react";
import "./styles.css";

const MODULES = [
  { id: "roll", label: "Roll Inventory", icon: Package, desc: "Roll number, width, type, certs" },
  { id: "panel", label: "Panel Placement", icon: Grid3X3, desc: "Panel, roll, location, deployment" },
  { id: "seam", label: "Seam Log", icon: Zap, desc: "Seam number, panels, welder, footage" },
  { id: "wedge", label: "Wedge Test", icon: Activity, desc: "Temp, speed, peel, shear" },
  { id: "extrusion", label: "Extrusion Log", icon: Wrench, desc: "Extruder, rod lot, patch/bead" },
  { id: "air", label: "Air Test", icon: Radio, desc: "Start/end PSI and hold" },
  { id: "dt", label: "Destructive Test", icon: ShieldCheck, desc: "DT ID, seam, station" },
  { id: "repair", label: "Repair Log", icon: Wrench, desc: "Patch, bead, cap, vacuum" },
  { id: "daily", label: "Daily Log", icon: FileText, desc: "Crew, weather, production" }
];

const FIELD_MAP = {
  roll: [["Roll Number","rollNumber"], ["Lot Number","lotNumber"], ["Manufacturer","manufacturer"], ["Cert Status","certStatus"], ["Roll Width","rollWidth"], ["Roll Length","rollLength"]],
  panel: [["Panel Number","panelNumber"], ["Roll Number","rollNumber"], ["Panel Size","panelSize"], ["Direction / Area","direction"], ["Panel Width","panelWidth"], ["Panel Length","panelLength"]],
  seam: [["Seam Number","seamNumber"], ["Panel A","panelA"], ["Panel B","panelB"], ["Welder","welder"], ["Weld Type","weldType"], ["Length / Station","lengthStation"]],
  wedge: [["Seam Number","seamNumber"], ["Machine","machine"], ["Temperature","temperature"], ["Speed","speed"], ["Peel Result","peel"], ["Shear Result","shear"]],
  extrusion: [["Repair / Seam","repairSeam"], ["Extruder","extruder"], ["Rod Lot","rodLot"], ["Preheat / Prep","prep"], ["Result","result"]],
  air: [["Seam Number","seamNumber"], ["Start PSI","startPsi"], ["End PSI","endPsi"], ["Hold Minutes","holdMinutes"], ["Result","result"]],
  dt: [["DT Number","dtNumber"], ["Seam Number","seamNumber"], ["Station / Footage","station"], ["Lab Number","labNumber"], ["Result","result"]],
  repair: [["Repair ID","repairId"], ["Repair Type","repairType"], ["Related Seam","relatedSeam"], ["Size","size"], ["East AT Feet","eastATFt"], ["South AT Feet","southATFt"], ["Verified By","verifiedBy"]],
  daily: [["Crew","crew"], ["Weather","weather"], ["Production","production"], ["Delays / Issues","issues"]]
};

const CONSTANTS = [
  ["projectName","Project"], ["client","Client"], ["qcTech","QC Tech"], ["installer","Installer"], ["crew","Crew"],
  ["activeRollNumber","Active Roll #"], ["activePanel","Active Panel / Area"], ["activeSeam","Active Seam"],
  ["linerType","Liner Type"], ["linerThickness","Thickness"], ["linerWidth","Width"], ["textureColor","Texture / Color"],
  ["wedgeMachine","Wedge Machine"], ["extrusionWelder","Extrusion Welder"], ["rodLot","Rod / Resin Lot"], ["weather","Weather"], ["shift","Shift"]
];

const STORAGE_KEY = "linersync_field_current_app_v1";

function now12() {
  return new Date().toLocaleString([], { hour12: true });
}

function uid(prefix = "LS") {
  if (crypto?.randomUUID) return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  return `${prefix}-${Date.now()}`;
}

function blankConstants() {
  return {
    projectName: "", client: "", qcTech: "", installer: "", crew: "", activeRollNumber: "", activePanel: "", activeSeam: "",
    linerType: "HDPE", linerThickness: "60 mil", linerWidth: "23 ft", textureColor: "", wedgeMachine: "", extrusionWelder: "",
    rodLot: "", weather: "", shift: "Day"
  };
}

function initialState() {
  return { constants: blankConstants(), records: [], points: [], tab: "dashboard" };
}

function downloadText(filename, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function makeCsv(records) {
  const rows = records.map((r) => ({
    id: r.id,
    type: r.type,
    title: r.title,
    status: r.status,
    createdAtDisplay: r.createdAtDisplay,
    location: r.location,
    gpsLat: r.gps?.lat ?? "",
    gpsLng: r.gps?.lng ?? "",
    gpsAccuracyFt: r.gps?.accuracyFt ?? "",
    projectName: r.constants.projectName,
    activeRollNumber: r.constants.activeRollNumber,
    activePanel: r.constants.activePanel,
    activeSeam: r.constants.activeSeam,
    linerType: r.constants.linerType,
    linerThickness: r.constants.linerThickness,
    linerWidth: r.constants.linerWidth,
    fields: JSON.stringify(r.fields),
    notes: r.notes
  }));
  if (!rows.length) return "message\nNo records yet";
  const headers = Object.keys(rows[0]);
  const esc = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  return [headers.join(","), ...rows.map((row) => headers.map((h) => esc(row[h])).join(","))].join("\n");
}

function makeKml(records) {
  const marks = records
    .filter((r) => typeof r.gps?.lat === "number" && typeof r.gps?.lng === "number")
    .map((r) => `<Placemark><name>${r.title}</name><description><![CDATA[Type: ${r.type}<br/>Status: ${r.status}<br/>Roll: ${r.constants.activeRollNumber}<br/>Panel: ${r.constants.activePanel}<br/>Seam: ${r.constants.activeSeam}<br/>Notes: ${r.notes || ""}]]></description><Point><coordinates>${r.gps.lng},${r.gps.lat},0</coordinates></Point></Placemark>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>LinerSync QC Points</name>${marks}</Document></kml>`;
}

function colorForKind(kind) {
  if (kind === "seam") return "#38bdf8";
  if (kind === "repair") return "#f59e0b";
  if (kind === "dt") return "#ef4444";
  if (kind === "photo") return "#a78bfa";
  if (kind === "panel") return "#22c55e";
  return "#ff8e18";
}

function moduleLabel(type) {
  return MODULES.find((m) => m.id === type)?.label || type;
}

function recordTitle(type, fields, constants) {
  const primary = fields.seamNumber || fields.panelNumber || fields.rollNumber || fields.repairId || fields.dtNumber || constants.activeSeam || constants.activePanel || constants.activeRollNumber || now12();
  return `${moduleLabel(type)} - ${primary}`;
}

function analyzeMythos(constants, records) {
  const issues = [];
  const required = [["projectName","Project name"], ["qcTech","QC tech"], ["activeRollNumber","Active roll number"], ["activePanel","Active panel/area"], ["linerType","Liner type"], ["linerThickness","Liner thickness"], ["linerWidth","Liner width"], ["installer","Installer"], ["weather","Weather"]];
  required.forEach(([key, label]) => {
    if (!String(constants[key] || "").trim()) issues.push({ level: "warning", title: `${label} is missing`, detail: `Auto-fill and exports need ${label.toLowerCase()}.`, action: `Fill ${label} in Constant Job Data.` });
  });
  const seamLogs = records.filter((r) => r.type === "seam");
  const airLogs = records.filter((r) => r.type === "air");
  const dtLogs = records.filter((r) => r.type === "dt");
  const repairLogs = records.filter((r) => r.type === "repair");
  const missingGps = records.filter((r) => !r.gps);
  const drafts = records.filter((r) => r.status !== "locked");
  if (!records.length) issues.push({ level: "danger", title: "No field logs saved yet", detail: "There is no job data saved yet.", action: "Start with Tap Capture." });
  if (seamLogs.length && !dtLogs.length) issues.push({ level: "warning", title: "Seams exist but no DT logged", detail: `${seamLogs.length} seam log(s), zero destructive tests.`, action: "Add a Destructive Test when required." });
  const shortAir = airLogs.filter((r) => Number(r.fields.holdMinutes || 0) > 0 && Number(r.fields.holdMinutes || 0) < 5);
  if (shortAir.length) issues.push({ level: "danger", title: "Air test hold under 5 minutes", detail: `${shortAir.length} air test(s) show short hold time.`, action: "Correct or re-test before approval." });
  if (missingGps.length) issues.push({ level: "warning", title: "Logs missing GPS", detail: `${missingGps.length} record(s) saved without GPS.`, action: "Use Capture GPS/Time before locking key records." });
  if (drafts.length) issues.push({ level: "warning", title: "Draft records not locked", detail: `${drafts.length} record(s) are still drafts.`, action: "Review and lock good records in Last Logs." });
  if (repairLogs.length && !records.some((r) => r.type === "air" || r.type === "extrusion")) issues.push({ level: "warning", title: "Repairs logged without test support", detail: "Repairs exist, but no air/extrusion support logs are saved.", action: "Add verification record if required." });
  if (!issues.length) issues.push({ level: "ok", title: "QC data looks clean", detail: "No obvious missing constants, short air holds, missing GPS, or unlocked drafts.", action: "Keep logging field data." });
  return issues;
}

function nextAction(constants, records) {
  if (!constants.projectName) return "Fill Project Name in Constant Job Data.";
  if (!constants.activeRollNumber) return "Set the active roll number before logging panels/seams.";
  if (!constants.activePanel) return "Set active panel/area.";
  if (!records.some((r) => r.type === "seam")) return "Capture your first Seam Log.";
  if (records.some((r) => r.type === "seam") && !records.some((r) => r.type === "dt")) return "Add the next Destructive Test when required.";
  if (records.some((r) => r.status === "draft")) return "Review and lock draft records in Last Logs.";
  return "Capture the next field item: seam, test, repair, or daily note.";
}

function usePersistedState() {
  const [state, setState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? { ...initialState(), ...JSON.parse(saved) } : initialState();
    } catch {
      return initialState();
    }
  });
  useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(state)), [state]);
  return [state, setState];
}

function App() {
  const [state, setState] = usePersistedState();
  const { constants, records, points } = state;
  const [tab, setTab] = useState(state.tab || "dashboard");
  const [activeType, setActiveType] = useState("seam");
  const [fields, setFields] = useState({});
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [gps, setGps] = useState(null);
  const [query, setQuery] = useState("");
  const [editState, setEditState] = useState(null);
  const [toast, setToast] = useState("Ready");

  useEffect(() => setState((s) => ({ ...s, tab })), [tab]);

  useEffect(() => {
    if (editState) return;
    const next = {};
    for (const [, key] of FIELD_MAP[activeType]) {
      if (key === "rollNumber") next[key] = constants.activeRollNumber;
      if (key === "panelNumber" || key === "panelA") next[key] = constants.activePanel;
      if (key === "seamNumber" || key === "relatedSeam") next[key] = constants.activeSeam;
      if (key === "machine") next[key] = constants.wedgeMachine;
      if (key === "extruder") next[key] = constants.extrusionWelder;
      if (key === "rodLot") next[key] = constants.rodLot;
      if (key === "panelSize") next[key] = [constants.linerWidth, constants.linerThickness, constants.linerType].filter(Boolean).join(" / ");
      if (key === "crew") next[key] = constants.crew || constants.installer;
      if (key === "weather") next[key] = constants.weather;
      if (key === "holdMinutes" && activeType === "air") next[key] = "5";
    }
    setFields(next);
    setLocation(constants.activePanel || constants.activeSeam || "");
  }, [activeType, constants, editState]);

  const setConstants = (patch) => setState((s) => ({ ...s, constants: { ...s.constants, ...patch } }));
  const setRecords = (nextRecords) => setState((s) => ({ ...s, records: typeof nextRecords === "function" ? nextRecords(s.records) : nextRecords }));
  const setPoints = (nextPoints) => setState((s) => ({ ...s, points: typeof nextPoints === "function" ? nextPoints(s.points) : nextPoints }));

  async function captureGps() {
    if (!navigator.geolocation) {
      setToast("GPS not available in this browser");
      return null;
    }
    setToast("Requesting GPS...");
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (p) => {
          const point = { lat: p.coords.latitude, lng: p.coords.longitude, accuracyFt: Math.round((p.coords.accuracy || 0) * 3.28084), capturedAt: now12() };
          setGps(point);
          setToast(`GPS captured ${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`);
          resolve(point);
        },
        () => { setToast("GPS blocked. Allow location in browser settings."); resolve(null); },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  }

  async function saveRecord(lock = false) {
    const finalGps = gps || await captureGps();
    const rec = {
      id: editState?.id || uid("LS"),
      type: activeType,
      title: recordTitle(activeType, fields, constants),
      location,
      status: lock ? "locked" : "draft",
      constants: { ...constants },
      fields: { ...fields },
      gps: finalGps,
      createdAt: editState?.createdAt || new Date().toISOString(),
      createdAtDisplay: editState ? `${editState.createdAtDisplay} • EDITED ${now12()}` : now12(),
      notes
    };
    if (editState) setRecords((old) => old.map((r) => r.id === editState.id ? rec : r));
    else {
      setRecords((old) => [rec, ...old]);
      const kind = activeType === "seam" ? "seam" : activeType === "panel" ? "panel" : activeType === "repair" ? "repair" : activeType === "dt" ? "dt" : "photo";
      setPoints((old) => [{ id: uid("AB"), kind, label: rec.title, x: 12 + Math.random() * 76, y: 12 + Math.random() * 70, color: colorForKind(kind), recordId: rec.id }, ...old]);
    }
    setEditState(null);
    setNotes("");
    setGps(null);
    setToast(`${rec.title} saved`);
    setTab("logs");
  }

  function startEdit(r) {
    setEditState({ id: r.id, createdAt: r.createdAt, createdAtDisplay: r.createdAtDisplay });
    setActiveType(r.type);
    setFields({ ...r.fields });
    setLocation(r.location || "");
    setNotes(r.notes || "");
    setGps(r.gps || null);
    setConstants({ ...r.constants });
    setTab("capture");
  }

  const filteredRecords = records.filter((r) => JSON.stringify(r).toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">LS</div><div><h1>LINERSYNC</h1><p>FIELD APP CURRENT BUILD</p></div></div>
        <Nav tab={tab} setTab={setTab} />
        <div className="side-card"><div className="tiny">MYTHOS NEXT</div><strong>{nextAction(constants, records)}</strong></div>
        <div className="side-card"><div className="tiny">ACTIVE CONSTANTS</div><strong>{[constants.activeRollNumber && `Roll ${constants.activeRollNumber}`, constants.activePanel, constants.activeSeam, constants.linerWidth, constants.linerThickness, constants.linerType].filter(Boolean).join(" • ") || "No constants saved"}</strong></div>
      </aside>
      <main className="main">
        <header className="topbar"><div><div className="tiny">Current repo package</div><strong>LINERSYNC-FIELD-CURRENT-APP</strong></div><div className="gps-pill"><Crosshair size={14}/>{gps ? `${gps.lat.toFixed(6)}, ${gps.lng.toFixed(6)}` : "GPS ready"}</div></header>
        {tab === "dashboard" && <Dashboard constants={constants} records={records} points={points} setTab={setTab} />}
        {tab === "capture" && <Capture editState={editState} activeType={activeType} setActiveType={setActiveType} constants={constants} setConstants={setConstants} fields={fields} setFields={setFields} location={location} setLocation={setLocation} notes={notes} setNotes={setNotes} gps={gps} captureGps={captureGps} saveRecord={saveRecord} setEditState={setEditState} />}
        {tab === "logs" && <Logs records={filteredRecords} allRecords={records} setRecords={setRecords} query={query} setQuery={setQuery} startEdit={startEdit} />}
        {tab === "asbuilt" && <AsBuilt points={points} setPoints={setPoints} constants={constants} />}
        {tab === "vision" && <Vision constants={constants} gps={gps} captureGps={captureGps} points={points} />}
        {tab === "mythos" && <Mythos constants={constants} records={records} points={points} setTab={setTab} />}
        {tab === "exports" && <Exports records={records} points={points} constants={constants} />}
      </main>
      <div className="status-bar">{toast}</div>
    </div>
  );
}

function Nav({ tab, setTab }) {
  const items = [["dashboard", Activity, "Dashboard"], ["capture", Plus, "Tap Capture"], ["logs", Archive, "Last Logs"], ["asbuilt", Map, "As-Built"], ["vision", Eye, "AR Vision"], ["mythos", Brain, "Mythos"], ["exports", Download, "Export"]];
  return <nav>{items.map(([id, Icon, label]) => <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}><Icon size={18}/><span>{label}</span></button>)}</nav>;
}

function Dashboard({ constants, records, points, setTab }) {
  return <section className="page"><h2>Field Dashboard</h2><p className="muted">QC forms, constants auto-fill, GPS/time capture, Last Logs, edit/lock/copy/delete, As-Built, AR Vision placeholder, Mythos checks, CSV/JSON/KML exports.</p><div className="kpis"><Kpi label="Total Logs" value={records.length}/><Kpi label="Seams" value={records.filter(r => r.type === "seam").length}/><Kpi label="As-Built Points" value={points.length}/><Kpi label="Drafts" value={records.filter(r => r.status === "draft").length}/></div><div className="card"><h3>Start Here</h3><p>Use Tap Capture, fill constants once, then every form inherits the active roll/panel/seam until you change it.</p><div className="button-row"><button onClick={() => setTab("capture")}>Tap Capture</button><button onClick={() => setTab("logs")}>Last Logs</button><button onClick={() => setTab("exports")}>Exports</button></div></div><div className="card"><h3>Active Job Data</h3><p>{constants.projectName || "No project name yet"}</p><p className="muted">Roll {constants.activeRollNumber || "-"} • Panel {constants.activePanel || "-"} • Seam {constants.activeSeam || "-"}</p></div></section>;
}
function Kpi({ label, value }) { return <div className="kpi"><strong>{value}</strong><span>{label}</span></div>; }

function Capture({ editState, activeType, setActiveType, constants, setConstants, fields, setFields, location, setLocation, notes, setNotes, gps, captureGps, saveRecord, setEditState }) {
  return <section className="page"><h2>{editState ? "Edit Saved Log" : "Tap Capture"}</h2><p className="muted">Everything that stays constant stays filled until changed: roll, panel, seam, liner type/thickness/width, crew, weather, machine, rod lot.</p>{editState && <div className="card"><h3>Editing {editState.id}</h3><button onClick={() => setEditState(null)}>Cancel Edit</button></div>}<div className="card"><h3>Constant Job Data</h3><div className="form-grid">{CONSTANTS.map(([k,l]) => <label key={k}>{l}<input value={constants[k] || ""} onChange={(e) => setConstants({ [k]: e.target.value })}/></label>)}</div></div><div className="card"><h3>{editState ? "Correct Log" : "New Log"}</h3><label>Module<select value={activeType} onChange={(e) => setActiveType(e.target.value)}>{MODULES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select></label><div className="module-strip">{MODULES.map((m) => { const Icon = m.icon; return <button key={m.id} className={activeType === m.id ? "selected" : ""} onClick={() => setActiveType(m.id)}><Icon size={16}/><span>{m.label}</span></button>; })}</div><label>Location<input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Seam, panel, pond, station..."/></label><div className="form-grid">{FIELD_MAP[activeType].map(([label,key]) => <label key={key}>{label}<input value={fields[key] || ""} onChange={(e) => setFields({ ...fields, [key]: e.target.value })}/></label>)}</div><label>Notes<textarea value={notes} onChange={(e) => setNotes(e.target.value)}/></label><div className="button-row"><button onClick={captureGps}><Camera size={16}/>Capture GPS/Time</button><button onClick={() => saveRecord(false)}><Save size={16}/>Save Draft</button><button className="green" onClick={() => saveRecord(true)}><CheckCircle2 size={16}/>Approve / Lock</button></div><p className="muted">{gps ? `GPS ${gps.lat.toFixed(6)}, ${gps.lng.toFixed(6)} ±${gps.accuracyFt}ft at ${gps.capturedAt}` : "GPS not captured yet."}</p></div></section>;
}

function Logs({ records, allRecords, setRecords, query, setQuery, startEdit }) {
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedId, setSelectedId] = useState("");
  const visible = records.filter((r) => (typeFilter === "all" || r.type === typeFilter) && (statusFilter === "all" || r.status === statusFilter));
  const selected = allRecords.find((r) => r.id === selectedId) || visible[0];

  function lockRecord(id) { setRecords(allRecords.map((r) => r.id === id ? { ...r, status: "locked", createdAtDisplay: `${r.createdAtDisplay} • LOCKED ${now12()}` } : r)); }
  function deleteRecord(id) { setRecords(allRecords.filter((r) => r.id !== id)); if (selectedId === id) setSelectedId(""); }
  function duplicateRecord(r) { const copy = { ...r, id: uid("LS"), title: `${r.title} COPY`, status: "draft", createdAt: new Date().toISOString(), createdAtDisplay: now12() }; setRecords([copy, ...allRecords]); setSelectedId(copy.id); }
  function exportOne(r) { downloadText(`${r.id}_${r.type}_record.json`, JSON.stringify(r, null, 2), "application/json"); }

  return <section className="page"><h2>Last Logs / Saved Data Viewer</h2><p className="muted">Review, edit, lock, copy, delete, and export saved field records.</p><div className="kpis"><Kpi label="All Logs" value={allRecords.length}/><Kpi label="Visible" value={visible.length}/><Kpi label="Locked" value={allRecords.filter(r => r.status === "locked").length}/><Kpi label="Drafts" value={allRecords.filter(r => r.status === "draft").length}/></div><div className="card"><div className="form-grid"><label className="search"><Search size={16}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search seam, roll, panel, repair, GPS, notes..."/></label><label>Module Filter<select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}><option value="all">All Modules</option>{MODULES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select></label><label>Status Filter<select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="all">All Status</option><option value="draft">Draft</option><option value="locked">Locked</option></select></label><label>Export Visible<button onClick={() => downloadText("LinerSync_LastLogs_visible.csv", makeCsv(visible), "text/csv")}><Download size={16}/>CSV</button></label></div></div><div className="asbuilt-layout"><div className="log-list">{visible.length === 0 ? <div className="card"><h3>No saved logs found</h3><p className="muted">Go to Tap Capture and save the first record.</p></div> : visible.map((r) => <article className="log" key={r.id} onClick={() => setSelectedId(r.id)} style={{ borderColor: selected?.id === r.id ? "var(--orange)" : "var(--line)", cursor: "pointer" }}><div><strong>{r.title}</strong><p>{r.createdAtDisplay} • {r.status.toUpperCase()} • {r.location || "No location"}</p><p>Roll {r.constants.activeRollNumber || "-"} • Panel {r.constants.activePanel || "-"} • Seam {r.constants.activeSeam || "-"}</p><p>{Object.entries(r.fields).filter(([,v]) => v).map(([k,v]) => `${k}: ${v}`).join(" • ") || "No field values"}</p><div className="button-row"><button onClick={(e) => { e.stopPropagation(); startEdit(r); }}><Save size={14}/>Edit</button><button onClick={(e) => { e.stopPropagation(); lockRecord(r.id); }}><CheckCircle2 size={14}/>Lock</button><button onClick={(e) => { e.stopPropagation(); duplicateRecord(r); }}><Copy size={14}/>Copy</button><button onClick={(e) => { e.stopPropagation(); exportOne(r); }}><Download size={14}/>JSON</button><button onClick={(e) => { e.stopPropagation(); deleteRecord(r.id); }}><Trash2 size={14}/>Delete</button></div></div></article>)}</div><div className="card point-list"><h3>Selected Record</h3>{selected ? <><p><b>ID:</b> {selected.id}</p><p><b>Type:</b> {selected.type}</p><p><b>Status:</b> {selected.status.toUpperCase()}</p><p><b>Date:</b> {selected.createdAtDisplay}</p><p><b>GPS:</b> {selected.gps ? `${selected.gps.lat.toFixed(6)}, ${selected.gps.lng.toFixed(6)} ±${selected.gps.accuracyFt}ft` : "Missing"}</p><p><b>Notes:</b> {selected.notes || "-"}</p><pre>{JSON.stringify({ constants: selected.constants, fields: selected.fields }, null, 2)}</pre><div className="button-row"><button onClick={() => startEdit(selected)}>Edit Selected</button><button onClick={() => lockRecord(selected.id)}>Approve / Lock</button><button onClick={() => exportOne(selected)}>Export JSON</button></div></> : <p className="muted">Select a log to inspect it.</p>}</div></div></section>;
}

function AsBuilt({ points, setPoints, constants }) {
  const [kind, setKind] = useState("seam");
  const [filter, setFilter] = useState("all");
  const shown = filter === "all" ? points : points.filter((p) => p.kind === filter);
  function placePoint(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const label = `${kind.toUpperCase()} • ${constants.activeSeam || constants.activePanel || constants.activeRollNumber || now12()}`;
    setPoints([{ id: uid("AB"), kind, label, x, y, color: colorForKind(kind) }, ...points]);
  }
  return <section className="page"><h2>As-Built Map</h2><p className="muted">Tap the canvas to place seam, panel, repair, DT, or photo points. Saved logs drop points automatically.</p><div className="asbuilt-toolbar card"><label>Point Type<select value={kind} onChange={(e) => setKind(e.target.value)}><option value="seam">Seam</option><option value="panel">Panel</option><option value="repair">Repair</option><option value="dt">DT</option><option value="photo">Photo</option></select></label><label>Filter<select value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">All</option><option value="seam">Seams</option><option value="panel">Panels</option><option value="repair">Repairs</option><option value="dt">DTs</option><option value="photo">Photos</option></select></label><button onClick={() => downloadText("LinerSync_AsBuilt_points.json", JSON.stringify(points, null, 2), "application/json")}><Download size={16}/>Export Points</button></div><div className="asbuilt-layout"><div className="mapbox" onClick={placePoint}>{shown.map((p) => <div key={p.id} className="pin" style={{ left: `${p.x}%`, top: `${p.y}%`, background: p.color }} title={p.label}>{p.kind[0].toUpperCase()}</div>)}<div className="north">N</div><div className="map-hint">Tap map to place {kind.toUpperCase()}</div></div><div className="card point-list"><h3>As-Built Points</h3>{shown.length === 0 ? <p className="muted">No points yet.</p> : shown.map((p) => <div className="point-row" key={p.id}><span style={{ background: p.color }}>{p.kind[0].toUpperCase()}</span><div><strong>{p.label}</strong><p>{p.x.toFixed(1)}%, {p.y.toFixed(1)}%</p></div><button onClick={() => setPoints(points.filter((x) => x.id !== p.id))}><Trash2 size={14}/></button></div>)}</div></div></section>;
}

function Vision({ constants, gps, captureGps, points }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState("");
  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraOn(true);
      setCameraError("");
    } catch {
      setCameraError("Camera blocked or unavailable. Browser permission is required.");
    }
  }
  function stopCamera() {
    streamRef.current?.getTracks?.().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  }
  return <section className="page"><h2>AR Vision</h2><p className="muted">Camera preview with overlay markers. This is the safe field foundation before true AR anchors.</p><div className="card"><div className="button-row"><button onClick={cameraOn ? stopCamera : startCamera}><Eye size={16}/>{cameraOn ? "Stop Camera" : "Start Camera"}</button><button onClick={captureGps}><Crosshair size={16}/>Capture GPS</button></div>{cameraError && <p className="danger-text">{cameraError}</p>}</div><div className="vision-box"><video ref={videoRef} autoPlay playsInline muted /><div className="vision-overlay"><div className="vision-line"></div><div className="vision-card">Roll {constants.activeRollNumber || "-"}<br/>Panel {constants.activePanel || "-"}<br/>Seam {constants.activeSeam || "-"}</div><div className="vision-dot" style={{ left: "62%", top: "54%" }}>R</div><div className="vision-dot blue" style={{ left: "42%", top: "38%" }}>S</div></div></div><div className="card"><h3>Nearest Saved Point</h3><p>{points[0]?.label || "No as-built points yet"}</p><p className="muted">{gps ? `GPS ${gps.lat.toFixed(6)}, ${gps.lng.toFixed(6)}` : "GPS not captured this screen."}</p></div></section>;
}

function Mythos({ constants, records, points, setTab }) {
  const issues = analyzeMythos(constants, records);
  return <section className="page"><h2>Mythos QC Assistant</h2><p className="muted">Checks for missing constants, missing GPS, air test hold problems, drafts, repair/test support, and next action.</p><div className="card hero-card"><h3>Next Best Action</h3><p>{nextAction(constants, records)}</p><button onClick={() => setTab("capture")}>Do It Now</button></div><div className="issue-list">{issues.map((i, idx) => <div key={idx} className={`issue ${i.level}`}><strong>{i.title}</strong><p>{i.detail}</p><small>{i.action}</small></div>)}</div><div className="kpis"><Kpi label="Records Checked" value={records.length}/><Kpi label="Map Points" value={points.length}/><Kpi label="Issues" value={issues.filter(i => i.level !== "ok").length}/><Kpi label="Locked" value={records.filter(r => r.status === "locked").length}/></div></section>;
}

function Exports({ records, points, constants }) {
  function backup() { downloadText("LinerSync_FIELD_backup.json", JSON.stringify({ constants, records, points, exportedAt: now12() }, null, 2), "application/json"); }
  return <section className="page"><h2>Exports</h2><p className="muted">Download field data in working formats. CSV for Excel, JSON backup, KML for Google Earth.</p><div className="card export-grid"><button onClick={() => downloadText("LinerSync_FIELD_export.csv", makeCsv(records), "text/csv")}><Download size={16}/>CSV for Excel</button><button onClick={backup}><Download size={16}/>Full JSON Backup</button><button onClick={() => downloadText("LinerSync_FIELD_points.kml", makeKml(records), "application/vnd.google-earth.kml+xml")}><Map size={16}/>Google Earth KML</button><button onClick={() => downloadText("LinerSync_AsBuilt_points.json", JSON.stringify(points, null, 2), "application/json")}><Map size={16}/>As-Built Points</button></div><div className="card"><h3>Export Count</h3><p>{records.length} QC records • {points.length} as-built points</p></div></section>;
}

createRoot(document.getElementById("root")).render(<App />);
