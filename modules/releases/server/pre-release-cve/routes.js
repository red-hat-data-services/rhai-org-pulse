'use strict'

/**
 * Pre-Release CVE Report sub-router.
 *
 * Fetches CVE blocker data from a Google Sheets spreadsheet that tracks
 * pre-release CVEs grouped by package and component. The spreadsheet has
 * one tab per release version (e.g. "RHOAI 3.6-EA2", "RHOAI 3.6").
 *
 * Data is cached to local storage with a configurable TTL and can be
 * force-refreshed via POST /refresh.
 *
 * Mount: /api/modules/releases/pre-release-cve/
 */

const fs = require('fs')
const path = require('path')
const { createGoogleSheetsClient } = require('../../../../shared/server/google-sheets')

const SPREADSHEET_ID = '1NXoy5JgYVgSF4noW6252BfQMD7Qlp72YNyMGUzRDI9s'
const SOURCE_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit#gid=0`
const STORAGE_KEY = 'releases/pre-release-cve/latest.json'
const CACHE_TTL_MS = 15 * 60 * 1000
const FIXTURE_DIR = path.resolve(__dirname, '..', '..', '..', '..', 'fixtures', 'releases', 'pre-release-cve')

const EXPECTED_HEADERS = [
  'Package', 'Component', 'CVEs (Fix Available)', 'CVEs (Fix Not Available)',
  'Fix Status', 'Current Version', 'Fixed In', 'GitHub Repository',
  'Severity', 'Status', 'Run Date', 'JIRA', 'JIRA STATUS', 'JIRA RESOLUTION'
]

// ─── Parsing ─────────────────────────────────────────────────────────────────

function parseRow(row, headers) {
  const record = {}
  for (let i = 0; i < headers.length; i++) {
    record[headers[i]] = row[i] !== undefined && row[i] !== null ? String(row[i]).trim() : ''
  }
  return record
}

function splitCveList(str) {
  if (!str || str === '-') return []
  return str.split(',').map(s => s.trim()).filter(Boolean)
}

function parseSheetData(headers, rows) {
  const records = []
  for (const row of rows) {
    const r = parseRow(row, headers)
    if (!r.Package && !r.Component) continue

    const fixAvailableCves = splitCveList(r['CVEs (Fix Available)'])
    const fixNotAvailableCves = splitCveList(r['CVEs (Fix Not Available)'])

    records.push({
      package: r.Package,
      component: r.Component,
      cvesFixAvailable: fixAvailableCves,
      cvesFixNotAvailable: fixNotAvailableCves,
      cveCountFixAvailable: fixAvailableCves.length,
      cveCountFixNotAvailable: fixNotAvailableCves.length,
      totalCveCount: fixAvailableCves.length + fixNotAvailableCves.length,
      fixStatus: r['Fix Status'] || 'Unknown',
      currentVersion: r['Current Version'],
      fixedIn: r['Fixed In'],
      githubRepo: r['GitHub Repository'],
      severity: r.Severity || 'Unknown',
      status: r.Status || 'Unknown',
      runDate: r['Run Date'],
      jiraUrl: r.JIRA || '',
      jiraStatus: r['JIRA STATUS'] || '',
      jiraResolution: r['JIRA RESOLUTION'] || ''
    })
  }
  return records
}

// ─── Aggregation ─────────────────────────────────────────────────────────────

function aggregateRecords(records) {
  const totalRecords = records.length
  const allFixAvailableCves = new Set()
  const allFixNotAvailableCves = new Set()

  const byPackage = {}
  const byComponent = {}
  const bySeverity = {}
  const byStatus = {}
  const byFixStatus = {}
  const byGithubRepo = {}

  for (const r of records) {
    r.cvesFixAvailable.forEach(c => allFixAvailableCves.add(c))
    r.cvesFixNotAvailable.forEach(c => allFixNotAvailableCves.add(c))

    byPackage[r.package] = (byPackage[r.package] || 0) + 1
    byComponent[r.component] = (byComponent[r.component] || 0) + 1
    bySeverity[r.severity] = (bySeverity[r.severity] || 0) + 1
    byStatus[r.status] = (byStatus[r.status] || 0) + 1
    byFixStatus[r.fixStatus] = (byFixStatus[r.fixStatus] || 0) + 1
    byGithubRepo[r.githubRepo] = (byGithubRepo[r.githubRepo] || 0) + 1
  }

  return {
    totalRecords,
    uniqueCvesFixAvailable: allFixAvailableCves.size,
    uniqueCvesFixNotAvailable: allFixNotAvailableCves.size,
    totalUniqueCves: new Set([...allFixAvailableCves, ...allFixNotAvailableCves]).size,
    byPackage: toSortedArray(byPackage, 'package'),
    byComponent: toSortedArray(byComponent, 'component'),
    bySeverity: toSortedArray(bySeverity, 'severity'),
    byStatus: toSortedArray(byStatus, 'status'),
    byFixStatus: toSortedArray(byFixStatus, 'fixStatus'),
    byGithubRepo: toSortedArray(byGithubRepo, 'repo')
  }
}

function toSortedArray(counts, labelKey) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1
  return Object.entries(counts)
    .map(([label, count]) => ({
      [labelKey]: label,
      count,
      pct: parseFloat(((count / total) * 100).toFixed(1))
    }))
    .sort((a, b) => b.count - a.count)
}

// ─── Severity × Package matrix ──────────────────────────────────────────────

function buildSeverityPackageMatrix(records) {
  const packages = new Set()
  const severities = new Set()
  const matrix = {}

  for (const r of records) {
    packages.add(r.package)
    severities.add(r.severity)
    const key = `${r.severity}||${r.package}`
    matrix[key] = (matrix[key] || 0) + 1
  }

  const sortedPackages = [...packages].sort()
  const severityOrder = ['Critical', 'High', 'Medium', 'Low', 'Unknown']
  const sortedSeverities = [...severities].sort((a, b) => {
    const ai = severityOrder.indexOf(a)
    const bi = severityOrder.indexOf(b)
    if (ai === -1 && bi === -1) return a.localeCompare(b)
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })

  const rows = sortedSeverities.map(severity => {
    const cells = {}
    let rowTotal = 0
    for (const pkg of sortedPackages) {
      const val = matrix[`${severity}||${pkg}`] || 0
      cells[pkg] = val
      rowTotal += val
    }
    return { severity, cells, total: rowTotal }
  })

  const columnTotals = {}
  let grandTotal = 0
  for (const pkg of sortedPackages) {
    const sum = rows.reduce((acc, r) => acc + (r.cells[pkg] || 0), 0)
    columnTotals[pkg] = sum
    grandTotal += sum
  }

  return { packages: sortedPackages, rows, columnTotals, grandTotal }
}

// ─── Service ─────────────────────────────────────────────────────────────────

function createPreReleaseCveService(context) {
  const { storage } = context
  const sheets = context.googleSheetsClient || createGoogleSheetsClient({
    keyFile: context.resolveSecret?.('GOOGLE_SERVICE_ACCOUNT_KEY_FILE') || '/etc/secrets/google-sa-key.json'
  })
  let memoryCache = null

  async function fetchLive() {
    const sheetNames = await sheets.discoverSheetNames(SPREADSHEET_ID)
    const fetchedAt = new Date()

    const releases = []

    for (const sheetName of sheetNames) {
      const { headers, rows } = await sheets.fetchRawSheet(SPREADSHEET_ID, sheetName)
      if (!headers.length || !rows.length) continue

      const normalizedHeaders = headers.map(h => h.trim())
      const hasExpected = EXPECTED_HEADERS.slice(0, 5).every(eh =>
        normalizedHeaders.some(nh => nh.toLowerCase() === eh.toLowerCase())
      )
      if (!hasExpected) {
        console.warn(`[pre-release-cve] Skipping sheet "${sheetName}" — headers don't match expected format`)
        continue
      }

      const records = parseSheetData(normalizedHeaders, rows)
      const aggregation = aggregateRecords(records)
      const severityPackageMatrix = buildSeverityPackageMatrix(records)

      releases.push({
        version: sheetName,
        records,
        aggregation,
        severityPackageMatrix
      })
    }

    if (!releases.length) throw new Error('No valid sheets found in the Pre-Release CVE spreadsheet')

    const result = {
      fetchedAt: fetchedAt.toISOString(),
      source: { spreadsheetId: SPREADSHEET_ID, url: SOURCE_URL },
      releases,
      availableVersions: releases.map(r => r.version)
    }

    await storage.writeToStorage(STORAGE_KEY, result)
    memoryCache = result
    return result
  }

  async function getData({ force = false } = {}) {
    if (!force && memoryCache && Date.now() - new Date(memoryCache.fetchedAt).getTime() < CACHE_TTL_MS) {
      return { ...memoryCache, cacheStatus: 'fresh' }
    }
    const stored = await storage.readFromStorage(STORAGE_KEY)
    if (!force && stored && Date.now() - new Date(stored.fetchedAt).getTime() < CACHE_TTL_MS) {
      memoryCache = stored
      return { ...stored, cacheStatus: 'fresh' }
    }
    try {
      const live = await fetchLive()
      return { ...live, cacheStatus: 'refreshed' }
    } catch (error) {
      if (stored) {
        console.warn('[pre-release-cve] Google Sheets refresh failed; serving stored data:', error.message)
        memoryCache = stored
        return { ...stored, cacheStatus: 'stale', warning: error.message }
      }
      // Fall back to fixture data (demo mode or first-run without credentials)
      try {
        const fixturePath = path.join(FIXTURE_DIR, 'latest.json')
        if (fs.existsSync(fixturePath)) {
          const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'))
          console.warn('[pre-release-cve] Serving fixture data (no live or stored data available)')
          return { ...fixture, cacheStatus: 'fixture' }
        }
      } catch (fixtureErr) {
        console.error('[pre-release-cve] Failed to read fixture:', fixtureErr.message)
      }
      throw error
    }
  }

  return {
    getData,
    refresh: async () => ({ ...await fetchLive(), cacheStatus: 'refreshed' })
  }
}

// ─── Routes ──────────────────────────────────────────────────────────────────

/**
 * @openapi
 * /api/modules/releases/pre-release-cve:
 *   get:
 *     tags: [Releases - Pre-Release CVE]
 *     summary: Get pre-release CVE blocker report data
 *     description: >
 *       Returns pre-release CVE data grouped by package and component from
 *       the Google Sheets source of truth. Includes aggregations by package,
 *       component, severity, status, and fix availability.
 *     responses:
 *       200:
 *         description: Pre-release CVE report data with per-version breakdowns
 *       503:
 *         description: No live or stored CVE data is available
 */

/**
 * @openapi
 * /api/modules/releases/pre-release-cve/refresh:
 *   post:
 *     tags: [Releases - Pre-Release CVE]
 *     summary: Refresh pre-release CVE data from Google Sheets
 *     responses:
 *       200:
 *         description: Refreshed pre-release CVE data
 *       503:
 *         description: The Google Sheets refresh failed
 */

function registerPreReleaseCveRoutes(router, context) {
  const service = createPreReleaseCveService(context)

  router.get('/', context.requireAuth, context.requireScope('releases:read'), async function (req, res) {
    try {
      res.json(await service.getData())
    } catch (error) {
      console.error('[pre-release-cve] GET failed:', error.message)
      res.status(503).json({ error: 'Pre-release CVE data is unavailable' })
    }
  })

  router.post('/refresh', context.requireAuth, context.requireScope('releases:write'), async function (req, res) {
    try {
      res.json(await service.refresh())
    } catch (error) {
      console.error('[pre-release-cve] Refresh failed:', error.message)
      res.status(503).json({ error: 'Pre-release CVE refresh failed' })
    }
  })

  if (context.registerRefresh) {
    context.registerRefresh('pre-release-cve', {
      order: 25,
      cadence: '1h',
      timeout: 120000,
      description: 'Refreshes pre-release CVE blocker data from Google Sheets',
      handler: async function () {
        if (process.env.DEMO_MODE === 'true') return { status: 'skipped', message: 'Refresh disabled in demo mode' }
        return service.refresh()
      }
    })
  }
}

module.exports = registerPreReleaseCveRoutes
module.exports.createPreReleaseCveService = createPreReleaseCveService
module.exports.parseSheetData = parseSheetData
module.exports.aggregateRecords = aggregateRecords
module.exports.STORAGE_KEY = STORAGE_KEY
