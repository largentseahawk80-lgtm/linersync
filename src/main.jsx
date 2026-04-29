import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";

const STORAGE_KEY = "linersync_qc_projects_v6";
const LEGACY_KEYS = ["linersync_functional_repo_v5", "linersync_functional_repo_v4"];
const TYPES = ["Repair", "Seam", "Panel", "Roll", "Wedge Test", "Extrusion", "Air Test", "DT", "Daily"];
const FIELDS = {
  Repair: ["repairId", "repairType", "size", "eastATFt", "southATFt", "verifiedBy"],
  Seam: ["seam", "panelA", "panelB", "welder", "weldType", "station"],
  Panel: ["panel", "roll", "direction", "width", "length", "area"],
  Roll: ["roll", "lot", "manufacturer", "width", "length", "certStatus"],
  "Wedge Test": ["seam", "machine", "temperature", "speed", "peel", "shear", "result"],
  Extrusion: ["repairId", "extruder", "rodLot", "preheat", "result"],
  "Air Test": ["seam", "startPsi", "endPsi", "holdMinutes", "result"],
  DT: ["dtNumber", "seam", "station", "labNumber", "result"],
  Daily: ["crew", "weather", "production", "issues"]
};
const CONST_FIELDS = [["project","Project"],["client","Client"],["qcTech","QC Tech"],["installer","Installer"],["crew","Crew"],["activeRoll","Active Roll"],["activePanel","Active Panel"],["activeSeam","Active Seam"],["linerType","Liner Type"],["thickness","Thickness"],["width","Width"],["weather","Weather"],["wedgeMachine","Wedge Machine"],["extrusionWelder","Extrusion Welder"],["rodLot","Rod Lot"]];

class StartupErrorBoundary extends React.Component {
  constructor(props){ super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error){ return { error }; }
  componentDidCatch(error){ console.error("LinerSync startup/runtime error:", error); }
  render(){
    if(this.state.error){
      return <div className="boot-screen"><div className="boot-card"><h1 className="boot-title">LinerSync startup/runtime error</h1><p className="boot-muted">The React app failed while rendering.</p><div className="boot-error">{String(this.state.error?.message || this.state.error)}</div></div></div>;
    }
    return this.props.children;
  }
}

function safeGetItem(key){ try { return window.localStorage.getItem(key); } catch { return null; } }
function safeSetItem(key, value){ try { window.localStorage.setItem(key, value); } catch {} }


function now(){ return new Date().toLocaleString([], { hour12: true }); }
function uid(prefix="LS"){ return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`; }
function blankConstants(){ return { project:"New LinerSync Project", client:"", qcTech:"", installer:"", crew:"", activeRoll:"", activePanel:"", activeSeam:"", linerType:"HDPE", thickness:"60 mil", width:"23 ft", weather:"", wedgeMachine:"", extrusionWelder:"", rodLot:"" }; }
function makeProject(name="New LinerSync Project", constants={}, logs=[], points=[]){
  const c = { ...blankConstants(), ...constants };
  c.project = c.project || name;
  return { id: uid("JOB"), name: c.project, createdAt: now(), updatedAt: now(), constants: c, logs: Array.isArray(logs)?logs:[], points: Array.isArray(points)?points:[] };
}
function safeParse(raw){ try { return raw ? JSON.parse(raw) : null; } catch { return null; } }
function normalizeState(input){
  if (input?.version === 6 && Array.isArray(input.projects) && input.projects.length) {
    const projects = input.projects.map(p => ({...makeProject(p?.name || p?.constants?.project || "Recovered Project", p?.constants || {}, p?.logs || [], p?.points || []), ...p, constants:{...blankConstants(), ...(p?.constants || {})}, logs:Array.isArray(p?.logs)?p.logs:[], points:Array.isArray(p?.points)?p.points:[]}));
    const activeProjectId = projects.some(p=>p.id===input.activeProjectId) ? input.activeProjectId : projects[0].id;
    return { version:6, tab: input.tab || "projects", activeProjectId, projects };
  }
  if (input?.version === 5 && Array.isArray(input.projects) && input.projects.length) {
    const projects = input.projects.map(p => ({...makeProject(p?.name || p?.constants?.project || "Migrated Project", p?.constants || {}, p?.logs || [], p?.points || []), id:p?.id || uid("JOB")}));
    return { version:6, tab:"projects", activeProjectId:projects[0].id, projects };
  }
  if (input?.constants || input?.logs || input?.points) {
    const p = makeProject(input?.constants?.project || "Migrated LinerSync Project", input.constants || {}, input.logs || [], input.points || []);
    return { version:6, tab:"projects", activeProjectId:p.id, projects:[p] };
  }
  const p = makeProject();
  return { version:6, tab:"projects", activeProjectId:p.id, projects:[p] };
}
function loadState(){
  const currentRaw = safeGetItem(STORAGE_KEY);
  const current = normalizeState(safeParse(currentRaw));
  if (safeParse(currentRaw)) return current;
  for (const k of LEGACY_KEYS) {
    const old = safeParse(safeGetItem(k));
    if (old) return normalizeState(old);
  }
  return current;
}
function download(name, text, mime){ const b=new Blob([text],{type:mime}); const u=URL.createObjectURL(b); const a=document.createElement("a"); a.href=u; a.download=name; a.click(); URL.revokeObjectURL(u); }
function csvEscape(v){ return `"${String(v ?? "").replaceAll('"','""')}"`; }
function makeCsv(project){
  const headers=["projectId","project","id","type","status","time","roll","panel","seam","lat","lng","accuracyFt","fields","notes"];
  const rows=(project.logs||[]).map(r=>[project.id,project.name,r.id,r.type,r.status,r.time,r.fields?.roll||r.constants?.activeRoll,r.fields?.panel||r.constants?.activePanel,r.fields?.seam||r.constants?.activeSeam,r.gps?.lat||"",r.gps?.lng||"",r.gps?.accuracyFt||"",JSON.stringify(r.fields||{}),r.notes||""]);
  return [headers.join(","), ...rows.map(row=>row.map(csvEscape).join(","))].join("\n");
}
function makeKml(project){
  const marks=(project.logs||[]).filter(r=>r.gps).map(r=>`<Placemark><name>${r.type} ${r.fields?.repairId||r.fields?.seam||r.fields?.panel||r.id}</name><description><![CDATA[Project: ${project.name}<br/>${r.time}<br/>Roll: ${r.fields?.roll||r.constants?.activeRoll||""}<br/>Panel: ${r.fields?.panel||r.constants?.activePanel||""}<br/>Seam: ${r.fields?.seam||r.constants?.activeSeam||""}<br/>Notes: ${r.notes||""}]]></description><Point><coordinates>${r.gps.lng},${r.gps.lat},0</coordinates></Point></Placemark>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${project.name} LinerSync Points</name>${marks}</Document></kml>`;
}
function color(kind){ return kind==="Repair"?"#f59e0b":kind==="Seam"?"#38bdf8":kind==="DT"?"#ef4444":kind==="Panel"?"#22c55e":"#a78bfa"; }
function mythos(constants, logs){
  const out=[];
  if(!constants.project) out.push(["danger","Project missing","Fill project before export."]);
  if(!constants.activeRoll) out.push(["warn","Active roll missing","Set the active roll so forms keep it until changed."]);
  if(!constants.activePanel) out.push(["warn","Active panel missing","Set the active panel before production logging."]);
  if(logs.some(l=>!l.gps)) out.push(["warn","Some records missing GPS","Capture GPS before locking critical repairs/tests."]);
  if(logs.some(l=>l.type==="Air Test" && Number(l.fields?.holdMinutes||0)>0 && Number(l.fields?.holdMinutes||0)<5)) out.push(["danger","Air test hold under 5 minutes","Correct or re-test before approval."]);
  if(logs.some(l=>l.status==="DRAFT")) out.push(["warn","Draft records exist","Lock complete records before final export."]);
  if(!logs.length) out.push(["danger","No logs saved","Capture the first field record."]);
  return out.length ? out : [["ok","QC data looks clean","Keep logging."]];
}

function App(){
  const [state,setState] = useState(loadState);
  const [type,setType] = useState("Repair");
  const [form,setForm] = useState({});
  const [gps,setGps] = useState(null);
  const [status,setStatus] = useState("Full QC app ready.");
  const [search,setSearch] = useState("");
  const [editId,setEditId] = useState(null);
  const [pointKind,setPointKind] = useState("Repair");

  const safeState = normalizeState(state);
  const activeProject = safeState.projects.find(p=>p.id===safeState.activeProjectId) || safeState.projects[0] || makeProject();
  const constants = activeProject.constants || blankConstants();
  const logs = Array.isArray(activeProject.logs) ? activeProject.logs : [];
  const points = Array.isArray(activeProject.points) ? activeProject.points : [];
  const tab = safeState.tab || "projects";
  const checks = mythos(constants, logs);
  const visible = logs.filter(l=>JSON.stringify(l).toLowerCase().includes(search.toLowerCase()));
  const circuit = `Roll ${constants.activeRoll||"-"} • Panel ${constants.activePanel||"-"} • Seam ${constants.activeSeam||"-"}`;

  useEffect(()=>safeSetItem(STORAGE_KEY, JSON.stringify(safeState)), [safeState]);
  useEffect(()=>{
    if(editId) return;
    const next={};
    for(const k of FIELDS[type] || []){
      if(k==="roll") next[k]=constants.activeRoll;
      if(k==="panel" || k==="panelA") next[k]=constants.activePanel;
      if(k==="seam") next[k]=constants.activeSeam;
      if(k==="width") next[k]=constants.width;
      if(k==="weather") next[k]=constants.weather;
      if(k==="crew") next[k]=constants.crew || constants.installer;
      if(k==="machine") next[k]=constants.wedgeMachine;
      if(k==="extruder") next[k]=constants.extrusionWelder;
      if(k==="rodLot") next[k]=constants.rodLot;
      if(k==="holdMinutes") next[k]="5";
    }
    setForm(next);
  }, [type, constants.activeRoll, constants.activePanel, constants.activeSeam, constants.weather, constants.crew, constants.installer, constants.wedgeMachine, constants.extrusionWelder, constants.rodLot, constants.width, editId]);

  function setTab(tabName){ setState(prev=>({...normalizeState(prev), tab:tabName})); }
  function updateProject(mutator){ setState(prev=>{ const s=normalizeState(prev); return {...s, projects:s.projects.map(p=>p.id===s.activeProjectId ? {...mutator(p), updatedAt:now()} : p)}; }); }
  function patchConst(k,v){ updateProject(p=>{ const c={...p.constants,[k]:v}; return {...p, name:k==="project"&&v?v:p.name, constants:c}; }); }
  function createProject(){ const p=makeProject(`QC Project ${safeState.projects.length+1}`); setState(prev=>{const s=normalizeState(prev); return {...s, activeProjectId:p.id, tab:"capture", projects:[p,...s.projects]};}); setEditId(null); setGps(null); setStatus("New clean project opened."); }
  function duplicateProject(){ const p=makeProject(`${activeProject.name} COPY`, activeProject.constants, [], []); setState(prev=>{const s=normalizeState(prev); return {...s, activeProjectId:p.id, tab:"capture", projects:[p,...s.projects]};}); setStatus("Constants copied to clean project. Logs were not copied."); }
  function openProject(id){ setState(prev=>({...normalizeState(prev), activeProjectId:id, tab:"dashboard"})); setEditId(null); setGps(null); }
  function deleteProject(id){ if(safeState.projects.length===1) return setStatus("Cannot delete the only project."); const next=safeState.projects.filter(p=>p.id!==id); setState({...safeState, projects:next, activeProjectId:next[0].id, tab:"projects"}); }
  function captureGps(){ if(!navigator.geolocation) return setStatus("GPS not available."); setStatus("Requesting GPS..."); navigator.geolocation.getCurrentPosition(p=>{ const pt={lat:p.coords.latitude,lng:p.coords.longitude,accuracyFt:Math.round((p.coords.accuracy||0)*3.28084),time:now()}; setGps(pt); setStatus(`GPS captured ±${pt.accuracyFt} ft.`); },()=>setStatus("GPS blocked. Allow location permission."),{enableHighAccuracy:true,timeout:10000,maximumAge:0}); }
  function saveLog(locked=false){
    const id=editId || uid();
    const rec={id,type,title:`${type} - ${form.repairId||form.seam||form.panel||form.roll||form.dtNumber||constants.activeSeam||constants.activePanel||id}`,status:locked?"LOCKED":"DRAFT",time:now(),createdAtMs:Date.now(),gps,constants:{...constants},fields:{...form},notes:form.notes||""};
    updateProject(p=>({ ...p, logs: editId ? p.logs.map(x=>x.id===editId?rec:x) : [rec,...p.logs], points: editId ? p.points : [{id:uid("P"),kind:type,label:rec.title,x:12+Math.random()*74,y:14+Math.random()*68,color:color(type),recordId:id},...p.points] }));
    setEditId(null); setForm({}); setGps(null); setTab("logs"); setStatus(`${rec.title} saved.`);
  }
  function editLog(r){ setEditId(r.id); setType(r.type); setForm({...r.fields}); setGps(r.gps||null); setTab("capture"); }
  function copyLog(r){ updateProject(p=>({...p, logs:[{...r,id:uid(),status:"DRAFT",title:`${r.title} COPY`,time:now()},...p.logs]})); }
  function lockLog(id){ updateProject(p=>({...p, logs:p.logs.map(r=>r.id===id?{...r,status:"LOCKED",time:`${r.time} • LOCKED ${now()}`}:r)})); }
  function deleteLog(id){ updateProject(p=>({...p, logs:p.logs.filter(r=>r.id!==id), points:p.points.filter(pt=>pt.recordId!==id)})); }
  function placePoint(e){ const rect=e.currentTarget.getBoundingClientRect(); const x=((e.clientX-rect.left)/rect.width)*100; const y=((e.clientY-rect.top)/rect.height)*100; updateProject(p=>({...p, points:[{id:uid("P"),kind:pointKind,label:`${pointKind} • ${constants.activeSeam||constants.activePanel||constants.activeRoll||now()}`,x,y,color:color(pointKind)},...p.points]})); }

  return <div className="app-shell"><aside className="sidebar"><div className="brand"><div className="brand-mark">LS</div><div><h1>LINERSYNC</h1><p>PROJECT SAFE QC</p></div></div><nav>{["projects","dashboard","capture","logs","asbuilt","mythos","exports"].map(t=><button key={t} className={tab===t?"active":""} onClick={()=>setTab(t)}>{t.toUpperCase()}</button>)}</nav><div className="side-card"><div className="tiny">ACTIVE PROJECT</div><strong>{activeProject.name}</strong></div><div className="side-card"><div className="tiny">ACTIVE CIRCUIT</div><strong>{circuit}</strong></div><div className="side-card"><div className="tiny">SAVED LOGS</div><strong>{logs.length}</strong></div></aside><main className="main"><header className="topbar"><div><div className="tiny">Current Build</div><strong>Projects → Capture → Logs → As-Built → Mythos → Exports</strong></div><div className="gps-pill">{gps?`${gps.lat.toFixed(6)}, ${gps.lng.toFixed(6)}`:"GPS ready"}</div></header>
    {tab==="projects"&&<section className="page"><h2>Projects</h2><p className="muted">Open a job before logging. Each project keeps separate constants, logs, points, and exports.</p><div className="button-row"><button className="green" onClick={createProject}>New Clean Project</button><button onClick={duplicateProject}>Copy Current Constants Only</button></div><div className="log-list">{safeState.projects.map(p=><article className="log" key={p.id}><strong>{p.name}</strong><p>{p.logs.length} logs • {p.points.length} map points • Updated {p.updatedAt}</p><p>Roll {p.constants.activeRoll||"-"} • Panel {p.constants.activePanel||"-"} • Seam {p.constants.activeSeam||"-"}</p><div className="button-row"><button onClick={()=>openProject(p.id)}>Open</button><button onClick={()=>deleteProject(p.id)}>Delete</button></div></article>)}</div></section>}
    {tab==="dashboard"&&<section className="page"><h2>Field Dashboard</h2><p className="muted">Active project: <strong>{activeProject.name}</strong>. Fill constants once, capture records, lock logs, place as-built points, run Mythos checks, export CSV/KML/JSON.</p><div className="kpis"><div className="kpi"><strong>{logs.length}</strong><span>Total Logs</span></div><div className="kpi"><strong>{logs.filter(l=>l.status==="LOCKED").length}</strong><span>Locked</span></div><div className="kpi"><strong>{points.length}</strong><span>Map Points</span></div><div className="kpi"><strong>{checks.filter(i=>i[0]!=="ok").length}</strong><span>Issues</span></div></div><div className="card"><h3>Latest Logs</h3>{logs.slice(0,5).length?logs.slice(0,5).map(r=><p key={r.id}><strong>{r.title}</strong><br/><span className="muted">{r.status} • {r.time}</span></p>):<p className="muted">No logs saved yet.</p>}</div></section>}
    {tab==="capture"&&<section className="page"><h2>{editId?"Edit Field Log":"Tap Capture"}</h2><p className="muted">Constants and logs are isolated to <strong>{activeProject.name}</strong>.</p><div className="card"><h3>Constant Job Data</h3><div className="form-grid">{CONST_FIELDS.map(([k,l])=><label key={k}>{l}<input value={constants[k]||""} onChange={e=>patchConst(k,e.target.value)}/></label>)}</div></div><div className="card"><h3>New Field Log</h3><label>Type<select value={type} onChange={e=>setType(e.target.value)}>{TYPES.map(t=><option key={t}>{t}</option>)}</select></label><div className="module-strip">{TYPES.map(t=><button key={t} className={type===t?"selected":""} onClick={()=>setType(t)}>{t}</button>)}</div><div className="form-grid">{(FIELDS[type]||[]).map(k=><label key={k}>{k}<input value={form[k]||""} onChange={e=>setForm(o=>({...o,[k]:e.target.value}))}/></label>)}</div><label>Notes<textarea value={form.notes||""} onChange={e=>setForm(o=>({...o,notes:e.target.value}))}/></label><div className="button-row"><button onClick={captureGps}>Capture GPS</button><button onClick={()=>saveLog(false)}>Save Draft</button><button className="green" onClick={()=>saveLog(true)}>Approve / Lock</button></div>{gps&&<p className="muted">GPS {gps.lat.toFixed(6)}, {gps.lng.toFixed(6)} ±{gps.accuracyFt}ft</p>}</div></section>}
    {tab==="logs"&&<section className="page"><h2>Last Logs</h2><div className="card"><label>Search<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search roll, panel, seam, repair..."/></label><p className="muted">Showing {visible.length} of {logs.length} logs for {activeProject.name}.</p></div><div className="log-list">{visible.length?visible.map(r=><article className="log" key={r.id}><strong>{r.title}</strong><p>{r.type} • {r.status} • {r.time}</p><p>Roll {r.fields?.roll||r.constants?.activeRoll||"-"} • Panel {r.fields?.panel||r.constants?.activePanel||"-"} • Seam {r.fields?.seam||r.constants?.activeSeam||"-"}</p><p>{r.gps?`GPS ${r.gps.lat.toFixed(6)}, ${r.gps.lng.toFixed(6)} ±${r.gps.accuracyFt}ft`:"No GPS"}</p><pre>{JSON.stringify(r.fields||{},null,2)}</pre><div className="button-row"><button onClick={()=>editLog(r)}>Edit</button><button onClick={()=>lockLog(r.id)}>Lock</button><button onClick={()=>copyLog(r)}>Copy</button><button onClick={()=>deleteLog(r.id)}>Delete</button></div></article>):<div className="card"><strong>No logs for this project yet.</strong><p className="muted">Go to Tap Capture and save the first record.</p></div>}</div></section>}
    {tab==="asbuilt"&&<section className="page"><h2>As-Built Map</h2><div className="card"><label>Point Type<select value={pointKind} onChange={e=>setPointKind(e.target.value)}>{TYPES.map(t=><option key={t}>{t}</option>)}</select></label><p className="muted">{points.length} points stored for {activeProject.name}.</p></div><div className="mapbox" onClick={placePoint}>{points.map(p=><div className="pin" key={p.id} style={{left:`${p.x}%`,top:`${p.y}%`,background:p.color}}>{p.kind?.[0]||"P"}</div>)}<div className="map-hint">Tap map to place point</div></div></section>}
    {tab==="mythos"&&<section className="page"><h2>Mythos Checks</h2><div className="issue-list">{checks.map((i,n)=><div className={`issue ${i[0]}`} key={n}><strong>{i[1]}</strong><p>{i[2]}</p></div>)}</div></section>}
    {tab==="exports"&&<section className="page"><h2>Exports</h2><p className="muted">Exports pull only from active project: <strong>{activeProject.name}</strong>.</p><div className="export-grid"><div className="card"><h3>CSV</h3><button onClick={()=>download(`${activeProject.name.replaceAll(" ","_")}_logs.csv`,makeCsv(activeProject),"text/csv")}>Download CSV</button></div><div className="card"><h3>KML</h3><button onClick={()=>download(`${activeProject.name.replaceAll(" ","_")}_points.kml`,makeKml(activeProject),"application/vnd.google-earth.kml+xml")}>Download KML</button></div><div className="card"><h3>JSON Backup</h3><button onClick={()=>download(`${activeProject.name.replaceAll(" ","_")}_backup.json`,JSON.stringify(activeProject,null,2),"application/json")}>Download Project Backup</button></div><div className="card"><h3>All Projects Backup</h3><button onClick={()=>download("linersync_all_projects_backup.json",JSON.stringify(safeState,null,2),"application/json")}>Download All Projects</button></div></div></section>}
  </main><div className="status-bar">{status}</div></div>;
}

try { ReactDOM.createRoot(document.getElementById("root")).render(<StartupErrorBoundary><App /></StartupErrorBoundary>); }
catch (err) {
  const root=document.getElementById("root");
  if(root) root.innerHTML=`<div class="boot-screen"><div class="boot-card"><h1 class="boot-title">LinerSync boot error</h1><p class="boot-muted">React failed to start.</p><div class="boot-error">${String(err?.message||err)}</div></div></div>`;
}
