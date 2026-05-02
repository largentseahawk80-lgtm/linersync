import React, { useState } from 'react';

export default function FieldAuditorWorkerTestPanel() {
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);

  const runSmokeTest = async () => {
    setRunning(true);
    setResult({ status: 'RUNNING' });

    try {
      const module = await import('../core/audit/fieldAuditorWorkerSmokeTest.js');
      const smokeResult = await module.runFieldAuditorWorkerSmokeTest();
      setResult(smokeResult);
    } catch (error) {
      setResult({
        status: 'FAIL',
        error: error?.message || String(error)
      });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="card" style={{ marginTop: 12, borderColor: '#38bdf8' }}>
      <div className="section-title">Field Auditor Worker Smoke Test</div>
      <p className="muted">Temporary verification panel. It does not change capture flow.</p>
      <button className="primary" type="button" onClick={runSmokeTest} disabled={running}>
        {running ? 'Running Worker Smoke Test...' : 'Run Field Auditor Worker Smoke Test'}
      </button>
      {result ? (
        <pre style={{ whiteSpace: 'pre-wrap', marginTop: 12, fontSize: 12 }}>
          {JSON.stringify(result, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}
