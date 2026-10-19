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
    trigger: { causes: [{ kind: 'user' }] },
    tests: {
      collectionState: 'complete',
      suiteCount: 1,
      counts: { passed: 51, failed: 1, skipped: 0 },
      failedCases: [{
        suite: 'A user can view subscriptions and manage API keys on the Keys and Subscriptions page',
        name: 'Verify subscriptions tab, API keys, filtering, and revoke all keys for a user',
        status: 'FAILED',
        filePath: 'packages/cypress/cypress/tests/e2e/maas/testApiKeys.cy.ts',
        area: 'maas',
        tags: [' @MaaS ', '@Dashboard', '@MaaS']
      }],
      passedCases: [{
        suite: 'A user can view subscriptions and manage API keys on the Keys and Subscriptions page',
        name: 'Verify subscriptions tab and API keys',
        status: 'PASSED',
        filePath: 'packages/cypress/cypress/tests/e2e/maas/testApiKeys.cy.ts',
        area: 'maas',
        tags: [' @MaaS ', '@Dashboard', '@MaaS']
      }]
    } };
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
    const invalid = await post('/runs', {
      ...run,
      tests: {
        ...run.tests,
        failedCases: [{ ...run.tests.failedCases[0], filePath: 123, area: 456, tags: [''] }]
      }
    });
    expect(invalid.status).toBe(400);
    expect((await invalid.json()).details).toEqual([
      'tests.failedCases[0].filePath must be a string or null (up to 512 characters)',
      'tests.failedCases[0].area must be a string or null (up to 80 characters)',
      'tests.failedCases[0].tags[0] must be a non-empty string of at most 80 characters'
    ]);
    const invalidPassed = await post('/runs', {
      ...run,
      tests: {
        ...run.tests,
        passedCases: [{ ...run.tests.passedCases[0], filePath: 123, area: 456, tags: [''] }]
      }
    });
    expect(invalidPassed.status).toBe(400);
    expect((await invalidPassed.json()).details).toEqual([
      'tests.passedCases[0].filePath must be a string or null (up to 512 characters)',
      'tests.passedCases[0].area must be a string or null (up to 80 characters)',
      'tests.passedCases[0].tags[0] must be a non-empty string of at most 80 characters'
    ]);
    const created = await post('/runs', run);
    expect(created.status).toBe(200);
    expect((await created.json()).status).toBe('created');
    expect(stored.runs[0].reporting.stream).toBe('release');
    expect(stored.runs[0].release.installedVersion).toBe('3.6.0');
    expect(stored.runs[0].tests.failedCases[0]).toMatchObject({
      filePath: 'packages/cypress/cypress/tests/e2e/maas/testApiKeys.cy.ts',
      area: 'maas',
      tags: ['@MaaS', '@Dashboard']
    });
    expect(stored.runs[0].tests.passedCases[0]).toMatchObject({
      filePath: 'packages/cypress/cypress/tests/e2e/maas/testApiKeys.cy.ts',
      area: 'maas',
      tags: ['@MaaS', '@Dashboard']
    });
    expect(stored.runs[0].tests.passedCasesTruncated).toBe(false);

    const updated = await post('/runs/analysis', analysis);
    expect(updated.status).toBe(200);
    expect(stored.runs[0].agentAnalysis).toMatchObject({ source: 'agent', reviewStatus: 'unverified',
      findings: [{ id: 'serving', suggestedTeam: 'Model Serving' }] });
    expect((await post('/runs', run)).status).toBe(200);
    expect(stored.runs).toHaveLength(1);
    expect(stored.runs[0].agentAnalysis.summary).toBe('Model serving failed.');

    const truncated = {
      ...run,
      jenkins: { ...jenkins, buildNumber: 3426 },
      tests: {
        ...run.tests,
        counts: { passed: 501, failed: 1, skipped: 0 },
        passedCases: Array.from({ length: 501 }, (_value, index) => ({
          suite: 'maas',
          name: `passed case ${index}`
        }))
      }
    };
    expect((await post('/runs', truncated)).status).toBe(200);
    expect(stored.runs).toHaveLength(2);
    const truncatedRun = stored.runs.find(item => item.jenkins.buildNumber === 3426);
    expect(truncatedRun.tests.passedCases).toHaveLength(500);
    expect(truncatedRun.tests.passedCases[0].status).toBe('PASSED');
    expect(truncatedRun.tests.passedCasesTruncated).toBe(true);

    const odh = { ...run, jenkins: { ...jenkins, buildNumber: 3425 }, reporting: { stream: 'odh-nightly' },
      release: { version: null }, trigger: { causes: [{ kind: 'upstream', job: 'odh/odh-tier1' }] } };
    expect((await post('/runs', odh)).status).toBe(200);
    expect(stored.runs).toHaveLength(3);
    expect(stored.runs.find(item => item.reporting.stream === 'odh-nightly').release.version).toBeNull();
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
