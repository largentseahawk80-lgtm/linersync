import React, { useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";

const STORAGE_KEY = "linersync_functional_repo_v5";
const LEGACY_STORAGE_KEY = "linersync_functional_repo_v4";
const TYPES = ["Repair", "Seam", "Panel", "Roll", "Wedge Test", "Extrusion", "Air Test", "DT", "Daily"];
const FIELD_BY_TYPE = {
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

function now12(){return new Date().toLocaleString([], {hour12:true});}
function uid(prefix="LS"){return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;}
function blankConstants(){return {project:"", client:"", qcTech:"", installer:"", crew:"", activeRoll:"", activePanel:"", activeSeam:"", linerType:"HDPE", thickness:"60 mil", width:"23 ft", weather:"", wedgeMachine:"", extrusionWelder:"", rodLot:""};}
function makeProject(name="New QC Project", constants=blankConstants(), logs=[], points=[]){
  const projectConstants = {...blankConstants(), ...constants, project: constants.project || name};
  return {id:uid("JOB"), name:projectConstants.project || name, createdAt:now12(), updatedAt:now12(), constants:projectConstants, logs, points};
}
function safeParse(raw){try{return JSON.parse(raw) || null;}catch{return null;}}
function loadState(){
  const v5=safeParse(localStorage.getItem(STORAGE_KEY));
  if(v5?.version===5 && Array.isArray(v5.projects) && v5.projects.length) return v5;
  const legacy=safeParse(localStorage.getItem(LEGACY_STORAGE_KEY));
  if(legacy) {
    const migrated=makeProject(legacy.constants?.project || "Migrated LinerSync Project", legacy.constants || blankConstants(), legacy.logs || [], legacy.points || []);
    return {version:5, activeProjectId:migrated.id, tab:"projects", projects:[migrated]};
  }
  const first=makeProject("New LinerSync QC Project");
  return {version:5, activeProjectId:first.id, tab:"projects", projects:[first]};
}
function saveDownload(name,text,mime){const b=new Blob([text],{type:mime}); const u=URL.createObjectURL(b); const a=document.createElement("a"); a.href=u; a.download=name; a.click(); URL.revokeObjectURL(u);}
function esc(v){return `"${String(v??"").replaceAll('"','""')}"`;}
function makeCsv(project,logs){const headers=["projectId","project","id","type","status","time","roll","panel","seam","lat","lng","accuracyFt","fields","notes"]; const rows=logs.map(r=>[project.id,project.name,r.id,r.type,r.status,r.time,r.fields.roll||r.constants.activeRoll,r.fields.panel||r.constants.activePanel,r.fields.seam||r.constants.activeSeam,r.gps?.lat||"",r.gps?.lng||"",r.gps?.accuracyFt||"",JSON.stringify(r.fields),r.notes||""]); return [headers.join(","),...rows.map(row=>row.map(esc).join(","))].join("\n");}
function makeKml(project,logs){const marks=logs.filter(r=>r.gps).map(r=>`<Placemark><name>${r.type} ${r.fields.repairId||r.fields.seam||r.fields.panel||r.id}</name><description><![CDATA[Project: ${project.name}<br/>${r.time}<br/>Roll: ${r.fields.roll||r.constants.activeRoll||""}<br/>Panel: ${r.fields.panel||r.constants.activePanel||""}<br/>Seam: ${r.fields.seam||r.constants.activeSeam||""}<br/>Notes: ${r.notes||""}]]></description><Point><coordinates>${r.gps.lng},${r.gps.lat},0</coordinates></Point></Placemark>`).join("\n"); return `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${project.name} LinerSync Points</name>${marks}</Document></kml>`;}
function issues(constants,logs){const out=[]; if(!constants.project) out.push(["warn","Project missing","Fill project before export."]); if(!constants.activeRoll) out.push(["warn","Active roll missing","Set roll once; forms keep it until changed."]); if(!constants.activePanel) out.push(["warn","Active panel missing","Set panel/area before logging."]); if(logs.some(l=>!l.gps)) out.push(["warn","Some logs missing GPS","Capture GPS before locking important records."]); if(logs.some(l=>l.type==="Air Test" && Number(l.fields.holdMinutes||0)>0 && Number(l.fields.holdMinutes||0)<5)) out.push(["danger","Air test hold under 5 minutes","Correct/re-test before approval."]); if(logs.some(l=>l.status==="DRAFT")) out.push(["warn","Draft records exist","Lock good records in Logs."]); if(!logs.length) out.push(["danger","No logs saved","Capture first record."]); return out.length?out:[["ok","QC data looks clean","Keep logging."]];}
function color(kind){return kind==="Repair"?"#f59e0b":kind==="Seam"?"#38bdf8":kind==="DT"?"#ef4444":kind==="Panel"?"#22c55e":"#a78bfa";}

function App(){
  const [state,setState]=useState(loadState);
  const [type,setType]=useState("Repair");
  const [form,setForm]=useState({});
  const [gps,setGps]=useState(null);
  const [status,setStatus]=useState("Project-safe build ready.");
  const [search,setSearch]=useState("");
  const [editId,setEditId]=useState(null);
  const [pointKind,setPointKind]=useState("Repair");

  const activeProject=useMemo(()=>state.projects.find(p=>p.id===state.activeProjectId) || state.projects[0],[state.projects,state.activeProjectId]);
  const constants=activeProject?.constants || blankConstants();
  const logs=activeProject?.logs || [];
  const points=activeProject?.points || [];
  const tab=state.tab || "projects";

  useEffect(()=>localStorage.setItem(STORAGE_KEY,JSON.stringify(state)),[state]);
  useEffect(()=>{ 
    if(editId) return; 
    const next={}; 
    for(const k of FIELD_BY_TYPE[type]){ 
      if(k==="roll") next[k]=constants.activeRoll; 
      if(k==="panel"||k==="panelA") next[k]=constants.activePanel; 
      if(k==="seam") next[k]=constants.activeSeam; 
      if(k==="width") next[k]=constants.width; 
      if(k==="weather") next[k]=constants.weather; 
      if(k==="crew") next[k]=constants.crew||constants.installer; 
      if(k==="machine") next[k]=constants.wedgeMachine; 
      if(k==="extruder") next[k]=constants.extrusionWelder; 
      if(k==="rodLot") next[k]=constants.rodLot; 
      if(k==="holdMinutes") next[k]="5";
    } 
    setForm(next);
  },[type,constants,editId]);

  const visible=logs.filter(l=>JSON.stringify(l).toLowerCase().includes(search.toLowerCase()));
  const latestLogs=logs.slice(0,5);
  const circuit=`Roll ${constants.activeRoll||"-"} • Panel ${constants.activePanel||"-"} • Seam ${constants.activeSeam||"-"}`;
  const issueList=issues(constants,logs);

  function setTab(tabName){setState(prev=>({...prev, tab:tabName}));}
  function updateActiveProject(mutator){
    setState(prev=>({...prev, projects:prev.projects.map(p=>p.id===prev.activeProjectId ? {...mutator(p), updatedAt:now12()} : p)}));
  }
  function patchConst(k,v){
    updateActiveProject(p=>{
      const nextConstants={...p.constants,[k]:v};
      return {...p, name:k==="project" && v ? v : p.name, constants:nextConstants};
    });
  }
  function patchForm(k,v){setForm(o=>({...o,[k]:v}));}
  function createProject(){
    const p=makeProject(`QC Project ${state.projects.length+1}`);
    setState(prev=>({...prev, activeProjectId:p.id, tab:"capture", projects:[p,...prev.projects]}));
    setForm({});
    setGps(null);
    setEditId(null);
    setStatus("New clean project opened. Logs and map points are separated.");
  }
  function duplicateProject(){
    const copy=makeProject(`${activeProject.name} COPY`, activeProject.constants, [], []);
    setState(prev=>({...prev, activeProjectId:copy.id, tab:"capture", projects:[copy,...prev.projects]}));
    setStatus("Project constants copied into a clean new project. Logs were not copied.");
  }
  function openProject(id){
    setState(prev=>({...prev, activeProjectId:id, tab:"dashboard"}));
    setForm({});
    setGps(null);
    setEditId(null);
    const p=state.projects.find(x=>x.id===id);
    setStatus(`Opened ${p?.name || "project"}.`);
  }
  function deleteProject(id){
    if(state.projects.length===1) return setStatus("Cannot delete the only project.");
    const next=state.projects.filter(p=>p.id!==id);
    setState(prev=>({...prev, projects:next, activeProjectId:prev.activeProjectId===id?next[0].id:prev.activeProjectId, tab:"projects"}));
    setStatus("Project removed from this device.");
  }
  function captureGps(){ 
    if(!navigator.geolocation) return setStatus("GPS not available."); 
    setStatus("Requesting GPS..."); 
    navigator.geolocation.getCurrentPosition(p=>{
      const pt={lat:p.coords.latitude,lng:p.coords.longitude,accuracyFt:Math.round((p.coords.accuracy||0)*3.28084),time:now12()};
      setGps(pt); 
      setStatus(`GPS captured ±${pt.accuracyFt} ft.`);
    },()=>setStatus("GPS blocked. Allow location permission."),{enableHighAccuracy:true,timeout:10000,maximumAge:0});
  }
  function saveLog(locked=false){
    const id=editId||uid(); 
    const rec={id,type,title:`${type} - ${form.repairId||form.seam||form.panel||form.roll||form.dtNumber||constants.activeSeam||constants.activePanel||id}`,status:locked?"LOCKED":"DRAFT",time:now12(),createdAtMs:Date.now(),gps,constants:{...constants},fields:{...form},notes:form.notes||""}; 
    updateActiveProject(p=>{
      const nextLogs=editId?p.logs.map(x=>x.id===editId?rec:x):[rec,...p.logs];
      const nextPoints=!editId?[{id:uid("P"),kind:type,label:rec.title,x:12+Math.random()*74,y:14+Math.random()*68,color:color(type),recordId:id},...p.points]:p.points;
      return {...p, logs:nextLogs, points:nextPoints};
    });
    setEditId(null); 
    setForm({}); 
    setGps(null); 
    setTab("logs"); 
    setStatus(`${rec.title} saved to ${activeProject.name}.`);
  }
  function editLog(r){setEditId(r.id); setType(r.type); setForm({...r.fields}); setGps(r.gps||null); setTab("capture"); setStatus(`Editing ${r.title}`);}
  function copyLog(r){updateActiveProject(p=>({...p, logs:[{...r,id:uid(),status:"DRAFT",title:`${r.title} COPY`,time:now12(),createdAtMs:Date.now()},...p.logs]}));}
  function lockLog(id){updateActiveProject(p=>({...p, logs:p.logs.map(r=>r.id===id?{...r,status:"LOCKED",time:`${r.time} • LOCKED ${now12()}`}:r)}));}
  function deleteLog(id){updateActiveProject(p=>({...p, logs:p.logs.filter(r=>r.id!==id), points:p.points.filter(pt=>pt.recordId!==id)}));}
  function placePoint(e){const rect=e.currentTarget.getBoundingClientRect(); const x=((e.clientX-rect.left)/rect.width)*100; const y=((e.clientY-rect.top)/rect.height)*100; updateActiveProject(p=>({...p, points:[{id:uid("P"),kind:pointKind,label:`${pointKind} • ${constants.activeSeam||constants.activePanel||constants.activeRoll||now12()}`,x,y,color:color(pointKind)},...p.points]}));}

  return <div className="app-shell"><aside className="sidebar"><div className="brand"><div className="brand-mark">LS</div><div><h1>LINERSYNC</h1><p>PROJECT SAFE QC</p></div></div><nav>{["projects","dashboard","capture","logs","asbuilt","mythos","exports"].map(t=><button key={t} className={tab===t?"active":""} onClick={()=>setTab(t)}>{t.toUpperCase()}</button>)}</nav><div className="side-card"><div className="tiny">ACTIVE PROJECT</div><strong>{activeProject.name}</strong></div><div className="side-card"><div className="tiny">ACTIVE CIRCUIT</div><strong>{circuit}</strong></div><div className="side-card"><div className="tiny">SAVED LOGS</div><strong>{logs.length}</strong></div></aside><main className="main"><header className="topbar"><div><div className="tiny">Current Build</div><strong>Projects → Capture → Logs → As-Built → Mythos → Exports</strong></div><div className="gps-pill">{gps?`${gps.lat.toFixed(6)}, ${gps.lng.toFixed(6)}`:"GPS ready"}</div></header>
  {tab==="projects"&&<section className="page"><h2>Projects</h2><p className="muted">Open a job before logging. Each project now keeps separate constants, logs, as-built points, and exports on this device.</p><div className="button-row"><button className="green" onClick={createProject}>New Clean Project</button><button onClick={duplicateProject}>Copy Current Constants Only</button></div><div className="log-list">{state.projects.map(p=><article className="log" key={p.id}><div><strong>{p.name}</strong><p>{p.logs.length} logs • {p.points.length} map points • Updated {p.updatedAt}</p><p className="muted">Roll {p.constants.activeRoll||"-"} • Panel {p.constants.activePanel||"-"} • Seam {p.constants.activeSeam||"-"}</p></div><div className="button-row"><button onClick={()=>openProject(p.id)}>Open</button><button onClick={()=>deleteProject(p.id)}>Delete</button></div></article>)}</div></section>}
  {tab==="dashboard"&&<section className="page"><h2>Field Dashboard</h2><p className="muted">Active project: <strong>{activeProject.name}</strong>. Fill constants once, capture records, save/edit/lock logs, place as-built points, run checks, export CSV/KML/JSON.</p><div className="kpis"><div className="kpi"><strong>{logs.length}</strong><span>Total Logs</span></div><div className="kpi"><strong>{logs.filter(l=>l.status==="LOCKED").length}</strong><span>Locked</span></div><div className="kpi"><strong>{points.length}</strong><span>Map Points</span></div><div className="kpi"><strong>{issueList.filter(i=>i[0]!=="ok").length}</strong><span>Issues</span></div></div><div className="card"><h3>Latest Logs</h3>{latestLogs.length?latestLogs.map(r=><p key={r.id}><strong>{r.title}</strong><br/><span className="muted">{r.status} • {r.time}</span></p>):<p className="muted">No logs saved for this project yet.</p>}<div className="button-row"><button onClick={()=>setTab("capture")}>Open Capture</button><button onClick={()=>setTab("logs")}>Open Logs</button><button onClick={()=>setTab("exports")}>Open Exports</button></div></div></section>}
  {tab==="capture"&&<section className="page"><h2>{editId?"Edit Field Log":"Tap Capture"}</h2><p className="muted">Project-safe mode is active. Constants and logs are isolated to <strong>{activeProject.name}</strong>.</p><div className="card"><h3>Constant Job Data</h3><div className="form-grid">{[["project","Project"],["client","Client"],["qcTech","QC Tech"],["installer","Installer"],["crew","Crew"],["activeRoll","Active Roll"],["activePanel","Active Panel"],["activeSeam","Active Seam"],["linerType","Liner Type"],["thickness","Thickness"],["width","Width"],["weather","Weather"],["wedgeMachine","Wedge Machine"],["extrusionWelder","Extrusion Welder"],["rodLot","Rod Lot"]].map(([k,l])=><label key={k}>{l}<input value={constants[k]||""} onChange={e=>patchConst(k,e.target.value)}/></label>)}</div></div><div className="card"><h3>New Field Log</h3><label>Type<select value={type} onChange={e=>setType(e.target.value)}>{TYPES.map(t=><option key={t}>{t}</option>)}</select></label><div className="module-strip">{TYPES.map(t=><button key={t} className={type===t?"selected":""} onClick={()=>setType(t)}>{t}</button>)}</div><div className="form-grid">{FIELD_BY_TYPE[type].map(k=><label key={k}>{k}<input value={form[k]||""} onChange={e=>patchForm(k,e.target.value)}/></label>)}</div><label>Notes<textarea value={form.notes||""} onChange={e=>patchForm("notes",e.target.value)}/></label><div className="button-row"><button onClick={captureGps}>Capture GPS</button><button onClick={()=>saveLog(false)}>Save Draft</button><button className="green" onClick={()=>saveLog(true)}>Approve / Lock</button></div>{gps&&<p className="muted">GPS {gps.lat.toFixed(6)}, {gps.lng.toFixed(6)} ±{gps.accuracyFt}ft</p>}</div></section>}
  {tab==="logs"&&<section className="page"><h2>Last Logs</h2><div className="card"><label>Search<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search roll, panel, seam, repair..."/></label><p className="muted">Showing {visible.length} of {logs.length} logs for {activeProject.name}.</p></div><div className="log-list">{visible.length?visible.map(r=><article className="log" key={r.id}><strong>{r.title}</strong><p>{r.type} • {r.status} • {r.time}</p><p>Roll {r.fields.roll||r.constants.activeRoll||"-"} • Panel {r.fields.panel||r.constants.activePanel||"-"} • Seam {r.fields.seam||r.constants.activeSeam||"-"}</p><p>{r.gps?`GPS ${r.gps.lat.toFixed(6)}, ${r.gps.lng.toFixed(6)} ±${r.gps.accuracyFt}ft`:"No GPS"}</p><pre>{JSON.stringify(r.fields,null,2)}</pre><div className="button-row"><button onClick={()=>editLog(r)}>Edit</button><button onClick={()=>lockLog(r.id)}>Lock</button><button onClick={()=>copyLog(r)}>Copy</button><button onClick={()=>deleteLog(r.id)}>Delete</button></div></article>):<div className="card"><strong>No logs for this project yet.</strong><p className="muted">Go to Tap Capture and save the first record.</p></div>}</div></section>}
  {tab==="asbuilt"&&<section className="page"><h2>As-Built Map</h2><div className="card"><label>Point Type<select value={pointKind} onChange={e=>setPointKind(e.target.value)}>{TYPES.map(t=><option key={t}>{t}</option>)}</select></label><p className="muted">{points.length} points stored for {activeProject.name}.</p></div><div className="mapbox" onClick={placePoint}>{points.map(p=><div className="pin" key={p.id} style={{left:`${p.x}%`,top:`${p.y}%`,background:p.color}}>{p.kind[0]}</div>)}<div className="map-hint">Tap map to place point</div></div></section>}
  {tab==="mythos"&&<section className="page"><h2>Mythos Checks</h2><div className="issue-list">{issueList.map((i,n)=><div className={`issue ${i[0]}`} key={n}><strong>{i[1]}</strong><p>{i[2]}</p></div>)}</div></section>}
  {tab==="exports"&&<section className="page"><h2>Exports</h2><p className="muted">Exports now pull only from active project: <strong>{activeProject.name}</strong>.</p><div className="export-grid"><div className="card"><h3>CSV</h3><button onClick={()=>saveDownload(`${activeProject.name.replaceAll(" ","_")}_logs.csv`,makeCsv(activeProject,logs),"text/csv")}>Download CSV</button></div><div className="card"><h3>KML</h3><button onClick={()=>saveDownload(`${activeProject.name.replaceAll(" ","_")}_points.kml`,makeKml(activeProject,logs),"application/vnd.google-earth.kml+xml")}>Download KML</button></div><div className="card"><h3>JSON Backup</h3><button onClick={()=>saveDownload(`${activeProject.name.replaceAll(" ","_")}_backup.json`,JSON.stringify(activeProject,null,2),"application/json")}>Download Project Backup</button></div><div className="card"><h3>All Projects Backup</h3><button onClick={()=>saveDownload("linersync_all_projects_backup.json",JSON.stringify(state,null,2),"application/json")}>Download All Projects</button></div></div></section>}
  </main><div className="status-bar">{status}</div></div>;
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
