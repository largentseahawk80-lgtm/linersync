import {
  assembleProjectData,
  deleteMirrorRecord,
  openShadowMirror,
  upsertMirrorRecord
} from './shadowMirror.js';

const TEST_PROJECT_ID = 'SMOKE-PROJECT-001';

function makeEvent(eventType, recordType, data, id = '') {
  return {
    eventId: `SMOKE-${recordType}-${id || Date.now()}`,
    eventType,
    recordType,
    priority: 1,
    projectId: TEST_PROJECT_ID,
    payload: {
      id,
      data
    },
    timestamp: new Date().toISOString(),
    origin: 'shadow-mirror-smoke-test'
  };
}

async function cleanupSmokeData() {
  const deletions = [
    ['AIR_TEST', 'SMOKE-AT-001'],
    ['WEDGE_TEST', 'SMOKE-WT-001'],
    ['DESTRUCT', 'SMOKE-DT-001'],
    ['REPAIR', 'SMOKE-RP-001'],
    ['SEAM', 'SMOKE-SM-001'],
    ['PANEL', 'SMOKE-PN-001'],
    ['PANEL', 'SMOKE-PN-002'],
    ['ROLL', 'SMOKE-RL-001'],
    ['PROJECT', TEST_PROJECT_ID]
  ];

  for (const [recordType, id] of deletions) {
    try {
      await deleteMirrorRecord(makeEvent('DELETE_RECORD', recordType, {}, id));
    } catch {
      // Cleanup is best-effort because some records may not exist yet.
    }
  }
}

export async function runShadowMirrorSmokeTest({ cleanup = true } = {}) {
  await openShadowMirror();
  await cleanupSmokeData();

  const events = [
    makeEvent('SAVE_RECORD', 'PROJECT', {
      projectId: TEST_PROJECT_ID,
      name: 'Shadow Mirror Smoke Test',
      status: 'active',
      projectSpecs: {
        airTest: { minDurationMin: 5, allowedDropPSI: 2, allowedDropPercent: null },
        destruct: { frequencyFT: 500, minPeelLB: 60, minShearLB: 80 },
        trialWeld: { validityHours: 12 },
        material: { yieldTolerancePercent: 0.05 },
        exportReadiness: { requireAllTests: true, requirePassOnly: true }
      }
    }, TEST_PROJECT_ID),
    makeEvent('SAVE_RECORD', 'ROLL', {
      rollId: 'SMOKE-RL-001',
      projectId: TEST_PROJECT_ID,
      materialType: 'HDPE',
      status: 'active'
    }, 'SMOKE-RL-001'),
    makeEvent('SAVE_RECORD', 'PANEL', {
      panelId: 'SMOKE-PN-001',
      projectId: TEST_PROJECT_ID,
      rollId: 'SMOKE-RL-001',
      datePlaced: '2026-05-02T08:00:00Z',
      length: '100 ft',
      width: '22.5 ft'
    }, 'SMOKE-PN-001'),
    makeEvent('SAVE_RECORD', 'PANEL', {
      panelId: 'SMOKE-PN-002',
      projectId: TEST_PROJECT_ID,
      rollId: 'SMOKE-RL-001',
      datePlaced: '2026-05-02T08:15:00Z',
      length: '100 ft',
      width: '22.5 ft'
    }, 'SMOKE-PN-002'),
    makeEvent('SAVE_RECORD', 'SEAM', {
      seamId: 'SMOKE-SM-001',
      projectId: TEST_PROJECT_ID,
      parentPanels: ['SMOKE-PN-001', 'SMOKE-PN-002'],
      length: '100 ft',
      date: '2026-05-02T10:00:00Z',
      welderId: 'SMOKE-WELDER',
      machineId: 'SMOKE-MACHINE'
    }, 'SMOKE-SM-001'),
    makeEvent('SAVE_RECORD', 'WEDGE_TEST', {
      testId: 'SMOKE-WT-001',
      projectId: TEST_PROJECT_ID,
      welderId: 'SMOKE-WELDER',
      machineId: 'SMOKE-MACHINE',
      result: 'pass',
      date: '2026-05-02T07:00:00Z'
    }, 'SMOKE-WT-001'),
    makeEvent('SAVE_RECORD', 'AIR_TEST', {
      testId: 'SMOKE-AT-001',
      projectId: TEST_PROJECT_ID,
      seamId: 'SMOKE-SM-001',
      pStart: '30 psi',
      pEnd: '29 psi',
      durationMin: '5 min',
      result: 'pass'
    }, 'SMOKE-AT-001'),
    makeEvent('SAVE_RECORD', 'DESTRUCT', {
      testId: 'SMOKE-DT-001',
      projectId: TEST_PROJECT_ID,
      seamId: 'SMOKE-SM-001',
      peelLB: '70 lb',
      shearLB: '90 lb',
      result: 'pass'
    }, 'SMOKE-DT-001')
  ];

  const syncResults = [];
  for (const event of events) {
    syncResults.push(await upsertMirrorRecord(event));
  }

  const projectData = await assembleProjectData(TEST_PROJECT_ID);

  const result = {
    status: 'PASS',
    projectId: TEST_PROJECT_ID,
    synced: syncResults.length,
    projectName: projectData.projectName,
    panels: projectData.panels.length,
    seams: projectData.seams.length,
    airTests: projectData.tests.air_tests.length,
    wedgeTests: projectData.tests.wedge_tests.length,
    destructs: projectData.tests.destructs.length,
    hasProjectSpecs: Boolean(projectData.projectSpecs),
    normalizedChecks: {
      panelLengthIsNumber: typeof projectData.panels[0]?.length === 'number',
      airStartIsNumber: typeof projectData.tests.air_tests[0]?.pStart === 'number',
      airResultUppercase: projectData.tests.air_tests[0]?.result === 'PASS'
    }
  };

  if (
    result.projectName !== 'Shadow Mirror Smoke Test'
    || result.panels !== 2
    || result.seams !== 1
    || result.airTests !== 1
    || result.wedgeTests !== 1
    || result.destructs !== 1
    || !result.hasProjectSpecs
    || !result.normalizedChecks.panelLengthIsNumber
    || !result.normalizedChecks.airStartIsNumber
    || !result.normalizedChecks.airResultUppercase
  ) {
    result.status = 'FAIL';
  }

  if (cleanup) await cleanupSmokeData();

  return result;
}

export default runShadowMirrorSmokeTest;
