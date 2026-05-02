import React, { useState } from 'react';

export default function ShadowMirrorTestPanel() {
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);

  const runSmokeTest = async () => {
    setRunning(true);
    setResult({ status: 'RUNNING' });

    try {
      const module = await import('../core/sync/shadowMirrorSmokeTest.js');
      const smokeResult = await module.runShadowMirrorSmokeTest();
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
    <div className="card" style={{ marginTop: 12, borderColor: '#f59e0b' }}>
      <div className="section-title">Shadow Mirror Smoke Test</div>
      <p className="muted">Temporary verification panel. It does not change capture flow.</p>
      <button className="primary" type="button" onClick={runSmokeTest} disabled={running}>
        {running ? 'Running Smoke Test...' : 'Run Shadow Mirror Smoke Test'}
      </button>
      {result ? (
        <pre style={{ whiteSpace: 'pre-wrap', marginTop: 12, fontSize: 12 }}>
          {JSON.stringify(result, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}
