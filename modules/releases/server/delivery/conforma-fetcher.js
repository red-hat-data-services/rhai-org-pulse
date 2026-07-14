'use strict'

const yaml = require('js-yaml')

let _fetch = globalThis.fetch

const { getConfig } = require('./config')

const AIPCC_FILES = [
  'registry-ai-containers-prod.yaml',
  'registry-rhel-ai-containers-prod.yaml',
  'registry-rhel-ai-disk-images-prod.yaml',
  'registry-rhel-ai-disk-image-containers-prod.yaml',
  'registry-aipcc-base-images-prod.yaml'
]

const STORAGE_KEY = 'releases/delivery/conforma-aipcc.json'

const VERSION_MAP = {
  'registry-ai-containers-prod': 'rhaii',
  'registry-rhel-ai-containers-prod': 'rhel-ai',
  'registry-rhel-ai-disk-images-prod': 'rhel-ai-disk-images',
  'registry-rhel-ai-disk-image-containers-prod': 'rhel-ai-container-disk-images',
  'registry-aipcc-base-images-prod': 'base-images'
}

function deriveVersion(metadataName) {
  return VERSION_MAP[metadataName] || metadataName
    .replace(/^registry-/, '')
    .replace(/-prod$/, '')
}

const DISPLAY_NAME_MAP = {
  'rhaii': 'RHAII',
  'rhel-ai': 'RHEL AI',
  'rhel-ai-disk-images': 'RHEL AI Disk Images',
  'rhel-ai-container-disk-images': 'RHEL AI Container Disk Images',
  'base-images': 'Base Images'
}

function deriveDisplayName(version) {
  return DISPLAY_NAME_MAP[version] || version.toUpperCase()
}

function extractJiraReferences(yamlText) {
  const refs = new Set()
  const pattern = /https:\/\/(?:issues\.redhat\.com|redhat\.atlassian\.net)\/browse\/[A-Z]+-\d+/g
  let match
  while ((match = pattern.exec(yamlText)) !== null) {
    refs.add(match[0])
  }
  return [...refs]
}

function transformEcpToRelease(doc, yamlText) {
  const meta = doc.metadata || {}
  const spec = doc.spec || {}
  const source = (spec.sources || [])[0] || {}
  const config = source.config || {}
  const volatileConfig = source.volatileConfig || {}
  const ruleData = source.ruleData || {}

  const version = deriveVersion(meta.name || '')
  const configExcludes = config.exclude || []
  const volatileExcludes = (volatileConfig.exclude || []).map(v =>
    typeof v === 'string' ? { value: v } : v
  )

  const jiraRefs = extractJiraReferences(yamlText)

  return {
    version,
    gaDate: null,
    productLayer: true,
    displayName: deriveDisplayName(version),
    exceptions: {
      policy: {
        configExcludes,
        volatileExcludes
      }
    },
    ruleData: {
      allowedRpmSignatureKeys: ruleData.allowed_rpm_signature_keys || [],
      allowedRegistryPrefixes: ruleData.allowed_registry_prefixes || [],
      disallowedPlatformPatterns: ruleData.disallowed_platform_patterns || []
    },
    jiraReferences: jiraRefs
  }
}

async function fetchAipccConforma(storage) {
  const config = await getConfig(storage.readFromStorage)
  const ecpBase = (config.conformaEcpBaseUrl || '').replace(/\/+$/, '')
  if (!ecpBase) {
    return { releases: [], errors: [{ file: '*', error: 'conformaEcpBaseUrl not configured — set it in Releases > Deliver settings' }] }
  }
  const releases = []
  const errors = []

  const results = await Promise.allSettled(AIPCC_FILES.map(async (filename) => {
    const url = `${ecpBase}/${filename}`
    const res = await _fetch(url, { signal: AbortSignal.timeout(30000) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const text = await res.text()
    const doc = yaml.load(text)
    if (!doc || !doc.metadata) throw new Error('Invalid YAML structure')
    return { filename, release: transformEcpToRelease(doc, text) }
  }))

  for (let i = 0; i < results.length; i++) {
    const r = results[i]
    if (r.status === 'fulfilled') {
      releases.push(r.value.release)
    } else {
      errors.push({ file: AIPCC_FILES[i], error: r.reason?.message || String(r.reason) })
    }
  }

  return { releases, errors }
}

function registerConformaFetcher(router, context) {
  const { storage, requireAdmin, requireScope } = context
  const { writeToStorage } = storage

  async function runFetch() {
    const { releases, errors } = await fetchAipccConforma(storage)
    if (releases.length === 0 && errors.length > 0) {
      return { status: 'error', message: 'All fetches failed', errors }
    }

    const savedAt = new Date().toISOString()
    await writeToStorage(STORAGE_KEY, {
      fetchedAt: savedAt,
      count: releases.length,
      releases
    })

    return { status: 'ok', count: releases.length, savedAt, errors: errors.length ? errors : undefined }
  }

  /**
   * @openapi
   * /api/modules/releases/delivery/conforma/fetch-aipcc:
   *   post:
   *     summary: Trigger AIPCC conforma data fetch from ECP YAMLs (admin only)
   *     tags: [Releases - Delivery]
   *     responses:
   *       200:
   *         description: Fetch results
   */
  router.post('/conforma/fetch-aipcc', requireAdmin, requireScope('releases:write'), async function (req, res) {
    if (process.env.DEMO_MODE === 'true') {
      return res.json({ status: 'skipped', message: 'Fetch disabled in demo mode.' })
    }
    try {
      const result = await runFetch()
      res.json(result)
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  if (context.registerRefresh) {
    context.registerRefresh('conforma-aipcc', {
      order: 80,
      cadence: '12h',
      timeout: 120000,
      description: 'Fetches AIPCC Enterprise Contract Policy YAMLs from konflux-release-data and updates conforma data.',
      handler: async function () {
        if (process.env.DEMO_MODE === 'true') {
          return { status: 'skipped', message: 'Fetch disabled in demo mode' }
        }
        return runFetch()
      }
    })
  }
}

module.exports = { registerConformaFetcher, fetchAipccConforma, transformEcpToRelease, deriveVersion, extractJiraReferences, STORAGE_KEY, AIPCC_FILES, _setFetch: fn => { _fetch = fn } }
