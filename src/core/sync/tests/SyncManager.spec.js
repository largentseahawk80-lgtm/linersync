import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SyncManager } from '../SyncManager.js';

describe('SyncManager Phase 6.3 Hardened Validation', () => {
  let db;
  let syncTasksTable;
  let auditSnapshotsTable;
  let mockNotify;
  let mockWorker;
  let manager;

  beforeEach(() => {
    vi.useFakeTimers();

    syncTasksTable = {
      put: vi.fn().mockResolvedValue(true),
      update: vi.fn().mockResolvedValue(true),
      delete: vi.fn().mockResolvedValue(true)
    };

    auditSnapshotsTable = {
      add: vi.fn().mockResolvedValue(true)
    };

    const tables = {
      sync_tasks: syncTasksTable,
      audit_snapshots: auditSnapshotsTable
    };

    db = {
      table: vi.fn((name) => tables[name])
    };

    mockNotify = vi.fn();
    mockWorker = vi.fn();

    manager = new SyncManager({
      db,
      runAuditWorker: mockWorker,
      notify: mockNotify
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('S-01: duplicate active sync returns LOCKED and does not run worker twice', async () => {
    const projectId = 'PRJ-01';
    manager.activeLocks.add(projectId);

    const result = await manager.triggerSync(projectId);

    expect(result.status).toBe('LOCKED');
    expect(mockWorker).not.toHaveBeenCalled();
    expect(mockNotify).not.toHaveBeenCalledWith('SYNC_STARTED', expect.anything());
  });

  it('S-02: AUDIT_COMPLETE maps to SYNC_AUDIT_COMPLETE and includes projectId', async () => {
    const projectId = 'PRJ-02';
    mockWorker.mockImplementation(async (id, { notify }) => {
      notify('AUDIT_COMPLETE', { score: 100 });
      return {
        status: 'SUCCESS',
        projectData: { projectName: 'Test' },
        auditResults: { score: 100 }
      };
    });

    await manager.triggerSync(projectId);

    expect(mockNotify).toHaveBeenCalledWith(
      'SYNC_AUDIT_COMPLETE',
      expect.objectContaining({
        projectId,
        score: 100
      })
    );
  });

  it('S-03: failed worker retries up to 3 times total and releases lock after failure', async () => {
    const projectId = 'PRJ-03';
    mockWorker.mockResolvedValue({ status: 'AUDIT_ERROR', error: 'Fail' });

    await manager.triggerSync(projectId);
    await vi.runAllTimersAsync();

    expect(mockWorker).toHaveBeenCalledTimes(3);
    expect(manager.activeLocks.has(projectId)).toBe(false);
  });

  it('S-04: successful sync writes audit_snapshots and deletes sync_tasks', async () => {
    const projectId = 'PRJ-04';
    mockWorker.mockResolvedValue({
      status: 'SUCCESS',
      projectData: { projectName: 'Persist' },
      auditResults: { ok: true }
    });

    await manager.triggerSync(projectId);

    expect(auditSnapshotsTable.add).toHaveBeenCalled();
    expect(syncTasksTable.delete).toHaveBeenCalledWith(projectId);
  });

  it('S-05: timeout emits SYNC_ERROR with WORKER_TIMEOUT_EXCEEDED and notification payload', async () => {
    const projectId = 'PRJ-05';
    mockWorker.mockImplementation(() => new Promise(() => {}));

    const syncPromise = manager.triggerSync(projectId);

    await vi.advanceTimersByTimeAsync(31000);

    const result = await syncPromise;

    expect(result.status).toBe('ERROR');
    expect(result.error).toBe('WORKER_TIMEOUT_EXCEEDED');
    expect(mockNotify).toHaveBeenCalledWith(
      'SYNC_ERROR',
      expect.objectContaining({
        projectId,
        error: 'WORKER_TIMEOUT_EXCEEDED'
      })
    );
    expect(mockWorker).toHaveBeenCalledTimes(1);
  });
});
