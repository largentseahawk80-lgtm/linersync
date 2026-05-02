import { runFieldAudit } from './runFieldAudit.js';
import { assembleProjectData } from '../sync/shadowMirror.js';

export const FIELD_AUDITOR_MESSAGE_TYPES = Object.freeze({
  INIT_AUDITOR: 'INIT_AUDITOR',
  UPDATE_SPECS: 'UPDATE_SPECS',
  RUN_AUDIT_FULL: 'RUN_AUDIT_FULL',
  CANCEL_AUDIT: 'CANCEL_AUDIT',
  AUDIT_STARTED: 'AUDIT_STARTED',
  AUDIT_PROGRESS: 'AUDIT_PROGRESS',
  AUDIT_COMPLETED: 'AUDIT_COMPLETED',
  AUDIT_ERROR: 'AUDIT_ERROR'
});

let activeProjectId = null;
let activeSpecs = null;
let currentAuditId = null;

function makeAuditId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `audit-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function post(type, auditId, payload = null) {
  if (typeof self !== 'undefined' && self.postMessage) {
    self.postMessage({ type, auditId, payload });
  }
}

function normalizeWorkerMessage(message = {}) {
  return {
    type: message.type,
    auditId: message.auditId || makeAuditId(),
    projectId: message.projectId || message.payload?.projectId || activeProjectId,
    specs: message.specs || message.payload?.specs || message.payload?.projectSpecs || activeSpecs,
    payload: message.payload || {}
  };
}

export function initFieldAuditor({ projectId = null, specs = null } = {}) {
  activeProjectId = projectId || activeProjectId;
  activeSpecs = specs || activeSpecs;

  return {
    status: 'INITIALIZED',
    projectId: activeProjectId,
    hasSpecs: Boolean(activeSpecs)
  };
}

export function updateFieldAuditorSpecs(specs = null) {
  activeSpecs = specs;

  return {
    status: 'SPECS_UPDATED',
    hasSpecs: Boolean(activeSpecs)
  };
}

export function cancelFieldAudit() {
  currentAuditId = null;
  return { status: 'CANCELLED' };
}

export async function runFieldAuditFromMirror({ projectId, specs = activeSpecs, auditId = makeAuditId(), notify = post } = {}) {
  if (!projectId) {
    const error = 'PROJECT_ID_NOT_SET';
    notify(FIELD_AUDITOR_MESSAGE_TYPES.AUDIT_ERROR, auditId, error);
    return { status: 'AUDIT_ERROR', error };
  }

  if (!specs) {
    const error = 'SPEC_NOT_SET';
    notify(FIELD_AUDITOR_MESSAGE_TYPES.AUDIT_ERROR, auditId, error);
    return { status: 'AUDIT_ERROR', error };
  }

  currentAuditId = auditId;
  activeProjectId = projectId;
  activeSpecs = specs;

  notify(FIELD_AUDITOR_MESSAGE_TYPES.AUDIT_STARTED, auditId, {
    projectId,
    timestamp: new Date().toISOString()
  });

  try {
    const projectData = await assembleProjectData(projectId);

    if (currentAuditId !== auditId) {
      return { status: 'STALE_AUDIT_DROPPED', auditId };
    }

    notify(FIELD_AUDITOR_MESSAGE_TYPES.AUDIT_PROGRESS, auditId, {
      percentComplete: 50,
      currentTask: 'Running Field Auditor'
    });

    const auditReport = runFieldAudit(projectData, specs);

    if (currentAuditId !== auditId) {
      return { status: 'STALE_AUDIT_DROPPED', auditId };
    }

    notify(FIELD_AUDITOR_MESSAGE_TYPES.AUDIT_COMPLETED, auditId, auditReport);

    return {
      status: 'SUCCESS',
      auditId,
      projectId,
      auditReport
    };
  } catch (error) {
    const message = error?.message || String(error);
    notify(FIELD_AUDITOR_MESSAGE_TYPES.AUDIT_ERROR, auditId, message);
    return {
      status: 'AUDIT_ERROR',
      auditId,
      projectId,
      error: message
    };
  }
}

export async function handleFieldAuditorMessage(rawMessage = {}) {
  const message = normalizeWorkerMessage(rawMessage);

  switch (message.type) {
    case FIELD_AUDITOR_MESSAGE_TYPES.INIT_AUDITOR:
      return initFieldAuditor({ projectId: message.projectId, specs: message.specs });

    case FIELD_AUDITOR_MESSAGE_TYPES.UPDATE_SPECS:
      return updateFieldAuditorSpecs(message.specs);

    case FIELD_AUDITOR_MESSAGE_TYPES.CANCEL_AUDIT:
      return cancelFieldAudit();

    case FIELD_AUDITOR_MESSAGE_TYPES.RUN_AUDIT_FULL:
      return runFieldAuditFromMirror({
        projectId: message.projectId,
        specs: message.specs,
        auditId: message.auditId
      });

    default:
      return {
        status: 'IGNORED',
        error: `UNKNOWN_MESSAGE_TYPE: ${message.type || 'undefined'}`
      };
  }
}

if (typeof self !== 'undefined' && !self.document) {
  self.onmessage = (event) => {
    handleFieldAuditorMessage(event.data);
  };
}

export default {
  initFieldAuditor,
  updateFieldAuditorSpecs,
  cancelFieldAudit,
  runFieldAuditFromMirror,
  handleFieldAuditorMessage
};
