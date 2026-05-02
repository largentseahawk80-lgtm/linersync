import { normalizeRecordType } from './normalization.js';

const APP_TYPE_TO_MIRROR_TYPE = Object.freeze({
  Repair: 'REPAIR',
  Seam: 'SEAM',
  Panel: 'PANEL',
  Roll: 'ROLL',
  'Wedge Test': 'WEDGE_TEST',
  'Air Test': 'AIR_TEST',
  DT: 'DESTRUCT',
  Daily: 'DAILY_LOG'
});

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

function baseRecord(log = {}, fields = {}) {
  return {
    id: log.id,
    sourceLogId: log.id,
    projectId: log.projectId,
    status: log.status,
    capturedAt: log.capturedAt,
    timestamp: log.capturedAt,
    notes: log.notes || '',
    overrideReason: log.overrideReason || '',
    verifiedBy: firstValue(fields.verifiedBy, log.verifiedBy),
    gps: log.gps || null,
    activeContext: log.activeContext || log.constants || null
  };
}

function mapRecordData(log = {}) {
  const fields = log.fields || {};
  const base = baseRecord(log, fields);

  switch (log.type) {
    case 'Repair':
      return {
        ...base,
        repairId: firstValue(fields.repairId, log.title, log.id),
        repairType: fields.repairType || '',
        relatedRecordId: firstValue(fields.seam, fields.panel, log.activeContext?.activeSeam, log.activeContext?.activePanel),
        result: log.status
      };

    case 'Seam':
      return {
        ...base,
        seamId: firstValue(fields.seam, log.title, log.id),
        parentPanels: [fields.panelA, fields.panelB].filter(Boolean),
        p1: fields.panelA || '',
        p2: fields.panelB || '',
        welderId: fields.welder || '',
        date: log.capturedAt
      };

    case 'Panel':
      return {
        ...base,
        panelId: firstValue(fields.panel, log.title, log.id),
        rollId: fields.roll || '',
        datePlaced: log.capturedAt
      };

    case 'Roll':
      return {
        ...base,
        rollId: firstValue(fields.roll, log.title, log.id),
        manufacturer: fields.manufacturer || '',
        lot: fields.lot || '',
        certStatus: fields.certStatus || ''
      };

    case 'Wedge Test':
      return {
        ...base,
        testId: firstValue(log.id, log.title),
        seamId: fields.seam || '',
        machineId: fields.machine || '',
        peelLB: fields.peel,
        shearLB: fields.shear,
        result: fields.result || log.status,
        date: log.capturedAt
      };

    case 'Air Test':
      return {
        ...base,
        testId: firstValue(log.id, log.title),
        seamId: fields.seam || '',
        pStart: firstValue(fields.startPsi, fields.pStart),
        pEnd: firstValue(fields.endPsi, fields.pEnd),
        durationMin: firstValue(fields.holdMinutes, fields.durationMin),
        result: fields.result || log.status
      };

    case 'DT':
      return {
        ...base,
        testId: firstValue(fields.dtNumber, log.title, log.id),
        dtNumber: firstValue(fields.dtNumber, log.title),
        seamId: fields.seam || '',
        result: fields.result || log.status
      };

    case 'Daily':
      return {
        ...base,
        crew: fields.crew || '',
        weather: fields.weather || '',
        date: log.capturedAt
      };

    default:
      return null;
  }
}

export function getMirrorRecordTypeForLog(logOrType) {
  const type = typeof logOrType === 'string' ? logOrType : logOrType?.type;
  return APP_TYPE_TO_MIRROR_TYPE[type] || null;
}

export function makeMirrorEventFromLog(log, eventType = 'SAVE_RECORD') {
  const recordType = getMirrorRecordTypeForLog(log);
  if (!recordType) {
    return {
      status: 'SKIPPED',
      reason: `UNSUPPORTED_LOG_TYPE: ${log?.type || 'undefined'}`
    };
  }

  const data = mapRecordData(log);
  if (!data) {
    return {
      status: 'SKIPPED',
      reason: `MAPPING_FAILED: ${log?.type || 'undefined'}`
    };
  }

  const normalizedType = normalizeRecordType(recordType);

  return {
    status: 'READY',
    event: {
      eventId: `APP-${eventType}-${normalizedType}-${log.id}`,
      eventType,
      recordType: normalizedType,
      projectId: log.projectId,
      payload: {
        id: data.repairId || data.seamId || data.panelId || data.rollId || data.testId || data.id,
        data
      },
      timestamp: new Date().toISOString(),
      origin: 'linersync-app-log-adapter'
    }
  };
}

export default makeMirrorEventFromLog;
