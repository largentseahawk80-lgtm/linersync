import { runFieldAuditFromMirror } from './fieldAuditorWorker.js';
import { DEFAULT_PROJECT_SPECS } from './runFieldAudit.js';
import {
  assembleProjectData,
  deleteMirrorRecord,
  upsertMirrorRecord
} from '../sync/shadowMirror.js';

const TEST_PROJECT_ID = 'WORKER-SMOKE-PROJECT-001';

const TEST_SPECS = {
  ...DEFAULT_PROJECT_SPECS,
  airTest: {
    minDurationMin: 5,
    allowedDropPSI: 2,
    allowedDropPercent: null
  },
  destruct: {
    frequencyFT: 500,
    minPeelLB: 60,
    minShearLB: 80
  },
  trialWeld: {
    minPeelLB: 60,
    minShearLB: 80,
    validityHours: 12
  },
  material: {
    yieldTolerancePercent: 0.05
  },
  exportReadiness: {
    requireAllTests: true,
    requirePassOnly: true
  }
};

function makeEvent(eventType, recordType, data, id = '') {
  return {
    eventId: `WORKER-SMOKE-${recordType}-${id || Date.now()}`,
    eventType,
    recordType,
    priority: 1,
    projectId: TEST_PROJECT_ID,
    payload: {
      id,
      data
    },
    timestamp: new Date().toISOString(),
    origin: 'field-auditor-worker-smoke-test'
  };
}

async function cleanupWorkerSmokeData() {
  const deletions = [
    ['AIR_TEST', 'WORKER-SMOKE-AT-001'],
    ['WEDGE_TEST', 'WORKER-SMOKE-WT-001'],
    ['DESTRUCT', 'WORKER-SMOKE-DT-001'],
    ['SEAM', 'WORKER-SMOKE-SM-001'],
    ['PANEL', 'WORKER-SMOKE-PN-001'],
    ['PANEL', 'WORKER-SMOKE-PN-002'],
    ['ROLL', 'WORKER-SMOKE-RL-001'],
    ['PROJECT', TEST_PROJECT_ID]
  ];

  for (const [recordType, id] of deletions) {
    try {
      await deleteMirrorRecord(makeEvent('DELETE_RECORD', recordType, {}, id));
    } catch {
      // Best-effort cleanup. Missing test records are safe to ignore.
    }
  }
}

async function seedWorkerSmokeData() {
  const events = [
    makeEvent('SAVE_RECORD', 'PROJECT', {
      projectId: TEST_PROJECT_ID,
      name: 'Field Auditor Worker Smoke Test',
      status: 'active',
      projectSpecs: TEST_SPECS
    }, TEST_PROJECT_ID),
    makeEvent('SAVE_RECORD', 'ROLL', {
      rollId: 'WORKER-SMOKE-RL-001',
      projectId: TEST_PROJECT_ID,
      materialType: 'HDPE',
      status: 'active'
    }, 'WORKER-SMOKE-RL-001'),
    makeEvent('SAVE_RECORD', 'PANEL', {
      panelId: 'WORKER-SMOKE-PN-001',
      projectId: TEST_PROJECT_ID,
      rollId: 'WORKER-SMOKE-RL-001',
      datePlaced: '2026-05-02T08:00:00Z',
      length: '100 ft',
      width: '22.5 ft'
    }, 'WORKER-SMOKE-PN-001'),
    makeEvent('SAVE_RECORD', 'PANEL', {
      panelId: 'WORKER-SMOKE-PN-002',
      projectId: TEST_PROJECT_ID,
      rollId: 'WORKER-SMOKE-RL-001',
      datePlaced: '2026-05-02T08:15:00Z',
      length: '100 ft',
      width: '22.5 ft'
    }, 'WORKER-SMOKE-PN-002'),
    makeEvent('SAVE_RECORD', 'SEAM', {
      seamId: 'WORKER-SMOKE-SM-001',
      projectId: TEST_PROJECT_ID,
      parentPanels: ['WORKER-SMOKE-PN-001', 'WORKER-SMOKE-PN-002'],
      length: '100 ft',
      date: '2026-05-02T10:00:00Z',
      welderId: 'WORKER-WELDER',
      machineId: 'WORKER-MACHINE'
    }, 'WORKER-SMOKE-SM-001'),
    makeEvent('SAVE_RECORD', 'WEDGE_TEST', {
      testId: 'WORKER-SMOKE-WT-001',
      projectId: TEST_PROJECT_ID,
      welderId: 'WORKER-WELDER',
      machineId: 'WORKER-MACHINE',
      result: 'pass',
      date: '2026-05-02T07:00:00Z'
    }, 'WORKER-SMOKE-WT-001'),
    makeEvent('SAVE_RECORD', 'AIR_TEST', {
      testId: 'WORKER-SMOKE-AT-001',
      projectId: TEST_PROJECT_ID,
      seamId: 'WORKER-SMOKE-SM-001',
      pStart: '30 psi',
      pEnd: '29 psi',
      durationMin: '5 min',
      result: 'pass'
    }, 'WORKER-SMOKE-AT-001'),
    makeEvent('SAVE_RECORD', 'DESTRUCT', {
      testId: 'WORKER-SMOKE-DT-001',
      projectId: TEST_PROJECT_ID,
      seamId: 'WORKER-SMOKE-SM-001',
      peelLB: '70 lb',
      shearLB: '90 lb',
      result: 'pass'
    }, 'WORKER-SMOKE-DT-001')
  ];

  const syncResults = [];
  for (const event of events) {
    syncResults.push(await upsertMirrorRecord(event));
  }
  return syncResults;
}

export async function runFieldAuditorWorkerSmokeTest({ cleanup = true } = {}) {
  await cleanupWorkerSmokeData();
  const syncResults = await seedWorkerSmokeData();
  const messages = [];

  const notify = (type, auditId, payload) => {
    messages.push({ type, auditId, payload });
  };

  const workerResult = await runFieldAuditFromMirror({
    projectId: TEST_PROJECT_ID,
    specs: TEST_SPECS,
    auditId: 'WORKER-SMOKE-AUDIT-001',
    notify
  });

  const projectData = await assembleProjectData(TEST_PROJECT_ID);

  const result = {
    status: 'PASS',
    projectId: TEST_PROJECT_ID,
    synced: syncResults.length,
    workerStatus: workerResult.status,
    auditStatus: workerResult.auditReport?.status,
    exportBlocked: workerResult.auditReport?.exportBlocked,
    flags: workerResult.auditReport?.flags?.length ?? null,
    messages: messages.map((message) => message.type),
    projectName: projectData.projectName,
    panels: projectData.panels.length,
    seams: projectData.seams.length,
    airTests: projectData.tests.air_tests.length,
    wedgeTests: projectData.tests.wedge_tests.length,
    destructs: projectData.tests.destructs.length
  };

  const expectedMessages = ['AUDIT_STARTED', 'AUDIT_PROGRESS', 'AUDIT_COMPLETED'];
  const hasExpectedMessages = expectedMessages.every((type) => result.messages.includes(type));

  if (
    result.workerStatus !== 'SUCCESS'
    || result.auditStatus !== 'PASS'
    || result.exportBlocked !== false
    || result.flags !== 0
    || result.synced !== 8
    || result.panels !== 2
    || result.seams !== 1
    || result.airTests !== 1
    || result.wedgeTests !== 1
    || result.destructs !== 1
    || !hasExpectedMessages
  ) {
    result.status = 'FAIL';
  }

  if (cleanup) await cleanupWorkerSmokeData();

  return result;
}

export default runFieldAuditorWorkerSmokeTest;
