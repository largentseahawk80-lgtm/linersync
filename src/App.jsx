import React, { useEffect, useMemo, useState } from 'react';
import AppShell from './components/AppShell';
import ProjectHome from './components/ProjectHome';
import Dashboard from './components/Dashboard';
import TapCapture from './components/TapCapture';
import VerifyEntry from './components/VerifyEntry';
import Logs from './components/Logs';
import AsBuiltMap from './components/AsBuiltMap';
import Exports from './components/Exports';
import { Storage, defaultState } from './lib/storage';
import { getHighAccuracyPosition } from './lib/gps';
import { buildMythosAudit } from './lib/mythos';
import { colorForType, uid } from './lib/records';
import { download, toCsv, toKml } from './lib/exports';
import { runPassiveAudit } from './core/audit/auditTrigger.js';
import { resolveProjectSpecs } from './core/audit/defaultProjectSpecs.js';
import { makeMirrorEventFromLog } from './core/sync/logToMirrorEvent.js';
import { upsertMirrorRecord } from './core/sync/shadowMirror.js';

const emptyCapture = () => null;
const metersToFeet = (meters) => Math.round((meters || 0) * 3.28084);

function normalizeImportedState(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    constants: raw.constants || defaultState.constants,
    logs: Array.isArray(raw.logs) ? raw.logs : [],
    points: Array.isArray(raw.points) ? raw.points : [],
    auditStatus: raw.auditStatus || defaultState.auditStatus
  };
}

function makeProjectMirrorEvent(project, constants = {}) {
  if (!project?.id) return null;
  const projectSpecs = resolveProjectSpecs(project, constants);

  return {
    eventId: `APP-SAVE-PROJECT-${project.id}`,
    eventType: 'SAVE_RECORD',
    recordType: 'PROJECT',
    projectId: project.id,
    payload: {
      id: project.id,
      data: {
        projectId: project.id,
        name: project.name || constants.project || 'LinerSync',
        projectName: project.name || constants.project || 'LinerSync',
        status: 'ACTIVE',
        projectSpecs
      }
    },
    timestamp: new Date().toISOString(),
    origin: 'linersync-app-passive-audit'
  };
}

export default function App() {
  const [projects, setProjects] = useState(() => Storage.getProjects());
  const [activeProjectId, setActiveProjectId] = useState(() => Storage.getActiveProjectId());
  const [tab, setTab] = useState(() => (Storage.getActiveProjectId() ? 'dashboard' : 'projects'));
  const [logs, setLogs] = useState([]);
  const [points, setPoints] = useState([]);
  const [constants, setConstants] = useState(defaultState.constants);
  const [captureSession, setCaptureSession] = useState(emptyCapture);
  const [overrideReason, setOverrideReasonState] = useState('');
  const [status, setStatus] = useState('Ready');
  const [gpsMeter, setGpsMeter] = useState({
    supported: typeof navigator !== 'undefined' && !!navigator.geolocation,
    accuracyFt: null,
    timestamp: null,
    error: null,
    lat: null,
    lng: null
  });

  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId) || null,
    [projects, activeProjectId]
  );

  useEffect(() => {
    const migrated = Storage.runMigration?.();
    if (migrated) {
      setProjects(Storage.getProjects());
      setActiveProjectId(migrated.id);
      setTab('dashboard');
    }
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsMeter({ supported: false, accuracyFt: null, timestamp: null, error: 'UNSUPPORTED', lat: null, lng: null });
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setGpsMeter({
          supported: true,
          accuracyFt: metersToFeet(position.coords.accuracy),
          timestamp: Date.now(),
          error: null,
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
      },
      (error) => {
        let errorCode = 'GPS_ERROR';
        if (error.code === 1) errorCode = 'PERMISSION_DENIED';
        if (error.code === 2) errorCode = 'POSITION_UNAVAILABLE';
        if (error.code === 3) errorCode = 'TIMEOUT';

        setGpsMeter((current) => ({
          ...current,
          supported: true,
          error: errorCode,
          timestamp: current.timestamp || null
        }));
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  useEffect(() => {
    if (!activeProjectId) {
      setLogs([]);
      setPoints([]);
      setConstants(defaultState.constants);
      setCaptureSession(null);
      setTab('projects');
      return;
    }

    const state = Storage.loadProjectState(activeProjectId);
    setLogs(state.logs || []);
    setPoints(state.points || []);
    setConstants(state.constants || defaultState.constants);
    setCaptureSession(null);
    setStatus(state.auditStatus || 'Project loaded');
  }, [activeProjectId]);

  const saveProjectState = (nextLogs = logs, nextPoints = points, nextConstants = constants, nextAuditStatus = status) => {
    if (!activeProjectId) return;
    Storage.saveProjectState(activeProjectId, {
      constants: nextConstants,
      logs: nextLogs,
      points: nextPoints,
      auditStatus: nextAuditStatus || defaultState.auditStatus
    });
  };

  const setAndSaveStatus = (nextStatus) => {
    setStatus(nextStatus);
    if (activeProjectId) {
      Storage.saveProjectData(activeProjectId, 'auditStatus', nextStatus);
    }
  };

  const syncLogToMirrorAndAudit = async (log) => {
    if (!activeProject?.id || !log?.id) return;

    try {
      const projectSpecs = resolveProjectSpecs(activeProject, constants);
      const projectEvent = makeProjectMirrorEvent(activeProject, constants);
      if (projectEvent) await upsertMirrorRecord(projectEvent);

      const mirrorEvent = makeMirrorEventFromLog(log);
      if (mirrorEvent.status === 'READY') {
        await upsertMirrorRecord(mirrorEvent.event);
      }

      const auditResult = await runPassiveAudit({
        projectId: activeProject.id,
        projectSpecs,
        reason: `POST_${log.status}_${log.type}`
      });

      if (auditResult.status === 'PASS') {
        setAndSaveStatus(`${log.status === 'LOCKED' ? 'Locked' : 'Saved'} ${log.type} • Audit PASS`);
      } else if (auditResult.status === 'WARNING' || auditResult.status === 'CRITICAL') {
        setAndSaveStatus(`${log.status === 'LOCKED' ? 'Locked' : 'Saved'} ${log.type} • Audit ${auditResult.status}`);
      } else if (auditResult.status === 'ERROR') {
        setAndSaveStatus(`${log.status === 'LOCKED' ? 'Locked' : 'Saved'} ${log.type} • Audit error: ${auditResult.reason || 'unknown'}`);
      } else if (auditResult.status === 'SKIPPED') {
        setAndSaveStatus(`${log.status === 'LOCKED' ? 'Locked' : 'Saved'} ${log.type} • Audit skipped: ${auditResult.reason || 'unknown'}`);
      } else {
        setAndSaveStatus(`${log.status === 'LOCKED' ? 'Locked' : 'Saved'} ${log.type} • Mirror synced`);
      }
    } catch (error) {
      setAndSaveStatus(`${log.status === 'LOCKED' ? 'Locked' : 'Saved'} ${log.type} • Mirror sync warning`);
    }
  };

  const openProject = (project) => {
    Storage.setActiveProjectId(project.id);
    setActiveProjectId(project.id);
    setTab('dashboard');
  };

  const createProject = (data) => {
    const project = Storage.createProject(data);
    setProjects(Storage.getProjects());
    setActiveProjectId(project.id);
    setTab('dashboard');
  };

  const exitProject = () => {
    Storage.setActiveProjectId('');
    setActiveProjectId('');
    setStatus('Select or create a project');
  };

  const getActiveContext = () => ({
    project: activeProject?.name || constants.project || '',
    activeRoll: constants.activeRoll || '',
    activePanel: constants.activePanel || '',
    activeSeam: constants.activeSeam || '',
    qcTech: constants.qcTech || activeProject?.qcTech || ''
  });

  const updateCapture = (producer) => {
    setCaptureSession((current) => {
      if (!current) return current;
      const next = typeof producer === 'function' ? producer(current) : producer;
      return {
        ...next,
        mythosAudit: buildMythosAudit(next, overrideReason)
      };
    });
  };

  const startCapture = async () => {
    if (!activeProject) {
      setStatus('Open a project before capturing records');
      return;
    }

    setStatus('Capturing GPS...');
    const gps = await getHighAccuracyPosition();
    const session = {
      id: uid('CAP'),
      projectId: activeProject.id,
      capturedAt: gps.capturedAt || new Date().toISOString(),
      gps,
      selectedType: '',
      fields: {},
      notes: '',
      photo: '',
      activeContext: getActiveContext()
    };

    session.mythosAudit = buildMythosAudit(session, '');
    setOverrideReasonState('');
    setCaptureSession(session);
    setTab('capture');
    setStatus(gps.error ? `GPS warning: ${gps.error}` : 'GPS captured');
  };

  const setType = (type) => {
    updateCapture((current) => ({
      ...current,
      selectedType: type,
      fields: current.selectedType === type ? current.fields : {}
    }));
  };

  const setField = (field, value) => {
    updateCapture((current) => ({
      ...current,
      fields: {
        ...(current.fields || {}),
        [field]: value
      }
    }));
  };

  const setNotes = (notes) => {
    updateCapture((current) => ({ ...current, notes }));
  };

  const setPhoto = (photo) => {
    updateCapture((current) => ({ ...current, photo }));
  };

  const setOverrideReason = (value) => {
    setOverrideReasonState(value);
    setCaptureSession((current) => {
      if (!current) return current;
      return {
        ...current,
        mythosAudit: buildMythosAudit(current, value)
      };
    });
  };

  const recordTitle = (session) => {
    const fields = session.fields || {};
    return fields.repairId || fields.seam || fields.panel || fields.roll || fields.dtNumber || session.selectedType;
  };

  const commitCapture = (recordStatus) => {
    if (!captureSession?.selectedType) {
      setStatus('Choose a record type before saving');
      return;
    }

    const finalAudit = buildMythosAudit(captureSession, overrideReason);
    if (recordStatus === 'LOCKED' && !finalAudit.canLock) {
      setStatus('Fix blockers or enter an override reason before locking');
      setCaptureSession((current) => ({ ...current, mythosAudit: finalAudit }));
      return;
    }

    const log = {
      ...captureSession,
      id: uid('LOG'),
      type: captureSession.selectedType,
      title: recordTitle(captureSession),
      status: recordStatus,
      verifiedBy: captureSession.activeContext?.qcTech || '',
      overrideReason,
      mythosAudit: finalAudit,
      time: new Date(captureSession.capturedAt).toLocaleString(),
      constants: captureSession.activeContext
    };

    const nextLogs = [log, ...logs];
    const nextPoints = captureSession.gps?.lat && captureSession.gps?.lng
      ? [
          {
            id: uid('PT'),
            logId: log.id,
            projectId: activeProjectId,
            type: log.type,
            kind: log.type,
            label: log.title,
            gps: log.gps,
            x: 50,
            y: 50,
            color: colorForType(log.type)
          },
          ...points
        ]
      : points;

    setLogs(nextLogs);
    setPoints(nextPoints);
    saveProjectState(nextLogs, nextPoints, constants, status);
    void syncLogToMirrorAndAudit(log);
    setCaptureSession(null);
    setOverrideReasonState('');
    setTab('dashboard');
    setStatus(`${recordStatus === 'LOCKED' ? 'Locked' : 'Saved'} ${log.type}`);
  };

  const editLog = (log) => {
    setCaptureSession({
      ...log,
      selectedType: log.type,
      fields: log.fields || {},
      notes: log.notes || '',
      photo: log.photo || '',
      mythosAudit: buildMythosAudit({ ...log, selectedType: log.type }, log.overrideReason || '')
    });
    setOverrideReasonState(log.overrideReason || '');
    setTab('capture');
  };

  const copyLog = (log) => {
    const copy = {
      ...log,
      id: uid('LOG'),
      status: 'DRAFT',
      capturedAt: new Date().toISOString(),
      time: new Date().toLocaleString(),
      title: `${log.title || log.type} copy`
    };
    const nextLogs = [copy, ...logs];
    setLogs(nextLogs);
    saveProjectState(nextLogs, points, constants, status);
    setStatus('Copied log as draft');
  };

  const deleteLog = (logId) => {
    const nextLogs = logs.filter((log) => log.id !== logId);
    const nextPoints = points.filter((point) => point.logId !== logId);
    setLogs(nextLogs);
    setPoints(nextPoints);
    saveProjectState(nextLogs, nextPoints, constants, status);
    setStatus('Deleted log');
  };

  const lockLog = (log) => {
    const nextLogs = logs.map((item) => item.id === log.id ? { ...item, status: 'LOCKED' } : item);
    setLogs(nextLogs);
    saveProjectState(nextLogs, points, constants, status);
    setStatus('Locked log');
  };

  const addManualPoint = (event) => {
    if (!activeProjectId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    const nextPoints = [
      {
        id: uid('PT'),
        projectId: activeProjectId,
        type: 'Manual',
        kind: 'Manual',
        label: 'Manual point',
        x,
        y,
        color: '#f59e0b'
      },
      ...points
    ];
    setPoints(nextPoints);
    saveProjectState(logs, nextPoints, constants, status);
    setStatus('Manual map point added');
  };

  const exportCsv = () => download(`${activeProject?.name || 'linersync'}-logs.csv`, toCsv(logs), 'text/csv;charset=utf-8;');
  const exportKml = () => download(`${activeProject?.name || 'linersync'}-asbuilt.kml`, toKml(logs), 'application/vnd.google-earth.kml+xml');
  const exportJson = () => download(
    `${activeProject?.name || 'linersync'}-backup.json`,
    JSON.stringify({ project: activeProject, constants, logs, points, auditStatus: status }, null, 2),
    'application/json;charset=utf-8;'
  );

  const importJson = (event) => {
    const file = event.target.files?.[0];
    if (!file || !activeProjectId) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = normalizeImportedState(JSON.parse(String(reader.result || '{}')));
        if (!imported) throw new Error('Invalid backup');
        setConstants(imported.constants);
        setLogs(imported.logs);
        setPoints(imported.points);
        setStatus(imported.auditStatus || defaultState.auditStatus);
        Storage.saveProjectState(activeProjectId, imported);
        setStatus(imported.auditStatus || 'JSON backup imported');
      } catch (error) {
        setStatus(`Import failed: ${error.message}`);
      }
    };
    reader.readAsText(file);
  };

  if (!activeProject) {
    return (
      <ProjectHome
        projects={projects}
        activeProjectId={activeProjectId}
        onOpenProject={openProject}
        onCreateProject={createProject}
      />
    );
  }

  const captureContent = captureSession?.selectedType ? (
    <VerifyEntry
      session={captureSession}
      setField={setField}
      setNotes={setNotes}
      setPhoto={setPhoto}
      setOverrideReason={setOverrideReason}
      overrideReason={overrideReason}
      onCancel={() => {
        setCaptureSession(null);
        setOverrideReasonState('');
        setTab('dashboard');
      }}
      onSaveDraft={() => commitCapture('DRAFT')}
      onLock={() => commitCapture('LOCKED')}
    />
  ) : (
    <TapCapture
      session={captureSession}
      activeProject={activeProject}
      onStartCapture={startCapture}
      setType={setType}
    />
  );

  return (
    <AppShell
      status={status}
      tab={tab}
      setTab={setTab}
      activeProject={activeProject}
      onExitProject={exitProject}
      gpsMeter={gpsMeter}
    >
      {tab === 'dashboard' ? (
        <Dashboard
          startCapture={startCapture}
          activeProject={activeProject}
          logs={logs}
          setTab={setTab}
          status={status}
          gpsMeter={gpsMeter}
        />
      ) : null}

      {tab === 'capture' ? captureContent : null}

      {tab === 'logs' ? (
        <Logs
          logs={logs}
          onEdit={editLog}
          onCopy={copyLog}
          onDelete={deleteLog}
          onLock={lockLog}
        />
      ) : null}

      {tab === 'asbuilt' ? (
        <AsBuiltMap points={points} addPoint={addManualPoint} />
      ) : null}

      {tab === 'exports' ? (
        <Exports
          onCsv={exportCsv}
          onKml={exportKml}
          onJson={exportJson}
          onImport={importJson}
        />
      ) : null}
    </AppShell>
  );
}
