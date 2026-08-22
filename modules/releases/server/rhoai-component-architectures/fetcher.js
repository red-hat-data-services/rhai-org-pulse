'use strict'

const { Octokit } = require('@octokit/rest')
const yaml = require('js-yaml')

const STORAGE_KEY = 'releases/rhoai-component-architectures/latest.json'
const REGISTRY_KEY = 'releases/registry.json'
const OWNER = 'red-hat-data-services'
const REPO = 'konflux-central'
const REPORT_PATH = 'multi-arch-report.yaml'

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function stripRhelSuffix(name) {
  return name.replace(/-rhel\d+$/, '')
}

function registryIdToBranch(id) {
  const match = id.match(/^rh(?:oai|ai)-(\d+\.\d+)[.-]?(ea\d+|ga)?$/)
  if (!match) return null
  const version = match[1]
  const phase = match[2]
  if (!phase || phase === 'ga') return `rhoai-${version}`
  const eaNum = phase.replace('ea', '')
  return `rhoai-${version}-ea.${eaNum}`
}

function sortBranchesDesc(branches) {
  return [...branches].sort((a, b) => {
    const partsA = a.replace(/^rhoai-/, '').split(/[.-]/).map(Number)
    const partsB = b.replace(/^rhoai-/, '').split(/[.-]/).map(Number)
    for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
      const va = partsA[i] || 0
      const vb = partsB[i] || 0
      if (va !== vb) return vb - va
    }
    return 0
  })
}

const LEGACY_BRANCHES = ['rhoai-2.25', 'rhoai-3.3']

function branchesFromRegistry(registry) {
  const seen = new Set(LEGACY_BRANCHES)
  if (registry && Array.isArray(registry.releases)) {
    for (const release of registry.releases) {
      const branch = registryIdToBranch(release.id)
      if (branch) seen.add(branch)
    }
  }
  return sortBranchesDesc([...seen])
}

async function fetchBranchReport(octokit, branch) {
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner: OWNER,
      repo: REPO,
      path: REPORT_PATH,
      ref: branch
    })

    const content = Buffer.from(data.content, 'base64').toString('utf8')
    const report = yaml.load(content)

    report.components = (report.components || []).map(comp => {
      if (comp.imageName) {
        return comp
      }
      const originalName = comp.name
      return {
        ...comp,
        name: stripRhelSuffix(originalName),
        imageName: originalName,
        image: `quay.io/rhoai/${originalName}`
      }
    })

    report.reportAvailable = true
    return report
  } catch (err) {
    if (err.status === 404) {
      return { reportAvailable: false, components: [], summary: null }
    }
    throw err
  }
}

function registerRhoaiComponentArchitecturesFetcher(router, context) {
  const { storage, requireAuth, requireScope, secrets } = context
  const { readFromStorage, writeToStorage } = storage

  async function runFetch() {
    if (process.env.DEMO_MODE === 'true') {
      return { status: 'skipped', message: 'Fetch disabled in demo mode' }
    }

    const token = secrets && secrets.GITHUB_TOKEN
    if (!token) {
      return { status: 'error', message: 'No GITHUB_TOKEN configured' }
    }

    const octokit = new Octokit({ auth: token, request: { timeout: 30000 } })

    const registry = await readFromStorage(REGISTRY_KEY)
    const branches = branchesFromRegistry(registry)
    if (!branches.length) {
      return { status: 'error', message: 'No RHOAI releases found in the registry' }
    }

    const branchData = {}
    for (let i = 0; i < branches.length; i++) {
      const branch = branches[i]
      console.log(`[rhoai-component-architectures] Fetching report from ${branch} (${i + 1}/${branches.length})`)
      try {
        branchData[branch] = await fetchBranchReport(octokit, branch)
      } catch (err) {
        console.warn(`[rhoai-component-architectures] No report on ${branch}: ${err.message}`)
        branchData[branch] = { reportAvailable: false, components: [], summary: null }
      }
      if (i < branches.length - 1) await delay(200)
    }

    const fetchedAt = new Date().toISOString()
    const result = {
      fetchedAt,
      source: { owner: OWNER, repo: REPO },
      branches: branchData
    }

    await writeToStorage(STORAGE_KEY, result)

    return {
      status: 'ok',
      branches: Object.keys(branchData),
      fetchedAt
    }
  }

  /**
   * @openapi
   * /api/modules/releases/rhoai-component-architectures/refresh:
   *   post:
   *     summary: Trigger component architecture data refresh from GitHub
   *     tags: [Releases - RHOAI Component Architectures]
   *     responses:
   *       200:
   *         description: Refresh results
   */
  router.post('/refresh', requireAuth, requireScope('releases:write'), async function (req, res) {
    if (context.isRefreshRunning && context.isRefreshRunning()) {
      return res.json({ status: 'already_running', message: 'A refresh is already in progress' })
    }
    try {
      const result = await runFetch()
      res.json(result)
    } catch (err) {
      console.error('[rhoai-component-architectures] Refresh error:', err.message)
      res.status(500).json({ error: err.message })
    }
  })

  if (context.registerRefresh) {
    context.registerRefresh('rhoai-component-architectures', {
      order: 85,
      cadence: '24h',
      timeout: 300000,
      description: 'Fetches component architecture reports from konflux-central GitHub repo',
      handler: async function () {
        if (process.env.DEMO_MODE === 'true') {
          return { status: 'skipped', message: 'Fetch disabled in demo mode' }
        }
        return runFetch()
      }
    })
  }
}

module.exports = {
  registerRhoaiComponentArchitecturesFetcher,
  STORAGE_KEY,
  REGISTRY_KEY,
  registryIdToBranch,
  branchesFromRegistry,
  fetchBranchReport,
  stripRhelSuffix
}
