'use strict'

const express = require('express')

const STORAGE_KEY = 'releases/build-health/runs.json'
const jsonBody = express.json({ limit: '2mb' })
const VALID_RESULTS = new Set(['SUCCESS', 'UNSTABLE', 'FAILURE', 'ABORTED'])
const VALID_CAUSES = new Set(['timer', 'upstream', 'user', 'rebuild', 'pull_request', 'scm', 'unknown'])
const VALID_STREAMS = new Set(['odh-nightly', 'rhoai-nightly', 'release'])

function isIsoDate(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function runKeyFor(jenkins) {
  return `${jenkins.instance}/${jenkins.job}#${jenkins.buildNumber}`
}

function releaseVersion(release) {
  if (typeof release.version === 'string' && release.version.trim()) return release.version.trim()
  const rhoai = typeof release.rhoaiVersionTag === 'string' ? release.rhoaiVersionTag.trim() : ''
  if (rhoai) return rhoai
  const ref = typeof release.imageRef === 'string' ? release.imageRef : ''
  const withoutDigest = ref.split('@')[0]
  const colon = withoutDigest.lastIndexOf(':')
  if (colon < 0) return null
  const tag = withoutDigest.slice(colon + 1)
  const marker = tag.toLowerCase().lastIndexOf('rhoai-')
  if (marker < 0 || (marker > 0 && tag[marker - 1] !== '-')) return null
  const version = tag.slice(marker + 'rhoai-'.length)
  const numericPrefix = /^\d+\.\d+/.exec(version)
  if (!numericPrefix) return null
  let afterSeparator = false
  for (const char of version.slice(numericPrefix[0].length)) {
    if (char === '-' || char === '.') {
      if (afterSeparator) return null
      afterSeparator = true
    } else if (/^[A-Za-z0-9]$/.test(char)) {
      afterSeparator = false
    } else {
      return null
    }
  }
  if (afterSeparator) return null
  return version.replace(/\.(?=ea\.|rc\.)/gi, '-')
}

function validatePayload(body) {
  const errors = []
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { errors: ['body must be an object'] }
  if (body.schemaVersion !== 1) errors.push('schemaVersion must be 1')
  if (!VALID_STREAMS.has(body.reporting?.stream)) errors.push('reporting.stream must be odh-nightly, rhoai-nightly, or release')
  if (!body.jenkins || typeof body.jenkins.instance !== 'string' || !body.jenkins.instance.trim() || typeof body.jenkins.job !== 'string' || !body.jenkins.job.trim()) errors.push('jenkins.instance and jenkins.job are required')
  if (!Number.isInteger(body.jenkins?.buildNumber) || body.jenkins.buildNumber < 1) errors.push('jenkins.buildNumber must be a positive integer')
  if (typeof body.jenkins?.buildUrl !== 'string' || !/^https:\/\//i.test(body.jenkins.buildUrl)) errors.push('jenkins.buildUrl must be an https URL')
  if (!body.run || !VALID_RESULTS.has(body.run.result)) errors.push('run.result must be SUCCESS, UNSTABLE, FAILURE, or ABORTED')
  if (!isIsoDate(body.run?.startedAt) || !isIsoDate(body.run?.completedAt)) errors.push('run.startedAt and run.completedAt must be ISO timestamps')
  if (!Number.isFinite(body.run?.durationMs) || body.run.durationMs < 0) errors.push('run.durationMs must be a non-negative number')
  if (!body.release || typeof body.release !== 'object' || Array.isArray(body.release)) errors.push('release is required')
  else if (body.reporting?.stream && body.reporting.stream !== 'odh-nightly' && !/^\d+\.\d+/.test(releaseVersion(body.release) || '')) errors.push('a numeric release.version or a versioned image reference is required for RHOAI runs')
  if (body.release?.installedVersion != null && typeof body.release.installedVersion !== 'string') errors.push('release.installedVersion must be a string or null')
  if (!body.environment || typeof body.environment !== 'object' || Array.isArray(body.environment)) errors.push('environment is required (values may be null)')
  else if (body.environment.clusterName != null && typeof body.environment.clusterName !== 'string') errors.push('environment.clusterName must be a string or null')
  if (body.trigger != null && (typeof body.trigger !== 'object' || Array.isArray(body.trigger))) errors.push('trigger must be an object')
  if (body.trigger?.causes !== undefined && !Array.isArray(body.trigger.causes)) errors.push('trigger.causes must be an array')
  else (body.trigger?.causes || []).forEach((cause, index) => {
    if (!cause || !VALID_CAUSES.has(cause.kind)) errors.push(`trigger.causes[${index}].kind is invalid`)
  })
  if (body.stages !== undefined && !Array.isArray(body.stages)) errors.push('stages must be an array')
  if (body.tests != null && (typeof body.tests !== 'object' || Array.isArray(body.tests))) errors.push('tests must be an object')
  if (body.tests?.failedCases !== undefined && !Array.isArray(body.tests.failedCases)) errors.push('tests.failedCases must be an array')
  if (Array.isArray(body.tests?.failedCases)) body.tests.failedCases.forEach((test, index) => {
    if (!test || typeof test !== 'object' || Array.isArray(test)) errors.push(`tests.failedCases[${index}] must be an object`)
  })
  if (body.tests && body.tests.counts) {
    for (const key of ['passed', 'failed', 'skipped']) {
      const value = body.tests.counts[key]
      if (value !== null && value !== undefined && (!Number.isInteger(value) || value < 0)) errors.push(`tests.counts.${key} must be a non-negative integer or null`)
    }
  }
  return { errors }
}

function validateAnalysisPayload(body) {
  const errors = []
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { errors: ['body must be an object'] }
  if (body.schemaVersion !== 1) errors.push('schemaVersion must be 1')
  if (!body.jenkins || typeof body.jenkins.instance !== 'string' || !body.jenkins.instance.trim() || typeof body.jenkins.job !== 'string' || !body.jenkins.job.trim()) errors.push('jenkins.instance and jenkins.job are required')
  if (!Number.isInteger(body.jenkins?.buildNumber) || body.jenkins.buildNumber < 1) errors.push('jenkins.buildNumber must be a positive integer')
  if (!body.analysis || typeof body.analysis !== 'object' || Array.isArray(body.analysis)) return { errors: [...errors, 'analysis must be an object'] }
  if (!isIsoDate(body.analysis.producedAt)) errors.push('analysis.producedAt must be an ISO timestamp')
  if (typeof body.analysis.summary !== 'string' || !body.analysis.summary.trim() || body.analysis.summary.length > 4000) errors.push('analysis.summary must be 1–4000 characters')
  if (body.analysis.url != null && (typeof body.analysis.url !== 'string' || !/^https:\/\//i.test(body.analysis.url))) errors.push('analysis.url must be an https URL or null')
  if (!Array.isArray(body.analysis.findings) || body.analysis.findings.length > 100) errors.push('analysis.findings must be an array of at most 100 findings')
  else {
    const ids = new Set()
    body.analysis.findings.forEach((finding, index) => {
      if (!finding || typeof finding !== 'object' || Array.isArray(finding)) {
        errors.push(`analysis.findings[${index}] must be an object`)
        return
      }
      if (typeof finding.id !== 'string' || !finding.id.trim() || finding.id.length > 120 || ids.has(finding.id)) errors.push(`analysis.findings[${index}].id must be unique and 1–120 characters`)
      ids.add(finding.id)
      for (const field of ['category', 'suggestedTeam', 'jiraIssue', 'explanation']) {
        if (finding[field] != null && (typeof finding[field] !== 'string' || finding[field].length > 2000)) errors.push(`analysis.findings[${index}].${field} must be a string or null (up to 2000 characters)`)
      }
      if (finding.failedCases != null && (!Array.isArray(finding.failedCases) || finding.failedCases.length > 100)) errors.push(`analysis.findings[${index}].failedCases must be an array of at most 100 cases`)
      else (finding.failedCases || []).forEach((test, testIndex) => {
        if (!test || typeof test.suite !== 'string' || typeof test.name !== 'string') errors.push(`analysis.findings[${index}].failedCases[${testIndex}] requires suite and name`)
      })
    })
  }
  return { errors }
}

function normalizedRun(body) {
  const release = body.release || {}
  const run = { ...body.run }
  const trigger = body.trigger || {}
  return {
    schemaVersion: 1,
    runKey: runKeyFor(body.jenkins),
    jenkins: {
      instance: body.jenkins.instance,
      job: body.jenkins.job,
      buildNumber: body.jenkins.buildNumber,
      buildUrl: body.jenkins.buildUrl
    },
    run: { ...run, displayName: run.displayName || null },
    reporting: { stream: body.reporting.stream },
    release: {
      product: release.product || null,
      version: releaseVersion(release),
      channel: release.channel || null,
      deploymentType: release.deploymentType || null,
      imageRef: release.imageRef || null,
      imageDigest: release.imageDigest || null,
      installedVersion: release.installedVersion || null,
      rawVersion: release.version || null
    },
    environment: {
      name: body.environment.name || null,
      clusterName: body.environment.clusterName || null,
      platform: body.environment.platform || null,
      clusterType: body.environment.clusterType || null,
      architecture: body.environment.architecture || null
    },
    trigger: {
      causes: (trigger.causes || []).map(cause => ({
        kind: cause.kind,
        job: cause.job || null,
        buildNumber: Number.isInteger(cause.buildNumber) ? cause.buildNumber : null,
        rebuildOf: Number.isInteger(cause.rebuildOf) ? cause.rebuildOf : null
      })),
      repository: trigger.repository || null,
      branch: trigger.branch || null,
      commit: trigger.commit || null,
      pullRequest: trigger.pullRequest || null
    },
    stages: (body.stages || []).map(stage => ({
      name: String(stage.name || 'Unnamed stage'),
      status: String(stage.status || 'UNKNOWN'),
      durationMs: Number.isFinite(stage.durationMs) ? stage.durationMs : null
    })),
    tests: body.tests ? {
      collectionState: body.tests.collectionState || 'unavailable',
      suiteCount: Number.isInteger(body.tests.suiteCount) ? body.tests.suiteCount : null,
      counts: body.tests.counts ? {
        passed: body.tests.counts.passed ?? null,
        failed: body.tests.counts.failed ?? null,
        skipped: body.tests.counts.skipped ?? null
      } : null,
      failedCases: Array.isArray(body.tests.failedCases) ? body.tests.failedCases.slice(0, 50).map(test => {
        const ownership = test.ownership && typeof test.ownership === 'object' ? test.ownership : null
        return {
          suite: String(test.suite || ''),
          name: String(test.name || ''),
          status: String(test.status || 'FAILED'),
          component: typeof test.component === 'string' ? test.component.slice(0, 160) : null,
          ownership: ownership ? {
            teamId: typeof ownership.teamId === 'string' ? ownership.teamId.slice(0, 120) : null,
            teamName: typeof ownership.teamName === 'string' ? ownership.teamName.slice(0, 160) : null,
            source: typeof ownership.source === 'string' ? ownership.source.slice(0, 120) : null,
            confidence: typeof ownership.confidence === 'string' ? ownership.confidence.slice(0, 40) : null
          } : null
        }
      }) : [],
      failedCasesTruncated: Array.isArray(body.tests.failedCases) && body.tests.failedCases.length > 50
    } : { collectionState: 'unavailable', suiteCount: null, counts: null, failedCases: [] },
    agentAnalysis: null,
    receivedAt: new Date().toISOString()
  }
}

module.exports = function registerBuildHealthRoutes(router, context) {
  const { storage, requireAuth, requireScope } = context

  async function readRuns() {
    const data = await storage.readFromStorage(STORAGE_KEY)
    return Array.isArray(data?.runs) ? data.runs : []
  }

  // Jenkins can complete several matrix/triggered builds at once. Serialize
  // run and analysis updates so parallel posts cannot overwrite each other.
  let writeQueue = Promise.resolve()
  function enqueueWrite(operation) {
    const pending = writeQueue.then(operation)
    writeQueue = pending.catch(() => {})
    return pending
  }

  function upsertRun(run) {
    return enqueueWrite(async () => {
      const existing = await readRuns()
      const index = existing.findIndex(item => item.runKey === run.runKey)
      if (index >= 0) existing[index] = { ...run, agentAnalysis: existing[index].agentAnalysis || null }
      else existing.push(run)
      existing.sort((a, b) => Date.parse(b.run.completedAt) - Date.parse(a.run.completedAt))
      await storage.writeToStorage(STORAGE_KEY, { schemaVersion: 1, updatedAt: new Date().toISOString(), runs: existing.slice(0, 2000) })
      return index >= 0 ? 'updated' : 'created'
    })
  }

  function upsertAnalysis(runKey, analysis) {
    return enqueueWrite(async () => {
      const existing = await readRuns()
      const run = existing.find(item => item.runKey === runKey)
      if (!run) return false
      run.agentAnalysis = {
        source: 'agent',
        reviewStatus: 'unverified',
        producedAt: analysis.producedAt,
        summary: analysis.summary.trim(),
        url: analysis.url || null,
        findings: analysis.findings.map(finding => ({
          id: finding.id,
          category: finding.category || null,
          suggestedTeam: finding.suggestedTeam || null,
          jiraIssue: finding.jiraIssue || null,
          explanation: finding.explanation || null,
          failedCases: (finding.failedCases || []).map(test => ({ suite: test.suite, name: test.name }))
        })),
        receivedAt: new Date().toISOString()
      }
      await storage.writeToStorage(STORAGE_KEY, { schemaVersion: 1, updatedAt: new Date().toISOString(), runs: existing })
      return true
    })
  }

  function requireMachineToken(req, res, next) {
    if (req.authMethod !== 'token') return res.status(401).json({ error: 'A scoped Org Pulse API token is required' })
    next()
  }

  /**
   * @openapi
   * /api/modules/releases/build-health/runs:
   *   post:
   *     summary: Ingest a completed Jenkins build health record
   *     tags: [Releases - Build Health]
   *     security:
   *       - bearerToken: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [schemaVersion, jenkins, reporting, run, release, environment]
   *             properties:
   *               schemaVersion: { type: integer, enum: [1] }
   *               jenkins:
   *                 type: object
   *                 required: [instance, job, buildNumber, buildUrl]
   *                 properties:
   *                   instance: { type: string, example: jenkins.example.com }
   *                   job: { type: string, example: components/dashboard/dashboard-e2e-tests }
   *                   buildNumber: { type: integer, minimum: 1 }
   *                   buildUrl: { type: string, format: uri }
   *               reporting:
   *                 type: object
   *                 required: [stream]
   *                 properties:
   *                   stream: { type: string, enum: [odh-nightly, rhoai-nightly, release] }
   *               run:
   *                 type: object
   *                 required: [result, startedAt, completedAt, durationMs]
   *                 properties:
   *                   result: { type: string, enum: [SUCCESS, UNSTABLE, FAILURE, ABORTED] }
   *                   startedAt: { type: string, format: date-time }
   *                   completedAt: { type: string, format: date-time }
   *                   durationMs: { type: number, minimum: 0 }
   *                   displayName: { type: string, nullable: true }
   *               release:
   *                 type: object
   *                 description: Version is required for RHOAI streams; ODH nightly may use null.
   *                 properties:
   *                   version: { type: string, nullable: true, example: '3.6' }
   *                   installedVersion: { type: string, nullable: true, example: '3.6.0' }
   *                   imageRef: { type: string, nullable: true }
   *                   imageDigest: { type: string, nullable: true }
   *                   product: { type: string, nullable: true }
   *                   channel: { type: string, nullable: true }
   *                   deploymentType: { type: string, nullable: true }
   *               environment:
   *                 type: object
   *                 properties:
   *                   name: { type: string, nullable: true, example: GCP }
   *                   clusterName: { type: string, nullable: true }
   *                   clusterType: { type: string, nullable: true }
   *                   platform: { type: string, nullable: true }
   *                   architecture: { type: string, nullable: true }
   *               trigger:
   *                 type: object
   *                 properties:
   *                   causes:
   *                     type: array
   *                     items:
   *                       type: object
   *                       required: [kind]
   *                       properties:
   *                         kind: { type: string, enum: [timer, upstream, user, rebuild, pull_request, scm, unknown] }
   *                         job: { type: string, nullable: true }
   *                         buildNumber: { type: integer, nullable: true }
   *               stages:
   *                 type: array
   *                 items:
   *                   type: object
   *                   properties:
   *                     name: { type: string }
   *                     status: { type: string }
   *                     durationMs: { type: number, nullable: true }
   *               tests:
   *                 type: object
   *                 description: Optional; null counts mean test results were unavailable.
   *                 properties:
   *                   collectionState: { type: string, example: complete }
   *                   suiteCount: { type: integer, nullable: true }
   *                   counts:
   *                     type: object
   *                     nullable: true
   *                     properties:
   *                       passed: { type: integer, nullable: true }
   *                       failed: { type: integer, nullable: true }
   *                       skipped: { type: integer, nullable: true }
   *                   failedCases:
   *                     type: array
   *                     items:
   *                       type: object
   *                       properties:
   *                         suite: { type: string }
   *                         name: { type: string }
   *                         status: { type: string }
   *                         component: { type: string, nullable: true }
   *     responses:
   *       200:
   *         description: "Build record created or updated, keyed by Jenkins instance/job/build number"
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status: { type: string, enum: [created, updated] }
   *                 runKey: { type: string }
   *                 version: { type: string, nullable: true }
   *       400: { description: Invalid build record }
   *       401: { description: Missing or invalid Org Pulse API token }
   *       403: { description: Token lacks releases:e2e:write scope }
   */
  router.post('/build-health/runs', requireAuth, requireMachineToken, requireScope('releases:e2e:write'), jsonBody, async function (req, res) {
    const validation = validatePayload(req.body)
    if (validation.errors.length) return res.status(400).json({ error: 'Invalid build health payload', details: validation.errors })
    const run = normalizedRun(req.body)
    const status = await upsertRun(run)
    return res.json({ status, runKey: run.runKey, version: run.release.version })
  })

  /**
   * @openapi
   * /api/modules/releases/build-health/runs/analysis:
   *   post:
   *     summary: Upsert unverified agent analysis for a previously published E2E run
   *     tags: [Releases - Build Health]
   *     security:
   *       - bearerToken: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [schemaVersion, jenkins, analysis]
   *             properties:
   *               schemaVersion: { type: integer, enum: [1] }
   *               jenkins:
   *                 type: object
   *                 required: [instance, job, buildNumber]
   *                 properties:
   *                   instance: { type: string }
   *                   job: { type: string }
   *                   buildNumber: { type: integer, minimum: 1 }
   *               analysis:
   *                 type: object
   *                 required: [producedAt, summary, findings]
   *                 properties:
   *                   producedAt: { type: string, format: date-time }
   *                   summary: { type: string, minLength: 1, maxLength: 4000 }
   *                   url: { type: string, format: uri, nullable: true }
   *                   findings:
   *                     type: array
   *                     maxItems: 100
   *                     items:
   *                       type: object
   *                       required: [id]
   *                       properties:
   *                         id: { type: string, description: Stable ID within this analysis }
   *                         category: { type: string, nullable: true }
   *                         suggestedTeam: { type: string, nullable: true }
   *                         jiraIssue: { type: string, nullable: true }
   *                         explanation: { type: string, nullable: true }
   *                         failedCases: { type: array, items: { type: object, required: [suite, name], properties: { suite: { type: string }, name: { type: string } } } }
   *     responses:
   *       200:
   *         description: Agent analysis stored; review status remains unverified
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status: { type: string, enum: [updated] }
   *                 runKey: { type: string }
   *                 reviewStatus: { type: string, enum: [unverified] }
   *       400: { description: Invalid analysis payload }
   *       401: { description: Missing or invalid Org Pulse API token }
   *       403: { description: Token lacks releases:e2e:write scope }
   *       404: { description: Build record not yet published; retry after publishing it }
   */
  router.post('/build-health/runs/analysis', requireAuth, requireMachineToken, requireScope('releases:e2e:write'), jsonBody, async function (req, res) {
    const validation = validateAnalysisPayload(req.body)
    if (validation.errors.length) return res.status(400).json({ error: 'Invalid agent analysis payload', details: validation.errors })
    const runKey = runKeyFor(req.body.jenkins)
    if (!await upsertAnalysis(runKey, req.body.analysis)) return res.status(404).json({ error: 'Build record not found', runKey })
    return res.json({ status: 'updated', runKey, reviewStatus: 'unverified' })
  })

}

module.exports._private = { normalizedRun, releaseVersion, runKeyFor, validateAnalysisPayload, validatePayload }
