import React from "react";
import { FIELDS_BY_TYPE } from "../lib/records";
import MythosPanel from "./MythosPanel";

export default function VerifyEntry({
  session,
  visible = true,
  setField,
  setNotes,
  setPhoto,
  setOverrideReason,
  overrideReason,
  onCancel,
  onSaveDraft,
  onLock
}) {
  if (!visible || !session?.selectedType) return null;

  return (
    <section className="page">
      <div className="card">
        <h3>Verify {session.selectedType}</h3>
        {(FIELDS_BY_TYPE[session.selectedType] || []).map((field) => (
          <label key={field}>
            {field}
            <input value={session.fields?.[field] || ""} onChange={(e) => setField(field, e.target.value)} />
          </label>
        ))}
        <label>Notes<textarea value={session.notes || ""} onChange={(e) => setNotes(e.target.value)} /></label>
        <label>Photo<input type="file" accept="image/*" capture="environment" onChange={(e) => setPhoto(e.target.files?.[0]?.name || "")} /></label>
        <label>Override reason<input value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} /></label>
        <MythosPanel audit={session.mythosAudit} />
        <div className="button-row">
          <button onClick={onCancel}>Cancel Capture</button>
          <button onClick={onSaveDraft}>Save Draft</button>
          <button className="green" onClick={onLock}>Approve / Lock</button>
        </div>
      </div>
    </section>
  );
}
