
  const [activeProject, setActiveProject] = useState(Storage.getActiveProject());
  const [projects, setProjects] = useState(Storage.getProjects());
  const [records, setRecords] = useState([]);
  const [constants, setConstants] = useState([]);
  const [points, setPoints] = useState([]);
  const [view, setView] = useState("dashboard");
  const [session, setSession] = useState(null);

  useEffect(() => {
    Storage.saveProjects(projects);
  }, [projects]);

  useEffect(() => {
    if (activeProject) {
      const state = Storage.loadProjectState(activeProject.id);
      setRecords(state.logs || []);
      setConstants(state.constants || []);
      setPoints(state.points || []);
    }
  }, [activeProject]);

  const saveLog = (type) => {
    const newRecord = {
      ...session,
      id: crypto.randomUUID(),
      type,
      projectId: activeProject?.id || 'N/A',
      projectName: activeProject?.name || 'N/A',
      roll: activeProject?.roll || 'N/A',
      panel: activeProject?.panel || 'N/A',
      seam: activeProject?.seam || 'N/A',
      qcTech: activeProject?.qcTech || 'N/A'
    };
    const updatedLogs = [newRecord, ...records];
    setRecords(updatedLogs);
    if (activeProject) {
      Storage.saveProjectState(activeProject.id, { 
        constants, 
        logs: updatedLogs, 
        points 
      });
    }
    setSession(null);
    setView("logs");
  };

  const exportCSV = () => {
    const csvContent = "data:text/csv;charset=utf-8," + 
      "ID,Type,Project,Roll,Panel,Seam,QC Tech\n" +
      records.map(r => `${r.id},${r.type},${r.projectName},${r.roll},${r.panel},${r.seam},${r.qcTech}`).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `linersync_${activeProject?.name || 'export'}.csv`);
    document.body.appendChild(link);
    link.click();
  };

  const renderView = () => {
    if (!activeProject && view !== "dashboard") {
      return <Dashboard projects={projects} setProjects={setProjects} setActiveProject={setActiveProject} />;
    }

    switch (view) {
      case "dashboard":
        return <Dashboard projects={projects} setProjects={setProjects} setActiveProject={setActiveProject} />;
      case "project":
        return <ProjectHome project={activeProject} setView={setView} setSession={setSession} />;
      case "capture":
        return <TapCapture session={session} onSave={saveLog} onCancel={() => setView("project")} />;
      case "verify":
        return <VerifyEntry session={session} onSave={saveLog} onCancel={() => setView("project")} />;
      case "logs":
        return <Logs records={records} />;
      case "exports":
        return <Exports onExport={exportCSV} />;
      default:
        return <Dashboard projects={projects} setProjects={setProjects} setActiveProject={setActiveProject} />;
    }
  };

  return (
    <AppShell 
      view={view} 
      setView={setView} 
      activeProject={activeProject}
      setActiveProject={setActiveProject}
    >
      {renderView()}
    </AppShell>
  );
}
