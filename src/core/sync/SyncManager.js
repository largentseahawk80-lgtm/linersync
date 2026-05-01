/**
 * Phase 6.2 — SyncManager (Isolated Orchestrator)
 * Refined concurrency handling, payload normalization, and exponential backoff.
 */
export class SyncManager {
  constructor({ db, runAuditWorker, notify }) {
    this.db = db;
    this.runAuditWorker = runAuditWorker;
    this.notify = notify;
    this.activeLocks = new Set();
    this.MAX_RETRIES = 3;
    this.WORKER_TIMEOUT_MS = 30000;
  }

  /**
   * Safe data cloning with structuredClone fallback.
   */
  #cloneData(data) {
    try {
      return structuredClone(data);
    } catch (e) {
      return JSON.parse(JSON.stringify(data));
    }
  }

  /**
   * Normalizes payloads (null, string, object) to ensure safe notification emission.
   */
  #bridgeWorkerEvents(type, payload, projectId) {
    const eventMap = {
      AUDIT_STARTED: 'SYNC_AUDIT_STARTED',
      AUDIT_PROGRESS: 'SYNC_PROGRESS',
      AUDIT_COMPLETE: 'SYNC_AUDIT_COMPLETE',
      AUDIT_ERROR: 'SYNC_ERROR'
    };

    const mappedEvent = eventMap[type];
    if (!mappedEvent) return;

    const normalizedPayload =
      payload !== null && typeof payload === 'object'
        ? payload
        : { detail: payload };

    this.notify(mappedEvent, { projectId, ...normalizedPayload });
  }

  /**
   * Orchestrates the sync lifecycle.
   *
   * NOTE: The Promise.race timeout guard stops the Manager from waiting,
   * but it does NOT cancel the underlying Worker execution (JS Promises are not cancellable).
   */
  async triggerSync(projectId, attempt = 1) {
    if (this.activeLocks.has(projectId)) {
      return {
        status: 'LOCKED',
        projectId,
        message: 'A sync operation is already active for this project.'
      };
    }

    let syncFailed = false;
    let errorReason = null;

    try {
      this.activeLocks.add(projectId);
      this.notify('SYNC_STARTED', { projectId, attempt });

      await this.db.table('sync_tasks').put({
        projectId,
        status: 'PROCESSING',
        attempt,
        lastUpdated: Date.now()
      });

      const workerPromise = this.runAuditWorker(projectId, {
        db: this.db,
        notify: (type, payload) => this.#bridgeWorkerEvents(type, payload, projectId)
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('WORKER_TIMEOUT_EXCEEDED')), this.WORKER_TIMEOUT_MS)
      );

      const result = await Promise.race([workerPromise, timeoutPromise]);

      if (result.status === 'AUDIT_ERROR') {
        throw new Error(result.error || 'Unknown Audit Error');
      }

      const snapshot = {
        projectId,
        projectName: result.projectData?.projectName || 'Unnamed Project',
        timestamp: Date.now(),
        data: this.#cloneData(result.projectData),
        results: result.auditResults
      };

      await this.db.table('audit_snapshots').add(snapshot);

      await this.db.table('sync_tasks').delete(projectId);
      this.notify('SYNC_COMPLETE', { projectId });

      return { status: 'SUCCESS', projectId };
    } catch (err) {
      syncFailed = true;
      errorReason = err.message;

      this.notify('SYNC_ERROR', { projectId, error: errorReason });

      await this.db.table('sync_tasks').update(projectId, {
        status: 'FAILED',
        error: errorReason,
        lastUpdated: Date.now()
      });

      return { status: 'ERROR', projectId, error: errorReason };
    } finally {
      this.activeLocks.delete(projectId);

      if (syncFailed && attempt < this.MAX_RETRIES) {
        this.#requeueSync(projectId, attempt + 1);
      }
    }
  }

  /**
   * Requeues sync using exponential backoff: (2^attempt * 1000ms).
   */
  #requeueSync(projectId, nextAttempt) {
    const delay = Math.pow(2, nextAttempt) * 1000;
    setTimeout(() => {
      this.triggerSync(projectId, nextAttempt);
    }, delay);
  }
}
