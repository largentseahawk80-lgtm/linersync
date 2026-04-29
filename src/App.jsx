import React, { useEffect, useMemo, useState } from "react";
import AppShell from "./components/AppShell";
import Dashboard from "./components/Dashboard";
import TapCapture from "./components/TapCapture";
import VerifyEntry from "./components/VerifyEntry";
import Logs from "./components/Logs";
import AsBuiltMap from "./components/AsBuiltMap";
import Exports from "./components/Exports";
import { buildBackupPayload, loadState, mergeImportedBackup, saveState } from "./lib/storage";
import { getHighAccuracyPosition } from "./lib/gps";
import { buildMythosAudit } from "./lib/mythos";
import { RECORD_TYPES, colorForType, nowIso, uid } from "./lib/records";
import { download, toCsv, toKml } from "./lib/exports";

function buildSession(constants, gps) {
  return {
    id: uid("CAP"),
    status: "TYPE_SELECT",
    capturedAt: nowIso(),
    gps,
    activeContext: { ...constants },
    selectedType: "",
    fields: {},
    notes: "",
    photo: "",
    mythosAudit: null,
    sourceLogId: null
  };
}

export default function App() {
  const loaded = useMemo(() => loadState(), []);
  const [constants, setConstants] = useState(loaded.state.constants);
  const [logs, setLogs] = useState(loaded.state.logs);
  const [points, setPoints] = useState(loaded.state.points);
  const [tab, setTab] = useState("dashboard");
  const [status, setStatus] = useState(loaded.repaired ? "Local state repaired from corrupt data" : "Ready");
  const [session, setSession] = useState(null);
  const [overrideReason, setOverrideReason] = useState("");

  useEffect(() => {
    saveState({ constants, logs, points });
  }, [constants, logs, points]);

  async function startCapture() {
    setStatus("Capturing GPS...");
    const gps = await getHighAccuracyPosition();
    setSession(buildSession(constants, gps));
    setTab("capture");
    setStatus("Select record type");
  }

  function setType(type) {
    setSession((current) => {
      if (!current) return current;
      const next = { ...current, selectedType: type, status: "VERIFYING" };
      return { ...next, mythosAudit: buildMythosAudit(next, overrideReason) };
    });
  }

  function setField(key, value) {
    setSession((current) => {
      if (!current) return current;
      const next = { ...current, fields: { ...current.fields, [key]: value } };
      return { ...next, mythosAudit: buildMythosAudit(next, overrideReason) };
    });
  }

  useEffect(() => {
    setSession((current) => {
      if (!current || !current.selectedType) return current;
      return { ...current, mythosAudit: buildMythosAudit(current, overrideReason) };
    });
  }, [overrideReason]);

  function saveRecord(lockRecord) {
    if (!session?.selectedType) {
      setStatus("Select record type before save");
      return;
    }

    const audit = buildMythosAudit(session, overrideReason);
    if (lockRecord && !audit.canLock) {
      setStatus("Cannot lock: Mythos blockers found");
      return;
    }

    const record = {
      id: session.sourceLogId || uid("LOG"),
      type: session.selectedType,
      title: `${session.selectedType} - ${session.fields.repairId || session.fields.seam || session.fields.panel || session.fields.roll || "record"}`,
      status: lockRecord ? "LOCKED" : "DRAFT",
      time: nowIso(),
      capturedAt: session.capturedAt,
      gps: session.gps,
      constants: session.activeContext,
      fields: session.fields,
      notes: session.notes,
      photo: session.photo,
      mythosAudit: audit,
      verifiedBy: lockRecord ? (session.fields.verifiedBy || constants.qcTech || "") : "",
      verifiedAt: lockRecord ? nowIso() : "",
      overrideReason: lockRecord ? overrideReason : ""
    };

    setLogs((current) => session.sourceLogId
      ? current.map((log) => (log.id === session.sourceLogId ? { ...record } : log))
      : [record, ...current]);

    setPoints((current) => {
      if (session.sourceLogId) {
        const existingIndex = current.findIndex((point) => point.recordId === session.sourceLogId);
        if (existingIndex >= 0) {
          const cloned = [...current];
          cloned[existingIndex] = { ...cloned[existingIndex], kind: record.type, label: record.title, color: colorForType(record.type), gps: record.gps };
          return cloned;
        }
      }
      return [{
        id: uid("PT"),
        kind: record.type,
        label: record.title,
        x: 10 + Math.random() * 80,
        y: 10 + Math.random() * 80,
        color: colorForType(record.type),
        recordId: record.id,
        gps: record.gps
      }, ...current];
    });

    setSession(null);
    setOverrideReason("");
    setTab("logs");
    setStatus(`${record.status} saved`);
  }

  return (
    <AppShell status={status} tab={tab} setTab={setTab}>
      <Dashboard startCapture={startCapture} visible={tab === "dashboard"} />
      <TapCapture session={session} setType={setType} visible={tab === "capture"} />
      <VerifyEntry
        session={session}
        visible={tab === "capture"}
        setField={setField}
        setNotes={(value) => setSession((s) => (s ? { ...s, notes: value } : s))}
        setPhoto={(value) => setSession((s) => (s ? { ...s, photo: value } : s))}
        overrideReason={overrideReason}
        setOverrideReason={setOverrideReason}
        onCancel={() => { setSession(null); setTab("dashboard"); }}
        onSaveDraft={() => saveRecord(false)}
        onLock={() => saveRecord(true)}
      />
      {tab === "logs" && (
        <Logs
          logs={logs}
          onEdit={(log) => { setSession({ ...buildSession(log.constants, log.gps), status: "VERIFYING", selectedType: log.type, fields: { ...log.fields }, notes: log.notes || "", photo: log.photo || "", mythosAudit: log.mythosAudit, sourceLogId: log.id }); setTab("capture"); }}
          onCopy={(log) => setLogs((current) => [{ ...log, id: uid("LOG"), status: "DRAFT" }, ...current])}
          onDelete={(id) => setLogs((current) => current.filter((log) => log.id !== id))}
          onLock={(log) => { setSession({ ...buildSession(log.constants, log.gps), status: "VERIFYING", selectedType: log.type, fields: { ...log.fields }, notes: log.notes || "", photo: log.photo || "", mythosAudit: log.mythosAudit, sourceLogId: log.id }); setTab("capture"); }}
        />
      )}
      {tab === "asbuilt" && (
        <AsBuiltMap
          points={points}
          addPoint={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            setPoints((current) => [{
              id: uid("PT"),
              kind: RECORD_TYPES[0],
              label: "Manual",
              x: ((event.clientX - rect.left) / rect.width) * 100,
              y: ((event.clientY - rect.top) / rect.height) * 100,
              color: colorForType(RECORD_TYPES[0]),
              gps: null
            }, ...current]);
          }}
        />
      )}
      {tab === "exports" && (
        <Exports
          onCsv={() => download("linersync.csv", toCsv(logs), "text/csv")}
          onKml={() => download("linersync.kml", toKml(logs), "application/vnd.google-earth.kml+xml")}
          onJson={() => download("linersync-backup.json", JSON.stringify(buildBackupPayload({ constants, logs, points }), null, 2), "application/json") }
          onImport={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
              try {
                const parsed = JSON.parse(String(reader.result || "{}"));
                const merged = mergeImportedBackup(parsed, { constants, logs, points });
                setLogs(merged.logs);
                setPoints(merged.points);
                if (merged.skippedLogs || merged.skippedPoints) {
                  setStatus(`Import partially completed: added ${merged.addedLogs} logs/${merged.addedPoints} points; skipped ${merged.skippedLogs} logs/${merged.skippedPoints} points`);
                } else {
                  setStatus(`Import complete: added ${merged.addedLogs} logs/${merged.addedPoints} points`);
                }
              } catch {
                setStatus("Import failed due to invalid JSON");
              }
            };
            reader.readAsText(file);
          }}
        />
      )}
    </AppShell>
  );
}
