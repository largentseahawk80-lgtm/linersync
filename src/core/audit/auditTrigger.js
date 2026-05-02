import { runFieldAuditFromMirror } from './fieldAuditorWorker.js';

export const AUDIT_TRIGGER_STATUS = Object.freeze({
  IDLE: 'IDLE',
  PASS: 'PASS',
  WARNING: 'WARNING',
  CRITICAL: 'CRITICAL',
  SKIPPED: 'SKIPPED',
  ERROR: 'ERROR'
});

function getAuditHealth(auditReport = null) {
  if (!auditReport) return AUDIT_TRIGGER_STATUS.ERROR;

  const status = String(auditReport.status || '').toUpperCase();
  if (status === 'PASS') return AUDIT_TRIGGER_STATUS.PASS;
  if (status === 'WARNING') return AUDIT_TRIGGER_STATUS.WARNING;
  if (status === 'CRITICAL') return AUDIT_TRIGGER_STATUS.CRITICAL;

  const criticalCount = auditReport.summary?.criticalCount || 0;
  const warningCount = auditReport.summary?.warningCount || 0;

  if (criticalCount > 0 || auditReport.exportBlocked) return AUDIT_TRIGGER_STATUS.CRITICAL;
  if (warningCount > 0) return AUDIT_TRIGGER_STATUS.WARNING;

  return AUDIT_TRIGGER_STATUS.PASS;
}

function makeAuditId(projectId = 'UNKNOWN') {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `audit-trigger-${projectId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function runPassiveAudit({
  projectId,
  projectSpecs = null,
  reason = 'PASSIVE_AUDIT_TRIGGER',
  notify = null
} = {}) {
  if (!projectId) {
    return {
      status: AUDIT_TRIGGER_STATUS.SKIPPED,
      reason: 'PROJECT_ID_NOT_SET',
      auditReport: null
    };
  }

  if (!projectSpecs) {
    return {
      status: AUDIT_TRIGGER_STATUS.SKIPPED,
      reason: 'SPEC_NOT_SET',
      auditReport: null
    };
  }

  const auditId = makeAuditId(projectId);
  const messages = [];

  const captureMessage = (type, messageAuditId, payload) => {
    const message = { type, auditId: messageAuditId, payload };
    messages.push(message);
    if (typeof notify === 'function') notify(message);
  };

  try {
    const result = await runFieldAuditFromMirror({
      projectId,
      specs: projectSpecs,
      auditId,
      notify: captureMessage
    });

    if (result.status !== 'SUCCESS') {
      return {
        status: AUDIT_TRIGGER_STATUS.ERROR,
        reason: result.error || result.status,
        auditId,
        auditReport: result.auditReport || null,
        messages
      };
    }

    return {
      status: getAuditHealth(result.auditReport),
      reason,
      auditId,
      auditReport: result.auditReport,
      messages
    };
  } catch (error) {
    return {
      status: AUDIT_TRIGGER_STATUS.ERROR,
      reason: error?.message || String(error),
      auditId,
      auditReport: null,
      messages
    };
  }
}

export function formatAuditStatus(result = null) {
  if (!result) return 'Audit idle';

  switch (result.status) {
    case AUDIT_TRIGGER_STATUS.PASS:
      return 'Audit PASS';
    case AUDIT_TRIGGER_STATUS.WARNING:
      return 'Audit WARNING';
    case AUDIT_TRIGGER_STATUS.CRITICAL:
      return 'Audit CRITICAL';
    case AUDIT_TRIGGER_STATUS.SKIPPED:
      return `Audit skipped: ${result.reason}`;
    case AUDIT_TRIGGER_STATUS.ERROR:
      return `Audit error: ${result.reason}`;
    default:
      return 'Audit idle';
  }
}

export default {
  AUDIT_TRIGGER_STATUS,
  runPassiveAudit,
  formatAuditStatus
};
