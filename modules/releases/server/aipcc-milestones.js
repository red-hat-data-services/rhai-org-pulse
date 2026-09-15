'use strict'

const { createGoogleUserSheetsClient } = require('../../../server/google-user-oauth')

const SPREADSHEET_ID = '10OccyDM5P1UZX1ldaoPLVKbL4HKgh7cCY3Oiy_xKcX8'
const SHEET_NAME = 'tpm_source_of_truth'
const STORAGE_KEY = 'releases/aipcc-milestones.json'
const CREDENTIAL_OWNER_KEY = 'releases/aipcc-milestones-google-user.json'
const SOURCE_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit#gid=0`
const CACHE_TTL_MS = 15 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000
const PHASE_NAMES = new Set(['Planning', 'Execution', 'Release'])
const MONTHS = new Map([
  ['jan', 0], ['january', 0], ['feb', 1], ['february', 1],
  ['mar', 2], ['march', 2], ['apr', 3], ['april', 3], ['may', 4],
  ['jun', 5], ['june', 5], ['jul', 6], ['july', 6], ['aug', 7], ['august', 7],
  ['sep', 8], ['september', 8], ['oct', 9], ['october', 9],
  ['nov', 10], ['november', 10], ['dec', 11], ['december', 11]
])

function localDate(year, month, day) {
  return new Date(year, month, day, 12, 0, 0, 0)
}

function toIso(date) {
  if (!date || Number.isNaN(date.getTime())) return null
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function parseDateParts(raw) {
  if (raw === null || raw === undefined || raw === '') return null
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const utc = new Date(Date.UTC(1899, 11, 30) + raw * DAY_MS)
    return { exact: localDate(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate()) }
  }

  const value = String(raw).trim()
  if (!value || /^(tbd|xx|released|cves only|-|as soon as able)$/i.test(value)) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return { exact: new Date(`${value}T12:00:00`) }

  let match = value.match(/^(\d{1,2})[- ]([A-Za-z]+)$/)
  if (match && MONTHS.has(match[2].toLowerCase())) {
    return { day: Number(match[1]), month: MONTHS.get(match[2].toLowerCase()) }
  }
  match = value.match(/^([A-Za-z]+)[- ](\d{1,2})$/)
  if (match && MONTHS.has(match[1].toLowerCase())) {
    return { day: Number(match[2]), month: MONTHS.get(match[1].toLowerCase()) }
  }
  return null
}

function closestDate(parts, expectedDate) {
  if (!parts) return null
  if (parts.exact) return parts.exact
  const year = expectedDate.getFullYear()
  const candidates = [year - 1, year, year + 1].map(candidateYear => localDate(candidateYear, parts.month, parts.day))
  candidates.sort((a, b) => Math.abs(a - expectedDate) - Math.abs(b - expectedDate))
  return candidates[0]
}

function parseDayOffset(raw) {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  const match = String(raw || '').trim().match(/^(-?\d+)\s*days?$/i)
  return match ? Number(match[1]) : null
}

function parseTargetDate(raw, note, referenceDate) {
  const parts = parseDateParts(raw)
  if (!parts) return null
  const offset = parseDayOffset(note)
  const expected = offset === null ? referenceDate : new Date(referenceDate.getTime() + offset * DAY_MS)
  return closestDate(parts, expected)
}

function parseStartDate(raw, targetDate) {
  const parts = parseDateParts(raw)
  if (!parts) return null
  if (parts.exact) return parts.exact
  const target = targetDate || new Date()
  const candidates = [target.getFullYear() - 1, target.getFullYear(), target.getFullYear() + 1]
    .map(year => localDate(year, parts.month, parts.day))
    .filter(candidate => candidate <= target)
  candidates.sort((a, b) => Math.abs(a - target) - Math.abs(b - target))
  return candidates[0] || localDate(target.getFullYear(), parts.month, parts.day)
}

function classifyRelease(name) {
  if (name === 'Z streams') return 'z-stream'
  if (/\bEA\d*\b/i.test(name)) return 'ea'
  if (/\bGA\b|stable/i.test(name)) return 'ga'
  return 'release'
}

function parseSpreadsheet(rows, referenceDate = new Date()) {
  const releases = []
  let currentRelease = null
  let currentPhase = null
  let zStreamVersion = null

  function startRelease(name) {
    currentRelease = { name, type: classifyRelease(name), phases: [] }
    currentPhase = null
    zStreamVersion = null
    releases.push(currentRelease)
  }

  function startPhase(name) {
    if (!currentRelease) return
    currentPhase = { name, milestones: [] }
    currentRelease.phases.push(currentPhase)
  }

  for (const row of rows) {
    const first = String(row[0] || '').trim()
    const name = String(row[1] || '').trim()
    const startRaw = row[2]
    const targetRaw = row[3]
    const note = row[4]

    if (first && !name && (first === 'Z streams' || /^RH AI\s+/i.test(first))) {
      startRelease(first)
      continue
    }
    if (first && !name && PHASE_NAMES.has(first)) {
      startPhase(first)
      continue
    }
    if (!currentRelease || !name) continue

    if (currentRelease.name === 'Z streams' && first) zStreamVersion = first
    if (!currentPhase) startPhase('Release')

    const targetDate = parseTargetDate(targetRaw, note, referenceDate)
    if (!targetDate) continue
    const startDate = parseStartDate(startRaw, targetDate)
    currentPhase.milestones.push({
      name: currentRelease.name === 'Z streams' && zStreamVersion ? `${zStreamVersion} ${name}` : name,
      startDate: toIso(startDate),
      targetDate: toIso(targetDate)
    })
  }

  return releases
    .map(release => ({ ...release, phases: release.phases.filter(phase => phase.milestones.length > 0) }))
    .filter(release => release.phases.length > 0)
}

function countMilestones(releases) {
  return releases.reduce((releaseTotal, release) => (
    releaseTotal + release.phases.reduce((phaseTotal, phase) => phaseTotal + phase.milestones.length, 0)
  ), 0)
}

function createAipccMilestonesService(context) {
  const { storage } = context
  let memoryCache = null

  async function getSheetsClient(userEmail) {
    if (context.googleSheetsClient) return context.googleSheetsClient
    if (!userEmail) throw new Error('No Org Pulse Google user is available for the milestone refresh')
    return createGoogleUserSheetsClient({ secrets: context.secrets, storage, userEmail })
  }

  async function fetchLive(userEmail) {
    const sheets = await getSheetsClient(userEmail)
    const { headers, rows } = await sheets.fetchRawSheet(SPREADSHEET_ID, SHEET_NAME)
    const fetchedAt = new Date()
    const releases = parseSpreadsheet([headers, ...rows], fetchedAt)
    const milestoneCount = countMilestones(releases)
    if (!milestoneCount) throw new Error('The AIPCC milestones sheet returned no valid milestones')

    const result = {
      fetchedAt: fetchedAt.toISOString(),
      source: { spreadsheetId: SPREADSHEET_ID, sheetName: SHEET_NAME, url: SOURCE_URL },
      milestoneCount,
      releases
    }
    await storage.writeToStorage(STORAGE_KEY, result)
    if (userEmail) await storage.writeToStorage(CREDENTIAL_OWNER_KEY, { userEmail: userEmail.toLowerCase() })
    memoryCache = result
    return result
  }

  async function getData({ force = false, userEmail } = {}) {
    if (!force && memoryCache && Date.now() - new Date(memoryCache.fetchedAt).getTime() < CACHE_TTL_MS) {
      return { ...memoryCache, cacheStatus: 'fresh' }
    }
    const stored = await storage.readFromStorage(STORAGE_KEY)
    if (!force && stored && Date.now() - new Date(stored.fetchedAt).getTime() < CACHE_TTL_MS) {
      memoryCache = stored
      return { ...stored, cacheStatus: 'fresh' }
    }
    try {
      const live = await fetchLive(userEmail)
      return { ...live, cacheStatus: 'refreshed' }
    } catch (error) {
      if (stored) {
        console.warn('[aipcc-milestones] Google Sheets refresh failed; serving stored data:', error.message)
        memoryCache = stored
        return { ...stored, cacheStatus: 'stale', warning: error.message }
      }
      throw error
    }
  }

  return {
    getData,
    refresh: async userEmail => {
      let refreshUser = userEmail
      if (!refreshUser) {
        const owner = await storage.readFromStorage(CREDENTIAL_OWNER_KEY)
        refreshUser = owner?.userEmail
      }
      return { ...await fetchLive(refreshUser), cacheStatus: 'refreshed' }
    }
  }
}

function registerAipccMilestonesRoutes(router, context) {
  const service = createAipccMilestonesService(context)

  /**
   * @openapi
   * /api/modules/releases/aipcc-milestones:
   *   get:
   *     tags: [Releases - AIPCC Milestones]
   *     summary: Get the AIPCC release milestone schedule
   *     responses:
   *       200:
   *         description: AIPCC release milestones grouped by release and phase
   *       503:
   *         description: No live or stored milestone data is available
   */
  router.get('/aipcc-milestones', context.requireAuth, context.requireScope('releases:read'), async function (req, res) {
    try {
      res.json(await service.getData({ userEmail: req.userEmail }))
    } catch (error) {
      console.error('[aipcc-milestones] GET failed:', error.message)
      res.status(503).json({ error: 'AIPCC milestone data is unavailable' })
    }
  })

  /**
   * @openapi
   * /api/modules/releases/aipcc-milestones/refresh:
   *   post:
   *     tags: [Releases - AIPCC Milestones]
   *     summary: Refresh AIPCC milestones from Google Sheets
   *     responses:
   *       200:
   *         description: Refreshed AIPCC milestone data
   *       503:
   *         description: The Google Sheets refresh failed
   */
  router.post('/aipcc-milestones/refresh', context.requireAdmin, context.requireScope('releases:write'), async function (req, res) {
    try {
      res.json(await service.refresh(req.userEmail))
    } catch (error) {
      console.error('[aipcc-milestones] refresh failed:', error.message)
      res.status(503).json({ error: 'AIPCC milestone refresh failed' })
    }
  })

  if (context.registerRefresh) {
    context.registerRefresh('aipcc-milestones', {
      order: 20,
      cadence: '1h',
      timeout: 120000,
      description: 'Refreshes the AIPCC release milestone schedule from Google Sheets',
      handler: async function () {
        if (process.env.DEMO_MODE === 'true') return { status: 'skipped', message: 'Refresh disabled in demo mode' }
        return service.refresh()
      }
    })
  }
}

module.exports = registerAipccMilestonesRoutes
module.exports.parseSpreadsheet = parseSpreadsheet
module.exports.parseDateParts = parseDateParts
module.exports.createAipccMilestonesService = createAipccMilestonesService
module.exports.STORAGE_KEY = STORAGE_KEY
