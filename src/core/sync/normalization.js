const DATE_FIELDS = new Set([
  'date',
  'datePlaced',
  'timestamp',
  'capturedAt',
  'createdAt',
  'updatedAt',
  'generatedAt',
  'lastUpdated'
]);

const STATUS_FIELDS = new Set([
  'status',
  'result',
  'testResult',
  'verificationStatus'
]);

const NUMERIC_FIELDS = new Set([
  'length',
  'lengthFT',
  'seamLength',
  'seamLengthFT',
  'width',
  'widthFT',
  'panelWidth',
  'panelWidthFT',
  'panelLength',
  'panelLengthFT',
  'area',
  'areaSF',
  'pStart',
  'pEnd',
  'startPsi',
  'endPsi',
  'startPSI',
  'endPSI',
  'durationMin',
  'holdMinutes',
  'peel',
  'peelLB',
  'shear',
  'shearLB',
  'accuracy',
  'lat',
  'lng'
]);

export const RECORD_TYPE_TO_TABLE = Object.freeze({
  PROJECT: 'projects',
  AUDIT_REPORT: 'audit_reports',
  ROLL: 'rolls',
  PANEL: 'panels',
  INVENTORY: 'inventory',
  SEAM: 'seams',
  WEDGE_TEST: 'wedge_tests',
  AIR_TEST: 'air_tests',
  DESTRUCT: 'destructs',
  REPAIR: 'repairs',
  DAILY_LOG: 'daily_logs',
  WEATHER: 'weather',
  PHOTOS: 'photos',
  GPS_POINTS: 'gps_points',
  ASBUILT_MAP: 'asbuilt_map',
  EXPORT: 'exports'
});

export const RECORD_TYPE_TO_PRIMARY_KEY = Object.freeze({
  PROJECT: 'projectId',
  AUDIT_REPORT: 'id',
  ROLL: 'rollId',
  PANEL: 'panelId',
  INVENTORY: 'id',
  SEAM: 'seamId',
  WEDGE_TEST: 'testId',
  AIR_TEST: 'testId',
  DESTRUCT: 'testId',
  REPAIR: 'repairId',
  DAILY_LOG: 'id',
  WEATHER: 'id',
  PHOTOS: 'id',
  GPS_POINTS: 'id',
  ASBUILT_MAP: 'projectId',
  EXPORT: 'id'
});

export const PRIORITY_BY_RECORD_TYPE = Object.freeze({
  REPAIR: 1,
  AIR_TEST: 1,
  DESTRUCT: 1,
  WEDGE_TEST: 1,
  SEAM: 1,
  PANEL: 2,
  ROLL: 2,
  INVENTORY: 2,
  DAILY_LOG: 2,
  WEATHER: 2,
  PHOTOS: 3,
  GPS_POINTS: 3,
  ASBUILT_MAP: 3,
  EXPORT: 3,
  AUDIT_REPORT: 3,
  PROJECT: 2
});

export function normalizeRecordType(recordType) {
  return String(recordType || '').trim().toUpperCase().replaceAll(' ', '_');
}

export function getTableForRecordType(recordType) {
  return RECORD_TYPE_TO_TABLE[normalizeRecordType(recordType)] || null;
}

export function getPrimaryKeyForRecordType(recordType) {
  return RECORD_TYPE_TO_PRIMARY_KEY[normalizeRecordType(recordType)] || 'id';
}

export function getPriorityForRecordType(recordType) {
  const normalizedType = normalizeRecordType(recordType);
  return PRIORITY_BY_RECORD_TYPE[normalizedType] || 3;
}

export function parseNumberWithUnits(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return value;

  const cleaned = value.trim().replace(/,/g, '').replace(/[^0-9.+-]/g, '');
  if (!cleaned) return null;

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

export function toIsoDate(value) {
  if (value === null || value === undefined || value === '') return value;
  const parsed = new Date(value);
  const time = parsed.getTime();
  return Number.isFinite(time) ? parsed.toISOString() : value;
}

export function normalizeStatus(value) {
  return typeof value === 'string' ? value.trim().toUpperCase() : value;
}

export function normalizeRecord(data = {}, recordType = '', projectId = '') {
  const normalizedType = normalizeRecordType(recordType);
  const normalized = { ...data };

  if (projectId && !normalized.projectId) normalized.projectId = projectId;

  Object.keys(normalized).forEach((key) => {
    const value = normalized[key];

    if (value === '') {
      normalized[key] = null;
      return;
    }

    if (DATE_FIELDS.has(key)) {
      normalized[key] = toIsoDate(value);
      return;
    }

    if (STATUS_FIELDS.has(key)) {
      normalized[key] = normalizeStatus(value);
      return;
    }

    if (NUMERIC_FIELDS.has(key)) {
      normalized[key] = parseNumberWithUnits(value);
    }
  });

  if (normalizedType && !normalized.recordType) normalized.recordType = normalizedType;

  return normalized;
}

export function validateRecordType(recordType) {
  const normalizedType = normalizeRecordType(recordType);
  if (!RECORD_TYPE_TO_TABLE[normalizedType]) {
    throw new Error(`UNKNOWN_RECORD_TYPE: ${recordType}`);
  }
  return normalizedType;
}

export function validateSyncEvent(event, { requirePayload = true, isDelete = false } = {}) {
  if (!event || typeof event !== 'object') throw new Error('MALFORMED_SYNC_EVENT');
  if (!event.eventType) throw new Error('MALFORMED_SYNC_EVENT: eventType missing');
  if (!event.recordType) throw new Error('MALFORMED_SYNC_EVENT: recordType missing');
  if (requirePayload && !event.payload) throw new Error('MALFORMED_SYNC_EVENT: payload missing');

  const normalizedType = validateRecordType(event.recordType);
  const pkField = getPrimaryKeyForRecordType(normalizedType);

  if (isDelete && !event.payload?.id && !event.payload?.[pkField]) {
    throw new Error('DELETE_REQUIRES_ID');
  }

  return {
    normalizedType,
    tableName: getTableForRecordType(normalizedType),
    primaryKey: pkField,
    priority: getPriorityForRecordType(normalizedType)
  };
}

export default normalizeRecord;
