import React, { useMemo, useState } from "react";
import AppShell from "./components/AppShell";
import Dashboard from "./components/Dashboard";
import TapCapture from "./components/TapCapture";
import VerifyEntry from "./components/VerifyEntry";
import Logs from "./components/Logs";
import AsBuiltMap from "./components/AsBuiltMap";
import Exports from "./components/Exports";
import { loadState, saveState } from "./lib/storage";
import { getHighAccuracyPosition } from "./lib/gps";
import { buildMythosAudit } from "./lib/mythos";
import { RECORD_TYPES, colorForType, nowIso, uid } from "./lib/records";
import { download, toCsv, toKml } from "./lib/exports";

export default function App() {
  const persisted = useMemo(() => loadState(), []);
  const [constants, setConstants] = useState(persisted.constants);
  const [logs, setLogs] = useState(persisted.logs);
  const [points, setPoints] = useState(persisted.points);
  const [tab, setTab] = useState("dashboard");
  const [status, setStatus] = useState("Ready");
  const [session, setSession] = useState(null);
  const [overrideReason, setOverrideReason] = useState("");
  const sync = (next) => saveState({ constants, logs: next.logs ?? logs, points: next.points ?? points });

  const startCapture = async () => {
    const capturedAt = nowIso();
    setStatus("Capturing GPS...");
    const gps = await getHighAccuracyPosition();
    setSession({ id: uid("CAP"), status: "TYPE_SELECT", capturedAt, gps, activeContext: { ...constants }, selectedType: "", fields: {}, notes: "", photo: "", mythosAudit: null });
    setTab("capture");
    setStatus("Select record type");
  };
  const setType = (type) => setSession((s) => ({ ...s, selectedType: type, status: "VERIFYING", mythosAudit: buildMythosAudit({ ...s, selectedType: type }) }));
  const setField = (key, value) => setSession((s) => { const ns = { ...s, fields: { ...s.fields, [key]: value } }; return { ...ns, mythosAudit: buildMythosAudit(ns, overrideReason) }; });
  const saveRecord = (lock) => {
    const audit = buildMythosAudit(session, overrideReason);
    if (lock && !audit.canLock) return setStatus("Cannot lock without resolving blockers or override reason");
    const rec = { id: uid("LOG"), type: session.selectedType, title: `${session.selectedType} - ${session.fields.repairId || session.fields.seam || session.fields.panel || session.fields.roll || "record"}`,
      status: lock ? "LOCKED" : "DRAFT", time: nowIso(), capturedAt: session.capturedAt, gps: session.gps, constants: session.activeContext, fields: session.fields, notes: session.notes, photo: session.photo, mythosAudit: audit,
      verifiedBy: lock ? (session.fields.verifiedBy || constants.qcTech || "") : "", verifiedAt: lock ? nowIso() : "", overrideReason: lock ? overrideReason : "" };
    const nextLogs = [rec, ...logs];
    const nextPoints = [{ id: uid("PT"), kind: rec.type, label: rec.title, x: 10 + Math.random() * 80, y: 10 + Math.random() * 80, color: colorForType(rec.type), recordId: rec.id, gps: rec.gps }, ...points];
    setLogs(nextLogs); setPoints(nextPoints); sync({ logs: nextLogs, points: nextPoints }); setSession(null); setOverrideReason(""); setTab("logs");
  };
  return <AppShell status={status}><div className="button-row"><button onClick={()=>setTab("dashboard")}>Dashboard</button><button onClick={()=>setTab("logs")}>Logs</button><button onClick={()=>setTab("asbuilt")}>As-Built</button><button onClick={()=>setTab("exports")}>Exports</button></div>
    <section className="card"><h3>Active Context</h3><label>Project<input value={constants.project} onChange={(e)=>setConstants({...constants,project:e.target.value})} /></label><label>QC Tech<input value={constants.qcTech} onChange={(e)=>setConstants({...constants,qcTech:e.target.value})} /></label><label>Roll<input value={constants.activeRoll} onChange={(e)=>setConstants({...constants,activeRoll:e.target.value})} /></label><label>Panel<input value={constants.activePanel} onChange={(e)=>setConstants({...constants,activePanel:e.target.value})} /></label><label>Seam<input value={constants.activeSeam} onChange={(e)=>setConstants({...constants,activeSeam:e.target.value})} /></label></section>
    {tab==="dashboard" && <Dashboard startCapture={startCapture} />}
    {tab==="capture" && <><TapCapture session={session} setType={setType} /><VerifyEntry session={session} setField={setField} setNotes={(v)=>setSession((s)=>({...s,notes:v}))} setPhoto={(v)=>setSession((s)=>({...s,photo:v}))} overrideReason={overrideReason} setOverrideReason={setOverrideReason} onCancel={()=>{setSession(null);setTab("dashboard");}} onSaveDraft={()=>saveRecord(false)} onLock={()=>saveRecord(true)} /></>}
    {tab==="logs" && <Logs logs={logs} onEdit={(l)=>{setSession({id:uid("CAP"),status:"VERIFYING",capturedAt:l.capturedAt,gps:l.gps,activeContext:l.constants,selectedType:l.type,fields:{...l.fields},notes:l.notes||"",photo:l.photo||"",mythosAudit:l.mythosAudit});setTab("capture");}} onCopy={(l)=>setLogs([{...l,id:uid("LOG"),status:"DRAFT"},...logs])} onDelete={(id)=>setLogs(logs.filter((l)=>l.id!==id))} onLock={(l)=>{setSession({id:uid("CAP"),status:"VERIFYING",capturedAt:l.capturedAt,gps:l.gps,activeContext:l.constants,selectedType:l.type,fields:{...l.fields},notes:l.notes||"",photo:l.photo||"",mythosAudit:l.mythosAudit});setTab("capture");}} />}
    {tab==="asbuilt" && <AsBuiltMap points={points} addPoint={(e)=>{const r=e.currentTarget.getBoundingClientRect(); setPoints([{id:uid("PT"),kind:RECORD_TYPES[0],label:"Manual",x:((e.clientX-r.left)/r.width)*100,y:((e.clientY-r.top)/r.height)*100,color:colorForType(RECORD_TYPES[0]),gps:null},...points]);}} />}
    {tab==="exports" && <Exports onCsv={()=>download("linersync.csv",toCsv(logs),"text/csv")} onKml={()=>download("linersync.kml",toKml(logs),"application/vnd.google-earth.kml+xml")} onJson={()=>download("linersync-backup.json",JSON.stringify({constants,logs,points},null,2),"application/json")} onImport={(e)=>{const f=e.target.files?.[0]; if(!f) return; const fr=new FileReader(); fr.onload=()=>{try{const p=JSON.parse(String(fr.result||"{}")); if(p.logs) setLogs([...(p.logs||[]), ...logs]); if(p.points) setPoints([...(p.points||[]), ...points]); setStatus("Import complete");}catch{setStatus("Import failed");}}; fr.readAsText(f);}} />}
  </AppShell>;
}
