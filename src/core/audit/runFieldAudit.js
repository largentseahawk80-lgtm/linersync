export const DEFAULT_PROJECT_SPECS = {
  airTest: {
    minDurationMin: null,
    allowedDropPSI: null,
    allowedDropPercent: null
  },
  destruct: {
    frequencyFT: null,
    minPeelLB: null,
    minShearLB: null
  },
  trialWeld: {
    minPeelLB: null,
    minShearLB: null,
    validityHours: null
  },
  weather: {
    minTempF: null,
    maxTempF: null
  },
  material: {
    yieldTolerancePercent: 0.05
  },
  exportReadiness: {
    requireAllTests: true,
    requirePassOnly: true
  }
};

const isSet = (value) => value !== null && value !== undefined && value !== '';
const asNumber = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/[^0-9.+-]/g, '');
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};
const asDateMs = (value) => {
  if (!isSet(value)) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
};
const upper = (value) => String(value || '').trim().toUpperCase();
const recordId = (record, fields, fallback = 'UNKNOWN') => {
  for (const field of fields) {
    if (isSet(record?.[field])) return String(record[field]);
  }
  return fallback;
};

function mergeSpecs(projectSpecs = {}) {
  return {
    airTest: { ...DEFAULT_PROJECT_SPECS.airTest, ...(projectSpecs.airTest || {}) },
    destruct: { ...DEFAULT_PROJECT_SPECS.destruct, ...(projectSpecs.destruct || {}) },
    trialWeld: { ...DEFAULT_PROJECT_SPECS.trialWeld, ...(projectSpecs.trialWeld || {}) },
    weather: { ...DEFAULT_PROJECT_SPECS.weather, ...(projectSpecs.weather || {}) },
    material: { ...DEFAULT_PROJECT_SPECS.material, ...(projectSpecs.material || {}) },
    exportReadiness: { ...DEFAULT_PROJECT_SPECS.exportReadiness, ...(projectSpecs.exportReadiness || {}) }
  };
}

function makeReport(projectData = {}) {
  return {
    status: 'PASS',
    projectName: projectData.projectName || projectData.name || 'Unknown Project',
    generatedAt: new Date().toISOString(),
    summary: {
      totalPanels: Array.isArray(projectData.panels) ? projectData.panels.length : 0,
      totalSeams: Array.isArray(projectData.seams) ? projectData.seams.length : 0,
      criticalCount: 0,
      warningCount: 0,
      unresolvedRepairs: 0
    },
    flags: [],
    exportBlocked: false
  };
}

function addFlag(report, severity, code, recordType, recordIdValue, message, fixSuggestion, relatedRecords = [], specField = null) {
  const safeRecordType = String(recordType || 'PROJECT').toUpperCase();
  const safeRecordId = String(recordIdValue || 'GLOBAL');
  const id = `${String(severity).toUpperCase()}-${String(code).toUpperCase()}-${safeRecordType}-${safeRecordId}-${specField || 'NA'}`;

  if (report.flags.some((flag) => flag.id === id)) return;

  report.flags.push({
    id,
    severity,
    code,
    recordType: safeRecordType,
    recordId: safeRecordId,
    message,
    fixSuggestion,
    relatedRecords: relatedRecords.map(String),
    specField
  });

  if (severity === 'CRITICAL') report.summary.criticalCount += 1;
  if (severity === 'WARNING') report.summary.warningCount += 1;
  if (code === 'UNRESOLVED_REPAIR') report.summary.unresolvedRepairs += 1;
}

function getParentPanels(seam = {}) {
  if (Array.isArray(seam.parentPanels)) return seam.parentPanels.filter(isSet).map(String);
  const first = seam.p1 ?? seam.panelA ?? seam.parentPanelA ?? seam.panel1;
  const second = seam.p2 ?? seam.panelB ?? seam.parentPanelB ?? seam.panel2;
  return [first, second].filter(isSet).map(String);
}

function getSeamId(seam) {
  return recordId(seam, ['seamId', 'id', 'seam'], 'UNKNOWN_SEAM');
}

function getPanelId(panel) {
  return recordId(panel, ['panelId', 'id', 'panel'], 'UNKNOWN_PANEL');
}

function getTestId(test, fallback) {
  return recordId(test, ['testId', 'id', 'dtNumber'], fallback);
}

function getRepairStatus(repair) {
  return upper(repair?.status ?? repair?.result ?? repair?.verificationStatus);
}

function hasClosedPassRepair(repairs, failureId) {
  return repairs.some((repair) => {
    const related = repair.relatedRecordId ?? repair.failureId ?? repair.testId ?? repair.linkedTestId;
    return String(related || '') === String(failureId) && getRepairStatus(repair) === 'CLOSED-PASS';
  });
}

function getTestResult(test) {
  return upper(test?.result ?? test?.status ?? test?.testResult);
}

function findAirTestForSeam(airTests, seamId) {
  return airTests.find((test) => String(test.seamId ?? test.seam ?? '') === String(seamId));
}

function findPassingWedge(wedgeTests, seam, seamDateMs, validityHours) {
  const welderId = seam.welderId ?? seam.welder ?? seam.operator;
  const machineId = seam.machineId ?? seam.machine;
  if (!isSet(welderId) || !isSet(machineId) || !Number.isFinite(seamDateMs)) return null;

  const validityMs = Number(validityHours) * 60 * 60 * 1000;
  return wedgeTests.find((test) => {
    const testWelder = test.welderId ?? test.welder ?? test.operator;
    const testMachine = test.machineId ?? test.machine;
    const testDateMs = asDateMs(test.date ?? test.timestamp ?? test.capturedAt);
    return String(testWelder || '') === String(welderId)
      && String(testMachine || '') === String(machineId)
      && getTestResult(test) === 'PASS'
      && Number.isFinite(testDateMs)
      && testDateMs <= seamDateMs
      && (seamDateMs - testDateMs) <= validityMs;
  });
}

function getAirPressureValues(test) {
  return {
    pStart: asNumber(test.pStart ?? test.startPsi ?? test.startPSI),
    pEnd: asNumber(test.pEnd ?? test.endPsi ?? test.endPSI),
    durationMin: asNumber(test.durationMin ?? test.holdMinutes ?? test.duration)
  };
}

function getDestructStrengthValues(test) {
  return {
    peelLB: asNumber(test.peelLB ?? test.peel ?? test.peelStrength),
    shearLB: asNumber(test.shearLB ?? test.shear ?? test.shearStrength)
  };
}

function getSeamLength(seam) {
  return asNumber(seam.length ?? seam.seamLength ?? seam.lengthFT ?? seam.footage) || 0;
}

function checkSeamIntegrity(report, panelsById, seam) {
  const seamId = getSeamId(seam);
  const parents = getParentPanels(seam);

  if (parents.length !== 2) {
    addFlag(
      report,
      'CRITICAL',
      'GEOMETRY_ERROR',
      'SEAM',
      seamId,
      `Seam ${seamId} must reference exactly two parent panels.`,
      'Update the seam record so it links to both parent panels.',
      [seamId]
    );
    return;
  }

  const seamDateMs = asDateMs(seam.date ?? seam.timestamp ?? seam.capturedAt);
  parents.forEach((parentId) => {
    const parent = panelsById.get(String(parentId));
    if (!parent) {
      addFlag(
        report,
        'CRITICAL',
        'MISSING_RECORD',
        'PANEL',
        parentId,
        `Seam ${seamId} references missing panel ${parentId}.`,
        'Create the missing panel record or correct the seam parent panel ID.',
        [seamId, parentId]
      );
      return;
    }

    const panelDateMs = asDateMs(parent.datePlaced ?? parent.date ?? parent.timestamp ?? parent.capturedAt);
    if (Number.isFinite(panelDateMs) && Number.isFinite(seamDateMs) && seamDateMs < panelDateMs) {
      addFlag(
        report,
        'CRITICAL',
        'LOGIC_ERROR',
        'SEAM',
        seamId,
        `Seam ${seamId} is dated before parent panel ${parentId} was placed.`,
        'Verify panel placement and seam timestamps.',
        [seamId, parentId]
      );
    }
  });
}

function checkTrialWeld(report, seam, wedgeTests, specs) {
  const seamId = getSeamId(seam);
  const validityHours = specs.trialWeld.validityHours;

  if (!isSet(validityHours)) {
    addFlag(
      report,
      'WARNING',
      'SPEC_NOT_SET',
      'PROJECT',
      'TRIAL_WELD_VALIDITY',
      'Trial weld validity window is not set.',
      'Set projectSpecs.trialWeld.validityHours before final audit.',
      [seamId],
      'trialWeld.validityHours'
    );
    return;
  }

  const seamDateMs = asDateMs(seam.date ?? seam.timestamp ?? seam.capturedAt);
  const authWedge = findPassingWedge(wedgeTests, seam, seamDateMs, validityHours);
  if (!authWedge) {
    const welder = seam.welderId ?? seam.welder ?? 'UNKNOWN_WELDER';
    const machine = seam.machineId ?? seam.machine ?? 'UNKNOWN_MACHINE';
    addFlag(
      report,
      'CRITICAL',
      'UNAUTHORIZED_WELD',
      'SEAM',
      seamId,
      `No passing wedge/trial weld found for welder ${welder} on machine ${machine} within the project validity window.`,
      'Log a passing trial weld or correct welder/machine/time data.',
      [seamId]
    );
  }
}

function checkAirTest(report, seam, airTests, repairs, specs) {
  const seamId = getSeamId(seam);
  const airTest = findAirTestForSeam(airTests, seamId);

  if (!airTest) {
    addFlag(
      report,
      'CRITICAL',
      'MISSING_RECORD',
      'AIR_TEST',
      seamId,
      `Seam ${seamId} has no air test record.`,
      'Perform and log the required air test.',
      [seamId]
    );
    return;
  }

  const testId = getTestId(airTest, `AIR-${seamId}`);
  const { pStart, pEnd, durationMin } = getAirPressureValues(airTest);

  if (!isSet(specs.airTest.minDurationMin)) {
    addFlag(
      report,
      'WARNING',
      'SPEC_NOT_SET',
      'PROJECT',
      'AIR_TEST_DURATION',
      'Air test minimum duration spec is not set.',
      'Set projectSpecs.airTest.minDurationMin before final audit.',
      [testId],
      'airTest.minDurationMin'
    );
  } else if (durationMin === null || durationMin < Number(specs.airTest.minDurationMin)) {
    addFlag(
      report,
      'CRITICAL',
      'TEST_FAILURE',
      'AIR_TEST',
      testId,
      `Air test ${testId} duration is below the project minimum.`,
      'Re-test for the full required duration.',
      [seamId, testId]
    );
  }

  let dropFailed = false;
  if (isSet(specs.airTest.allowedDropPSI)) {
    if (pStart === null || pEnd === null || pStart <= 0 || (pStart - pEnd) > Number(specs.airTest.allowedDropPSI)) {
      dropFailed = true;
    }
  } else if (isSet(specs.airTest.allowedDropPercent)) {
    if (pStart === null || pEnd === null || pStart <= 0 || ((pStart - pEnd) / pStart) > Number(specs.airTest.allowedDropPercent)) {
      dropFailed = true;
    }
  } else {
    addFlag(
      report,
      'WARNING',
      'SPEC_NOT_SET',
      'PROJECT',
      'AIR_TEST_DROP',
      'Air test pressure drop tolerance is not set.',
      'Set projectSpecs.airTest.allowedDropPSI or allowedDropPercent before final audit.',
      [testId],
      'airTest.allowedDropPSI'
    );
  }

  if (dropFailed) {
    addFlag(
      report,
      'CRITICAL',
      'TEST_FAILURE',
      'AIR_TEST',
      testId,
      `Air test ${testId} failed pressure drop requirements.`,
      'Repair the seam segment and re-test.',
      [seamId, testId]
    );

    if (!hasClosedPassRepair(repairs, testId)) {
      addFlag(
        report,
        'CRITICAL',
        'UNRESOLVED_REPAIR',
        'AIR_TEST',
        testId,
        `Failed air test ${testId} has no linked CLOSED-PASS repair.`,
        'Log a repair linked to this failed air test and close it with a passing verification.',
        [seamId, testId]
      );
    }
  }
}

function checkDestructs(report, seams, destructs, repairs, specs) {
  const totalFootage = seams.reduce((sum, seam) => sum + getSeamLength(seam), 0);

  if (!isSet(specs.destruct.frequencyFT)) {
    addFlag(
      report,
      'WARNING',
      'SPEC_NOT_SET',
      'PROJECT',
      'DESTRUCT_FREQUENCY',
      'Destructive test frequency spec is not set.',
      'Set projectSpecs.destruct.frequencyFT before final audit.',
      [],
      'destruct.frequencyFT'
    );
  } else if (totalFootage > 0 && destructs.length === 0) {
    addFlag(
      report,
      'CRITICAL',
      'MISSING_RECORD',
      'DESTRUCT',
      'GLOBAL',
      'No destructive tests are recorded for existing seam footage.',
      'Take and log destructive samples per project frequency.',
      []
    );
  } else if (totalFootage > 0 && destructs.length > 0) {
    const currentFrequency = totalFootage / destructs.length;
    if (currentFrequency > Number(specs.destruct.frequencyFT)) {
      addFlag(
        report,
        'WARNING',
        'FREQUENCY_GAP',
        'DESTRUCT',
        'GLOBAL',
        `Destructive test interval is ${Math.round(currentFrequency)} ft, exceeding the ${specs.destruct.frequencyFT} ft spec.`,
        'Take additional destructive samples to close the frequency gap.',
        []
      );
    }
  }

  destructs.forEach((destruct) => {
    const testId = getTestId(destruct, 'DESTRUCT-UNKNOWN');
    const { peelLB, shearLB } = getDestructStrengthValues(destruct);

    if (!isSet(specs.destruct.minPeelLB) || !isSet(specs.destruct.minShearLB)) {
      addFlag(
        report,
        'WARNING',
        'SPEC_NOT_SET',
        'PROJECT',
        `DESTRUCT_STRENGTH-${testId}`,
        'Destructive peel/shear strength specs are not set.',
        'Set projectSpecs.destruct.minPeelLB and minShearLB before final audit.',
        [testId],
        !isSet(specs.destruct.minPeelLB) ? 'destruct.minPeelLB' : 'destruct.minShearLB'
      );
      return;
    }

    const failed = peelLB === null
      || shearLB === null
      || peelLB < Number(specs.destruct.minPeelLB)
      || shearLB < Number(specs.destruct.minShearLB)
      || getTestResult(destruct) === 'FAIL';

    if (failed) {
      addFlag(
        report,
        'CRITICAL',
        'TEST_FAILURE',
        'DESTRUCT',
        testId,
        `Destructive test ${testId} failed peel/shear requirements.`,
        'Perform required tracking samples, repairs, and passing verification.',
        [testId, destruct.seamId ?? destruct.seam ?? '']
      );

      if (!hasClosedPassRepair(repairs, testId)) {
        addFlag(
          report,
          'CRITICAL',
          'UNRESOLVED_REPAIR',
          'DESTRUCT',
          testId,
          `Failed destructive test ${testId} has no linked CLOSED-PASS repair.`,
          'Log a repair linked to this failed destruct and close it with passing verification.',
          [testId]
        );
      }
    }
  });
}

export function runFieldAudit(projectData = {}, projectSpecs = {}) {
  const report = makeReport(projectData);
  const specs = mergeSpecs(projectSpecs);

  const panels = Array.isArray(projectData.panels) ? projectData.panels : [];
  const seams = Array.isArray(projectData.seams) ? projectData.seams : [];
  const repairs = Array.isArray(projectData.repairs) ? projectData.repairs : [];
  const tests = projectData.tests || {};
  const airTests = Array.isArray(tests.air_tests) ? tests.air_tests : [];
  const wedgeTests = Array.isArray(tests.wedge_tests) ? tests.wedge_tests : [];
  const destructs = Array.isArray(tests.destructs) ? tests.destructs : [];

  const panelsById = new Map(panels.map((panel) => [String(getPanelId(panel)), panel]));

  seams.forEach((seam) => {
    checkSeamIntegrity(report, panelsById, seam);
    checkTrialWeld(report, seam, wedgeTests, specs);
    checkAirTest(report, seam, airTests, repairs, specs);
  });

  checkDestructs(report, seams, destructs, repairs, specs);

  if (report.summary.criticalCount > 0) {
    report.status = 'CRITICAL';
    report.exportBlocked = true;
  } else if (report.summary.warningCount > 0) {
    report.status = 'WARNING';
    report.exportBlocked = false;
  } else {
    report.status = 'PASS';
    report.exportBlocked = false;
  }

  return report;
}

export default runFieldAudit;
