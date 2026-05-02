import {
  getPrimaryKeyForRecordType,
  getTableForRecordType,
  normalizeRecord,
  validateSyncEvent
} from './normalization.js';

export const SHADOW_MIRROR_DB_NAME = 'LINERSYNC_ShadowMirror';
export const SHADOW_MIRROR_DB_VERSION = 1;

export const SHADOW_MIRROR_TABLES = Object.freeze({
  projects: { keyPath: 'projectId', indexes: ['name', 'status'] },
  audit_reports: { keyPath: 'id', autoIncrement: true, indexes: ['projectId', 'status', 'generatedAt'] },
  rolls: { keyPath: 'rollId', indexes: ['projectId', 'materialType'] },
  panels: { keyPath: 'panelId', indexes: ['projectId', 'rollId', 'datePlaced'] },
  inventory: { keyPath: 'id', autoIncrement: true, indexes: ['projectId', 'rollId', 'status'] },
  seams: { keyPath: 'seamId', indexes: ['projectId', 'p1', 'p2', 'welderId'] },
  wedge_tests: { keyPath: 'testId', indexes: ['projectId', 'welderId', 'machineId', 'date'] },
  air_tests: { keyPath: 'testId', indexes: ['projectId', 'seamId', 'result'] },
  destructs: { keyPath: 'testId', indexes: ['projectId', 'seamId', 'result'] },
  repairs: { keyPath: 'repairId', indexes: ['projectId', 'relatedRecordId', 'status'] },
  daily_logs: { keyPath: 'id', autoIncrement: true, indexes: ['projectId', 'date'] },
  weather: { keyPath: 'id', autoIncrement: true, indexes: ['projectId', 'timestamp'] },
  photos: { keyPath: 'id', autoIncrement: true, indexes: ['projectId', 'recordId'] },
  gps_points: { keyPath: 'id', autoIncrement: true, indexes: ['projectId', 'recordId'] },
  asbuilt_map: { keyPath: 'projectId', indexes: ['lastUpdated'] },
  exports: { keyPath: 'id', autoIncrement: true, indexes: ['projectId', 'timestamp'] }
});

let openPromise = null;

function assertIndexedDbAvailable() {
  if (typeof indexedDB === 'undefined') {
    throw new Error('INDEXEDDB_UNAVAILABLE');
  }
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('INDEXEDDB_REQUEST_FAILED'));
  });
}

function transactionComplete(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve(true);
    transaction.onerror = () => reject(transaction.error || new Error('INDEXEDDB_TRANSACTION_FAILED'));
    transaction.onabort = () => reject(transaction.error || new Error('INDEXEDDB_TRANSACTION_ABORTED'));
  });
}

function ensureStore(db, tableName, tableConfig) {
  const store = db.objectStoreNames.contains(tableName)
    ? null
    : db.createObjectStore(tableName, {
        keyPath: tableConfig.keyPath,
        autoIncrement: Boolean(tableConfig.autoIncrement)
      });

  if (!store) return;

  tableConfig.indexes.forEach((indexName) => {
    if (!store.indexNames.contains(indexName)) {
      store.createIndex(indexName, indexName, { unique: false });
    }
  });
}

export function openShadowMirror() {
  assertIndexedDbAvailable();

  if (openPromise) return openPromise;

  openPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(SHADOW_MIRROR_DB_NAME, SHADOW_MIRROR_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      Object.entries(SHADOW_MIRROR_TABLES).forEach(([tableName, tableConfig]) => {
        ensureStore(db, tableName, tableConfig);
      });
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('SHADOW_MIRROR_OPEN_FAILED'));
    request.onblocked = () => reject(new Error('SHADOW_MIRROR_OPEN_BLOCKED'));
  });

  return openPromise;
}

async function getStore(tableName, mode = 'readonly') {
  const db = await openShadowMirror();
  const tx = db.transaction(tableName, mode);
  return { store: tx.objectStore(tableName), tx };
}

export async function upsertMirrorRecord(syncEvent) {
  const { normalizedType, tableName, primaryKey } = validateSyncEvent(syncEvent);
  const projectId = syncEvent.projectId || syncEvent.payload?.projectId || syncEvent.payload?.data?.projectId || '';
  const rawData = syncEvent.payload?.data || syncEvent.payload || {};
  const record = normalizeRecord(rawData, normalizedType, projectId);

  if (!record[primaryKey] && syncEvent.payload?.id) {
    record[primaryKey] = syncEvent.payload.id;
  }

  if (!record[primaryKey] && !SHADOW_MIRROR_TABLES[tableName]?.autoIncrement) {
    throw new Error(`MISSING_PRIMARY_KEY: ${primaryKey}`);
  }

  const { store, tx } = await getStore(tableName, 'readwrite');
  const key = await requestToPromise(store.put(record));
  await transactionComplete(tx);

  return {
    status: 'SYNCED',
    recordType: normalizedType,
    tableName,
    id: record[primaryKey] || key
  };
}

export async function deleteMirrorRecord(syncEvent) {
  const { normalizedType, tableName, primaryKey } = validateSyncEvent(syncEvent, { isDelete: true });
  const id = syncEvent.payload?.id || syncEvent.payload?.[primaryKey];
  const { store, tx } = await getStore(tableName, 'readwrite');

  await requestToPromise(store.delete(id));
  await transactionComplete(tx);

  return {
    status: 'DELETED',
    recordType: normalizedType,
    tableName,
    id
  };
}

export async function readMirrorTable(tableName, projectId = '') {
  if (!SHADOW_MIRROR_TABLES[tableName]) throw new Error(`UNKNOWN_TABLE: ${tableName}`);

  const { store } = await getStore(tableName, 'readonly');

  if (!projectId) {
    return requestToPromise(store.getAll());
  }

  if (!store.indexNames.contains('projectId')) {
    const all = await requestToPromise(store.getAll());
    return all.filter((record) => String(record.projectId || '') === String(projectId));
  }

  return requestToPromise(store.index('projectId').getAll(projectId));
}

export async function assembleProjectData(projectId) {
  if (!projectId) throw new Error('PROJECT_ID_NOT_SET');

  const [projects, panels, seams, repairs, airTests, wedgeTests, destructs, inventory, rolls] = await Promise.all([
    readMirrorTable('projects', projectId),
    readMirrorTable('panels', projectId),
    readMirrorTable('seams', projectId),
    readMirrorTable('repairs', projectId),
    readMirrorTable('air_tests', projectId),
    readMirrorTable('wedge_tests', projectId),
    readMirrorTable('destructs', projectId),
    readMirrorTable('inventory', projectId),
    readMirrorTable('rolls', projectId)
  ]);

  const project = projects[0] || { projectId, projectName: 'Unknown Project' };

  return {
    projectId,
    projectName: project.projectName || project.name || 'Unknown Project',
    panels,
    seams,
    repairs,
    inventory,
    rolls,
    tests: {
      air_tests: airTests,
      wedge_tests: wedgeTests,
      destructs
    },
    projectSpecs: project.projectSpecs || null
  };
}

export const shadowMirrorAPI = Object.freeze({
  open: openShadowMirror,
  upsertRecord: upsertMirrorRecord,
  deleteRecord: deleteMirrorRecord,
  readTable: readMirrorTable,
  assembleProjectData
});

export default shadowMirrorAPI;
