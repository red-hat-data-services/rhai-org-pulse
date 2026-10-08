const { test, expect } = require('@playwright/test');
const express = require('express');
const registerBuildHealthRoutes = require('../../modules/releases/server/build-health/routes');

test('accepts scoped E2E publishing and later unverified agent analysis', async () => {
  const app = express();
  const router = express.Router();
  let stored = null;
  const storage = {
    async readFromStorage() { return stored ? structuredClone(stored) : null; },
    async writeToStorage(_key, data) { stored = structuredClone(data); }
  };
  const requireAuth = (req, res, next) => {
    const token = req.get('authorization');
    if (token !== 'Bearer tt_e2e' && token !== 'Bearer tt_read') return res.status(401).json({ error: 'Unauthorized' });
    req.authMethod = 'token';
    req.tokenScopes = token === 'Bearer tt_e2e' ? ['releases:e2e:write', 'releases:read'] : ['releases:read'];
    next();
  };
  const requireScope = scope => (req, res, next) => req.tokenScopes.includes(scope)
    ? next()
    : res.status(403).json({ error: 'Token scope insufficient', requiredScope: scope });
  registerBuildHealthRoutes(router, { storage, requireAuth, requireScope });
  app.use('/api/modules/releases', router);
  const server = await new Promise(resolve => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const base = `http://127.0.0.1:${server.address().port}/api/modules/releases/build-health`;
  const post = (path, body, token = 'tt_e2e') => fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(body)
  });
  const jenkins = { instance: 'jenkins.example.com', job: 'components/dashboard/dashboard-e2e-tests', buildNumber: 3424,
    buildUrl: 'https://jenkins.example.com/job/components/job/dashboard/job/dashboard-e2e-tests/3424/' };
  const run = { schemaVersion: 1, jenkins, reporting: { stream: 'release' },
    run: { result: 'FAILURE', startedAt: '2026-10-05T10:00:00.000Z', completedAt: '2026-10-05T10:20:00.000Z', durationMs: 1200000 },
    release: { version: '3.6', installedVersion: '3.6.0' }, environment: { name: 'GCP' },
    trigger: { causes: [{ kind: 'user' }] } };
  const analysis = { schemaVersion: 1, jenkins: { instance: jenkins.instance, job: jenkins.job, buildNumber: jenkins.buildNumber },
    analysis: { producedAt: '2026-10-05T10:30:00.000Z', summary: 'Model serving failed.', reviewStatus: 'verified',
      findings: [{ id: 'serving', category: 'product-defect', suggestedTeam: 'Model Serving',
        failedCases: [{ suite: 'models', name: 'deploys a model' }] }] } };
  try {
    expect((await post('/runs', run, 'tt_invalid')).status).toBe(401);
    expect((await post('/runs', run, 'tt_read')).status).toBe(403);
    expect((await post('/runs', { ...run, reporting: { stream: 'unknown' } })).status).toBe(400);
    expect((await post('/runs', { ...run, release: { version: 'rhoai-nightly' } })).status).toBe(400);
    expect((await post('/runs/analysis', analysis)).status).toBe(404);
    const created = await post('/runs', run);
    expect(created.status).toBe(200);
    expect((await created.json()).status).toBe('created');
    expect(stored.runs[0].reporting.stream).toBe('release');
    expect(stored.runs[0].release.installedVersion).toBe('3.6.0');

    const updated = await post('/runs/analysis', analysis);
    expect(updated.status).toBe(200);
    expect(stored.runs[0].agentAnalysis).toMatchObject({ source: 'agent', reviewStatus: 'unverified',
      findings: [{ id: 'serving', suggestedTeam: 'Model Serving' }] });
    expect((await post('/runs', run)).status).toBe(200);
    expect(stored.runs).toHaveLength(1);
    expect(stored.runs[0].agentAnalysis.summary).toBe('Model serving failed.');

    const odh = { ...run, jenkins: { ...jenkins, buildNumber: 3425 }, reporting: { stream: 'odh-nightly' },
      release: { version: null }, trigger: { causes: [{ kind: 'upstream', job: 'odh/odh-tier1' }] } };
    expect((await post('/runs', odh)).status).toBe(200);
    expect(stored.runs).toHaveLength(2);
    expect(stored.runs.find(item => item.reporting.stream === 'odh-nightly').release.version).toBeNull();
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
