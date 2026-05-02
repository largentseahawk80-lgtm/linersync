import React, { useState, useEffect } from 'react';
import AppShell from './components/AppShell';
import ProjectHome from './components/ProjectHome';
import Dashboard from './components/Dashboard';
import TapCapture from './components/TapCapture';
import VerifyEntry from './components/VerifyEntry';
import Logs from './components/Logs';
import AsBuiltMap from './components/AsBuiltMap';
import Exports from './components/Exports';
import { loadState, saveState, Storage } from './lib/storage';

export default function App() {
  const [session, setSession] = useState(() => loadState() || { projects: [], activeProjectId: null, activeContext: {} });
  const [view, setView] = useState('dashboard');
  const [activeProject, setActiveProject] = useState(null);
  const [logs, setLogs] = useState([]);
  const [constants, setConstants] = useState({});
  const [points, setPoints] = useState([]);

  useEffect(() => {
    saveState(session);
  }, [session]);

  useEffect(() => {
    if (session.activeProjectId) {
      const project = session.projects.find(p => p.id === session.activeProjectId);
      setActiveProject(project);
      if (project) {
        const state = Storage.loadProjectState(project.id);
        setLogs(state.logs || []);
        setConstants(state.constants || {});
        setPoints(state.points || []);
      }
    }
  }, [session.activeProjectId, session.projects]);

  const saveLog = (logData) => {
    const newLog = {
      ...logData,
      id: Date.now(),
      timestamp: new Date().toISOString(),
      constants: {
        ...session.activeContext,
        activeRoll: constants.activeRoll || session.activeContext?.activeRoll || "",
        activePanel: constants.activePanel || session.activeContext?.activePanel || "",
        activeSeam: constants.activeSeam || session.activeContext?.activeSeam || "",
        qcTech: constants.qcTech || session.activeContext?.qcTech || ""
      }
    };
    const updatedLogs = [...logs, newLog];
    setLogs(updatedLogs);
    Storage.saveProjectState(activeProject.id, { constants, logs: updatedLogs, points });
    setView('project-home');
  };

  const exportCSV = () => {
    const headers = ['Timestamp', 'Roll', 'Panel', 'Seam', 'QC Tech', 'Type', 'Value'];
    const rows = logs.map(log => [
      log.timestamp,
      log.constants.activeRoll,
      log.constants.activePanel,
      log.constants.activeSeam,
      log.constants.qcTech,
      log.type,
      log.value
    ]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${activeProject?.name || 'project'}_export.csv`;
    link.click();
  };

  const renderView = () => {
    switch (view) {
      case 'dashboard':
        return (
          <Dashboard 
            projects={session.projects} 
            onSelectProject={(id) => {
              setSession({ ...session, activeProjectId: id });
              setView('project-home');
            }}
            onCreateProject={(name) => {
              const newProject = { id: Date.now().toString(), name };
              setSession({ ...session, projects: [...session.projects, newProject] });
            }}
          />
        );
      case 'project-home':
        return <ProjectHome project={activeProject} setView={setView} />;
      case 'capture':
        return <TapCapture session={session} onSave={saveLog} onCancel={() => setView('project-home')} />;
      case 'verify':
        return <VerifyEntry session={session} onSave={saveLog} onCancel={() => setView('project-home')} />;
      case 'logs':
        return <Logs logs={logs} />;
      case 'map':
        return <AsBuiltMap points={points} />;
      case 'exports':
        return <Exports onExport={exportCSV} />;
      default:
        return <Dashboard projects={session.projects} />;
    }
  };

  return (
    <AppShell view={view} setView={setView} activeProject={activeProject}>
      {renderView()}
    </AppShell>
  );
}
