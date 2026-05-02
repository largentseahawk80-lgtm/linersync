import React, { useState, useEffect } from 'react';
import Storage from './lib/storage';
import ProjectList from './components/ProjectList';
import LogTable from './components/LogTable';
import ControlPanel from './components/ControlPanel';
import SyncStatus from './components/SyncStatus';
import ActiveContextBar from './components/ActiveContextBar';
import './ui-shell.css';
import './styles.css';

function App() {
  const [activeProject, setActiveProject] = useState(Storage.getActiveProject());
  const [projects, setProjects] = useState(Storage.getProjects());
  const [logs, setLogs] = useState([]);
  const [constants, setConstants] = useState([]);
  const [points, setPoints] = useState([]);
  const [view, setView] = useState("dashboard");
  const [session, setSession] = useState(null);

  useEffect(() => {
    if (activeProject) {
      const state = Storage.loadProjectState(activeProject.id);
      setLogs(state.logs || []);
      setConstants(state.constants || []);
      setPoints(state.points || []);
    }
  }, [activeProject]);

  const handleAddLog = (newLog) => {
    const logWithContext = {
      ...newLog,
      roll: activeProject?.constants?.roll || '',
      panel: activeProject?.constants?.panel || '',
      seam: activeProject?.constants?.seam || '',
      qcTech: activeProject?.constants?.qcTech || '',
      timestamp: new Date().toISOString()
    };
    const updatedLogs = [...logs, logWithContext];
    setLogs(updatedLogs);
    Storage.saveProjectState(activeProject.id, { constants, logs: updatedLogs, points });
  };

  const handleExportCSV = () => {
    const headers = ['Timestamp', 'Roll', 'Panel', 'Seam', 'QC Tech', 'Value'];
    const rows = logs.map(log => [
      log.timestamp,
      activeProject?.constants?.roll || '',
      activeProject?.constants?.panel || '',
      activeProject?.constants?.seam || '',
      activeProject?.constants?.qcTech || '',
      log.value
    ]);
    
    let csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n"
      + rows.map(e => e.join(",")).join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${activeProject.name}_logs.csv`);
    document.body.appendChild(link);
    link.click();
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1>LinerSync</h1>
        <SyncStatus />
      </header>
      
      <main className="main-content">
        {activeProject && (
          <ActiveContextBar 
            roll={activeProject?.constants?.roll}
            panel={activeProject?.constants?.panel}
            seam={activeProject?.constants?.seam}
            qcTech={activeProject?.constants?.qcTech}
          />
        )}
        
        {view === "dashboard" ? (
          <div className="dashboard">
            <ProjectList 
              projects={projects} 
              onSelect={setActiveProject}
              activeProjectId={activeProject?.id}
            />
            {activeProject && (
              <>
                <ControlPanel onAddLog={handleAddLog} onExport={handleExportCSV} />
                <LogTable logs={logs} />
              </>
            )}
          </div>
        ) : (
          <div className="settings">
            {/* Settings View */}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
