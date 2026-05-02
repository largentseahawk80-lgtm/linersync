import React, { useEffect, useMemo, useState } from "react";
import AppShell from "./components/AppShell";
import ProjectHome from "./components/ProjectHome";
import TapCapture from "./components/TapCapture";
import VerifyEntry from "./components/VerifyEntry";
import Logs from "./components/Logs";
import Exports from "./components/Exports";
import Dashboard from "./components/Dashboard";
import { Storage } from "./lib/storage";

export default function App() {
  const [active, setActive] = useState(Storage.getActiveProject());
  const [projects, setProjects] = useState(Storage.getProjects());
  const [records, setRecords] = useState(Storage.getRecords());
  const [view, setView] = useState("dashboard");
  const [session, setSession] = useState(null);

  useEffect(() => {
    Storage.saveProjects(projects);
  }, [projects]);

  useEffect(() => {
    Storage.saveRecords(records);
  }, [records]);

  const saveRecord = (type) => {
    if (!session) return;
    const newRecord = {
      ...session,
      id: crypto.randomUUID(),
      type,
      projectId: active?.id || 'N/A',
      projectName: active?.name || 'N/A',
      roll: active?.roll || 'N/A',
      panel: active?.panel || 'N/A',
      seam: active?.seam || 'N/A',
      qcTech: active?.qcTech || 'N/A'
    };
    setRecords([newRecord, ...records]);
    setSession(null);
    setView("logs");
  };

  const exportCSV = () => {
    const headers = ["ID", "Type", "Time", "Lat", "Lng", "ProjectID", "ProjectName", "Roll", "Panel", "Seam", "QCTech"];
    const rows = records.map(r => [
      r.id,
      r.type,
      r.capturedAt,
      r.gps?.lat || "",
      r.gps?.lng || "",
      r.projectId,
      r.projectName,
      r.roll,
      r.panel,
      r.seam,
      r.qcTech
    ]);
    
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "linersync_records.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <AppShell 
      activeView={view} 
      setView={setView} 
      activeProject={active}
      onExport={exportCSV}
    >
      <Dashboard 
        visible={view === "dashboard"} 
        records={records} 
        projects={projects} 
      />
      <ProjectHome 
        visible={view === "projects"}
        activeProject={active}
        projects={projects}
        onSelect={(p) => {
          setActive(p);
          Storage.setActiveProject(p);
        }}
        onCreate={(p) => setProjects([...projects, p])}
      />
      <TapCapture 
        visible={view === "capture"}
        session={session}
        activeProject={active}
        onStartCapture={() => setSession({ 
          capturedAt: new Date().toISOString(),
          gps: { lat: 0, lng: 0 } // Mock GPS
        })}
        setType={saveRecord}
      />
      <Logs 
        visible={view === "logs"} 
        records={records} 
      />
    </AppShell>
  );
}
