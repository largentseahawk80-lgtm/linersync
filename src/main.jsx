import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const STORAGE_KEY = "linersync_functional_repo_v4";
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
function safeObj(value, fallback = {}){return value && typeof value === "object" && !Array.isArray(value) ? value : fallback;}
function safeArray(value){return Array.isArray(value) ? value : [];}
const TABS = ["dashboard","capture","logs","asbuilt","mythos","exports"];
function toFiniteNumber(value, fallback = null){const n=Number(value); return Number.isFinite(n)?n:fallback;}
function cleanGps(gps){const source=safeObj(gps,null); if(!source) return null; const lat=toFiniteNumber(source.lat,null); const lng=toFiniteNumber(source.lng,null); if(lat===null||lng===null) return null; return {lat,lng,accuracyFt:toFiniteNumber(source.accuracyFt,0)??0,time:typeof source.time==="string"?source.time:""};}
function cleanLog(raw, index, constants){const rec=safeObj(raw,null); if(!rec) return null; const fields=safeObj(rec.fields,{}); const localConstants={...constants,...safeObj(rec.constants,{})}; const type=TYPES.includes(rec.type)?rec.type:"Repair"; const id=typeof rec.id==="string"&&rec.id?rec.id:uid(`LOG${index}`); return {id,type,title:typeof rec.title==="string"&&rec.title?rec.title:`${type} - ${fields.repairId||fields.seam||fields.panel||fields.roll||fields.dtNumber||id}`,status:rec.status==="LOCKED"?"LOCKED":"DRAFT",time:typeof rec.time==="string"&&rec.time?rec.time:now12(),gps:cleanGps(rec.gps),constants:localConstants,fields,notes:typeof rec.notes==="string"?rec.notes:""};}
function cleanPoint(raw, index){const rec=safeObj(raw,null); if(!rec) return null; const kind=TYPES.includes(rec.kind)?rec.kind:"Repair"; const x=toFiniteNumber(rec.x,null); const y=toFiniteNumber(rec.y,null); if(x===null||y===null) return null; return {id:typeof rec.id==="string"&&rec.id?rec.id:uid(`P${index}`),kind,label:typeof rec.label==="string"&&rec.label?rec.label:`${kind} • ${now12()}`,x:Math.min(100,Math.max(0,x)),y:Math.min(100,Math.max(0,y)),color:typeof rec.color==="string"&&rec.color?rec.color:color(kind),recordId:typeof rec.recordId==="string"?rec.recordId:undefined};}
function loadState(){try{const raw=localStorage.getItem(STORAGE_KEY); if(!raw) return null; const parsed=JSON.parse(raw); if(!parsed||typeof parsed!=="object") return null; const constants={...blankConstants(),...safeObj(parsed.constants)}; const logs=safeArray(parsed.logs).map((log,i)=>cleanLog(log,i,constants)).filter(Boolean); const points=safeArray(parsed.points).map((point,i)=>cleanPoint(point,i)).filter(Boolean); const tab=typeof parsed.tab==="string"&&TABS.includes(parsed.tab)?parsed.tab:"dashboard"; return {constants,logs,points,tab};}catch{return null;}}
function saveDownload(name,text,mime){const b=new Blob([text],{type:mime}); const u=URL.createObjectURL(b); const a=document.createElement("a"); a.href=u; a.download=name; a.click(); URL.revokeObjectURL(u);}
function esc(v){return `"${String(v??"").replaceAll('"','""')}"`;}
function makeCsv(logs){const headers=["id","type","status","time","project","roll","panel","seam","lat","lng","accuracyFt","fields","notes"]; const rows=logs.map(r=>[r.id,r.type,r.status,r.time,r.constants.project,r.fields.roll||r.constants.activeRoll,r.fields.panel||r.constants.activePanel,r.fields.seam||r.constants.activeSeam,r.gps?.lat||"",r.gps?.lng||"",r.gps?.accuracyFt||"",JSON.stringify(r.fields),r.notes||""]); return [headers.join(","),...rows.map(row=>row.map(esc).join(","))].join("\n");}
function makeKml(logs){const marks=logs.filter(r=>r.gps).map(r=>`<Placemark><name>${r.type} ${r.fields.repairId||r.fields.seam||r.fields.panel||r.id}</name><description><![CDATA[${r.time}<br/>Roll: ${r.fields.roll||r.constants.activeRoll||""}<br/>Panel: ${r.fields.panel||r.constants.activePanel||""}<br/>Seam: ${r.fields.seam||r.constants.activeSeam||""}<br/>Notes: ${r.notes||""}]]></description><Point><coordinates>${r.gps.lng},${r.gps.lat},0</coordinates></Point></Placemark>`).join("\n"); return `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>LinerSync Points</name>${marks}</Document></kml>`;}
function issues(constants,logs){const out=[]; if(!constants.project) out.push(["warn","Project missing","Fill project before export."]); if(!constants.activeRoll) out.push(["warn","Active roll missing","Set roll once; forms keep it until changed."]); if(!constants.activePanel) out.push(["warn","Active panel missing","Set panel/area before logging."]); if(logs.some(l=>!l.gps)) out.push(["warn","Some logs missing GPS","Capture GPS before locking important records."]); if(logs.some(l=>l.type==="Air Test" && Number(l.fields.holdMinutes||0)>0 && Number(l.fields.holdMinutes||0)<5)) out.push(["danger","Air test hold under 5 minutes","Correct/re-test before approval."]); if(logs.some(l=>l.status==="DRAFT")) out.push(["warn","Draft records exist","Lock good records in Logs."]); if(!logs.length) out.push(["danger","No logs saved","Capture first record."]); return out.length?out:[["ok","QC data looks clean","Keep logging."]];}
function color(kind){return kind==="Repair"?"#f59e0b":kind==="Seam"?"#38bdf8":kind==="DT"?"#ef4444":kind==="Panel"?"#22c55e":"#a78bfa";}
function clearMatchingStorageKeys(){
  const tokens = ["linersync","qc","field"];
  const matches = (key)=>tokens.some(t=>String(key||"").toLowerCase().includes(t));
  for (const store of [window.localStorage, window.sessionStorage]) {
    try {
      const toDelete = [];
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i);
        if (matches(k)) toDelete.push(k);
      }
      toDelete.forEach((k)=>store.removeItem(k));
    } catch {}
  }
  return matches;
}
function resetPoisonedBrowserStateIfRequested(){
  const params = new URLSearchParams(window.location.search);
  if (!params.has("reset")) return Promise.resolve();
  const matches = clearMatchingStorageKeys();
  if ("caches" in window) {
    try {
      caches.keys().then((names)=>Promise.all(names.filter(matches).map((name)=>caches.delete(name)))).catch(()=>{});
    } catch {}
  }
  if ("serviceWorker" in navigator) {
    try {
      navigator.serviceWorker.getRegistrations().then((regs)=>Promise.all(regs.filter((r)=>String(r.scope||"").toLowerCase().includes("linersync")).map((r)=>r.unregister()))).catch(()=>{});
    } catch {}
  }
  window.history.replaceState({}, "", window.location.pathname);
  return Promise.resolve();
}

class StartupErrorBoundary extends React.Component {
  constructor(props){super(props); this.state={error:null};}
  static getDerivedStateFromError(error){return {error};}
  componentDidCatch(error){console.error("LinerSync runtime crash", error);}
  resetStorage=()=>{clearMatchingStorageKeys(); window.location.reload();};
  render(){if(this.state.error){return <div className="startup-fallback"><h2>LinerSync startup error</h2><p>The app crashed during startup. Corrupt local data can cause this. Reset local data and reload.</p><pre>{String(this.state.error?.message||this.state.error)}</pre><button onClick={this.resetStorage}>Reset Local Data</button></div>;} return this.props.children;}
}

function App(){
  const saved=useMemo(()=>loadState(),[]);
  const [constants,setConstants]=useState(saved?.constants||blankConstants());
  const [logs,setLogs]=useState(saved?.logs||[]);
  const [points,setPoints]=useState(saved?.points||[]);
  const [tab,setTab]=useState(saved?.tab||"dashboard");
  const [type,setType]=useState("Repair");
  const [form,setForm]=useState({});
  const [gps,setGps]=useState(null);
  const [status,setStatus]=useState("Wired and ready.");
  const [search,setSearch]=useState("");
  const [editId,setEditId]=useState(null);
  const [pointKind,setPointKind]=useState("Repair");
  useEffect(()=>localStorage.setItem(STORAGE_KEY,JSON.stringify({constants,logs,points,tab})),[constants,logs,points,tab]);
  useEffect(()=>{ if(editId) return; const next={}; for(const k of FIELD_BY_TYPE[type]){ if(k==="roll") next[k]=constants.activeRoll; if(k==="panel"||k==="panelA") next[k]=constants.activePanel; if(k==="seam") next[k]=constants.activeSeam; if(k==="width") next[k]=constants.width; if(k==="weather") next[k]=constants.weather; if(k==="crew") next[k]=constants.crew||constants.installer; if(k==="machine") next[k]=constants.wedgeMachine; if(k==="extruder") next[k]=constants.extrusionWelder; if(k==="rodLot") next[k]=constants.rodLot; if(k==="holdMinutes") next[k]="5";} setForm(next);},[type,constants,editId]);
  const visible=logs.filter(l=>JSON.stringify(l).toLowerCase().includes(search.toLowerCase()));
  const circuit=`Roll ${constants.activeRoll||"-"} • Panel ${constants.activePanel||"-"} • Seam ${constants.activeSeam||"-"}`;
  function patchConst(k,v){setConstants(o=>({...o,[k]:v}));}
  function patchForm(k,v){setForm(o=>({...o,[k]:v}));}
  function captureGps(){ if(!navigator.geolocation) return setStatus("GPS not available."); setStatus("Requesting GPS..."); navigator.geolocation.getCurrentPosition(p=>{const pt={lat:p.coords.latitude,lng:p.coords.longitude,accuracyFt:Math.round((p.coords.accuracy||0)*3.28084),time:now12()}; setGps(pt); setStatus(`GPS captured ±${pt.accuracyFt} ft.`);},()=>setStatus("GPS blocked. Allow location permission."),{enableHighAccuracy:true,timeout:10000,maximumAge:0});}
  function saveLog(locked=false){const id=editId||uid(); const rec={id,type,title:`${type} - ${form.repairId||form.seam||form.panel||form.roll||form.dtNumber||constants.activeSeam||constants.activePanel||id}`,status:locked?"LOCKED":"DRAFT",time:now12(),gps,constants:{...constants},fields:{...form},notes:form.notes||""}; setLogs(old=>editId?old.map(x=>x.id===editId?rec:x):[rec,...old]); if(!editId){setPoints(old=>[{id:uid("P"),kind:type,label:rec.title,x:12+Math.random()*74,y:14+Math.random()*68,color:color(type),recordId:id},...old]);} setEditId(null); setForm({}); setGps(null); setTab("logs"); setStatus(`${rec.title} saved.`);}
  function editLog(r){setEditId(r.id); setType(r.type); setForm({...r.fields}); setGps(r.gps||null); setTab("capture"); setStatus(`Editing ${r.title}`);}
  function copyLog(r){setLogs(old=>[{...r,id:uid(),status:"DRAFT",title:`${r.title} COPY`,time:now12()},...old]);}
  function lockLog(id){setLogs(old=>old.map(r=>r.id===id?{...r,status:"LOCKED",time:`${r.time} • LOCKED ${now12()}`}:r));}
  function deleteLog(id){setLogs(old=>old.filter(r=>r.id!==id)); setPoints(old=>old.filter(p=>p.recordId!==id));}
  function placePoint(e){const rect=e.currentTarget.getBoundingClientRect(); const x=((e.clientX-rect.left)/rect.width)*100; const y=((e.clientY-rect.top)/rect.height)*100; setPoints(old=>[{id:uid("P"),kind:pointKind,label:`${pointKind} • ${constants.activeSeam||constants.activePanel||constants.activeRoll||now12()}`,x,y,color:color(pointKind)},...old]);}
  const issueList=issues(constants,logs);
  return <div className="app-shell"><aside className="sidebar"><div className="brand"><div className="brand-mark">LS</div><div><h1>LINERSYNC</h1><p>FUNCTIONAL FIELD APP</p></div></div><nav>{["dashboard","capture","logs","asbuilt","mythos","exports"].map(t=><button key={t} className={tab===t?"active":""} onClick={()=>setTab(t)}>{t.toUpperCase()}</button>)}</nav><div className="side-card"><div className="tiny">ACTIVE CIRCUIT</div><strong>{circuit}</strong></div><div className="side-card"><div className="tiny">SAVED LOGS</div><strong>{logs.length}</strong></div></aside><main className="main"><header className="topbar"><div><div className="tiny">Current Build</div><strong>Capture → Logs → As-Built → Mythos → Exports</strong></div><div className="gps-pill">{gps?`${gps.lat.toFixed(6)}, ${gps.lng.toFixed(6)}`:"GPS ready"}</div></header>
  {tab==="dashboard"&&<section className="page"><h2>Field Dashboard</h2><p className="muted">Everything is wired end-to-end. Fill constants once, capture records, save/edit/lock logs, place as-built points, run checks, export CSV/KML/JSON.</p><div className="kpis"><div className="kpi"><strong>{logs.length}</strong><span>Total Logs</span></div><div className="kpi"><strong>{logs.filter(l=>l.status==="LOCKED").length}</strong><span>Locked</span></div><div className="kpi"><strong>{points.length}</strong><span>Map Points</span></div><div className="kpi"><strong>{issueList.filter(i=>i[0]!=="ok").length}</strong><span>Issues</span></div></div><div className="card"><h3>Start Here</h3><div className="button-row"><button onClick={()=>setTab("capture")}>Open Capture</button><button onClick={()=>setTab("logs")}>Open Logs</button><button onClick={()=>setTab("exports")}>Open Exports</button></div></div></section>}
  {tab==="capture"&&<section className="page"><h2>{editId?"Edit Field Log":"Tap Capture"}</h2><p className="muted">Constants stay live until changed. Roll/panel/seam automatically fill the forms.</p><div className="card"><h3>Constant Job Data</h3><div className="form-grid">{[["project","Project"],["client","Client"],["qcTech","QC Tech"],["installer","Installer"],["crew","Crew"],["activeRoll","Active Roll"],["activePanel","Active Panel"],["activeSeam","Active Seam"],["linerType","Liner Type"],["thickness","Thickness"],["width","Width"],["weather","Weather"],["wedgeMachine","Wedge Machine"],["extrusionWelder","Extrusion Welder"],["rodLot","Rod Lot"]].map(([k,l])=><label key={k}>{l}<input value={constants[k]||""} onChange={e=>patchConst(k,e.target.value)}/></label>)}</div></div><div className="card"><h3>New Field Log</h3><label>Type<select value={type} onChange={e=>setType(e.target.value)}>{TYPES.map(t=><option key={t}>{t}</option>)}</select></label><div className="module-strip">{TYPES.map(t=><button key={t} className={type===t?"selected":""} onClick={()=>setType(t)}>{t}</button>)}</div><div className="form-grid">{FIELD_BY_TYPE[type].map(k=><label key={k}>{k}<input value={form[k]||""} onChange={e=>patchForm(k,e.target.value)}/></label>)}</div><label>Notes<textarea value={form.notes||""} onChange={e=>patchForm("notes",e.target.value)}/></label><div className="button-row"><button onClick={captureGps}>Capture GPS</button><button onClick={()=>saveLog(false)}>Save Draft</button><button className="green" onClick={()=>saveLog(true)}>Approve / Lock</button></div>{gps&&<p className="muted">GPS {gps.lat.toFixed(6)}, {gps.lng.toFixed(6)} ±{gps.accuracyFt}ft</p>}</div></section>}
  {tab==="logs"&&<section className="page"><h2>Last Logs</h2><div className="card"><label>Search<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search roll, panel, seam, repair..."/></label></div><div className="log-list">{visible.map(r=><article className="log" key={r.id}><strong>{r.title}</strong><p>{r.type} • {r.status} • {r.time}</p><p>Roll {r.fields.roll||r.constants.activeRoll||"-"} • Panel {r.fields.panel||r.constants.activePanel||"-"} • Seam {r.fields.seam||r.constants.activeSeam||"-"}</p><p>{r.gps?`GPS ${r.gps.lat.toFixed(6)}, ${r.gps.lng.toFixed(6)} ±${r.gps.accuracyFt}ft`:"No GPS"}</p><pre>{JSON.stringify(r.fields,null,2)}</pre><div className="button-row"><button onClick={()=>editLog(r)}>Edit</button><button onClick={()=>lockLog(r.id)}>Lock</button><button onClick={()=>copyLog(r)}>Copy</button><button onClick={()=>deleteLog(r.id)}>Delete</button></div></article>)}</div></section>}
  {tab==="asbuilt"&&<section className="page"><h2>As-Built Map</h2><div className="card"><label>Point Type<select value={pointKind} onChange={e=>setPointKind(e.target.value)}>{TYPES.map(t=><option key={t}>{t}</option>)}</select></label></div><div className="mapbox" onClick={placePoint}>{points.map(p=><div className="pin" key={p.id} style={{left:`${p.x}%`,top:`${p.y}%`,background:p.color}}>{p.kind[0]}</div>)}<div className="map-hint">Tap map to place point</div></div></section>}
  {tab==="mythos"&&<section className="page"><h2>Mythos Checks</h2><div className="issue-list">{issueList.map((i,n)=><div className={`issue ${i[0]}`} key={n}><strong>{i[1]}</strong><p>{i[2]}</p></div>)}</div></section>}
  {tab==="exports"&&<section className="page"><h2>Exports</h2><div className="export-grid"><div className="card"><h3>CSV</h3><button onClick={()=>saveDownload("linersync_logs.csv",makeCsv(logs),"text/csv")}>Download CSV</button></div><div className="card"><h3>KML</h3><button onClick={()=>saveDownload("linersync_points.kml",makeKml(logs),"application/vnd.google-earth.kml+xml")}>Download KML</button></div><div className="card"><h3>JSON Backup</h3><button onClick={()=>saveDownload("linersync_backup.json",JSON.stringify({constants,logs,points},null,2),"application/json")}>Download Backup</button></div></div></section>}
  </main><div className="status-bar">{status}</div></div>;
}

const rootEl = document.getElementById("root");
if (!rootEl) {
  document.body.innerHTML = "<pre style='padding:20px;color:red'>LinerSync boot error: missing #root</pre>";
} else {
  resetPoisonedBrowserStateIfRequested().finally(()=>{
    createRoot(rootEl).render(<StartupErrorBoundary><App /></StartupErrorBoundary>);
  });
}
