#!/usr/bin/env node

/**
 * Auto-generates platform/view-owners/owners.js from git history.
 *
 * Scans all module client/index.js route maps, report registry files,
 * platform view extensions, and sub-tab definitions, then runs
 * `git log --diff-filter=A` on each component file to discover the
 * original author.
 *
 * Usage:
 *   node scripts/update-view-owners.js          # regenerate owners.js
 *   node scripts/update-view-owners.js --check  # exit 1 if file is stale
 *
 * Wired into .husky/pre-commit so new views/reports are captured
 * automatically on commit.
 */

const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const ROOT = path.resolve(__dirname, '..')
const OUTPUT = path.join(ROOT, 'platform', 'view-owners', 'owners.js')
const OVERRIDES_FILE = path.join(ROOT, 'data', 'view-owner-overrides.json')

// ─── Load admin overrides from data/view-owner-overrides.json ───

function loadAdminOverrides() {
  try {
    if (fs.existsSync(OVERRIDES_FILE)) {
      return JSON.parse(fs.readFileSync(OVERRIDES_FILE, 'utf-8')) || {}
    }
  } catch { /* missing or malformed file */ }
  return {}
}

// ─── Parse existing owners.js to use as fallback ───

function parseExistingOwners() {
  if (!fs.existsSync(OUTPUT)) return {}
  const src = fs.readFileSync(OUTPUT, 'utf-8')
  const map = {}
  const re = /'([^']+)':\s*'([^']+)'/g
  let m
  while ((m = re.exec(src)) !== null) {
    map[m[1]] = m[2]
  }
  return map
}

// ─── 1. Discover view routes from modules/*/client/index.js ───

function discoverRoutes() {
  const modulesDir = path.join(ROOT, 'modules')
  const entries = []

  for (const slug of fs.readdirSync(modulesDir).sort()) {
    const indexPath = path.join(modulesDir, slug, 'client', 'index.js')
    if (!fs.existsSync(indexPath)) continue
    const src = fs.readFileSync(indexPath, 'utf-8')
    const dir = path.dirname(indexPath)

    const varImports = {}
    const varRe = /(?:const|let|var)\s+(\w+)\s*=\s*defineAsyncComponent\(\(\)\s*=>\s*import\('([^']+)'\)\)/g
    let vm
    while ((vm = varRe.exec(src)) !== null) {
      varImports[vm[1]] = path.resolve(dir, vm[2])
    }

    const inlineRe = /'([^']+)':\s*defineAsyncComponent\(\(\)\s*=>\s*import\('([^']+)'\)\)/g
    let m
    while ((m = inlineRe.exec(src)) !== null) {
      const filePath = path.resolve(dir, m[2])
      entries.push({ key: `${slug}/${m[1]}`, file: toRelative(filePath), section: slug })
    }

    const refRe = /'([^']+)':\s*(\w+)\s*[,}]/g
    while ((m = refRe.exec(src)) !== null) {
      if (entries.some(e => e.key === `${slug}/${m[1]}`)) continue
      const varPath = varImports[m[2]]
      if (varPath) {
        entries.push({ key: `${slug}/${m[1]}`, file: toRelative(varPath), section: slug })
      }
    }
  }
  return entries
}

// ─── 2. Discover platform view extensions ───

function discoverPlatformViews() {
  const platformDir = path.join(ROOT, 'platform')
  const entries = []
  if (!fs.existsSync(platformDir)) return entries

  for (const ext of fs.readdirSync(platformDir).sort()) {
    const manifestPath = path.join(platformDir, ext, 'manifest.json')
    if (!fs.existsSync(manifestPath)) continue
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
      if (manifest.type !== 'module-views' || !manifest.client?.views) continue
      const targetModule = manifest.targetModule
      for (const [viewId, viewPath] of Object.entries(manifest.client.views)) {
        const filePath = path.resolve(path.dirname(manifestPath), viewPath)
        const rel = toRelative(filePath)
        entries.push({ key: `${targetModule}/${viewId}`, file: rel, section: targetModule })
      }
    } catch { /* skip malformed manifests */ }
  }
  return entries
}

// ─── 3. Discover reports from modules/*/client/reports/registry.js ───

function discoverReports() {
  const modulesDir = path.join(ROOT, 'modules')
  const entries = []

  for (const slug of fs.readdirSync(modulesDir).sort()) {
    const regPath = path.join(modulesDir, slug, 'client', 'reports', 'registry.js')
    if (!fs.existsSync(regPath)) continue
    const src = fs.readFileSync(regPath, 'utf-8')
    const dir = path.dirname(regPath)

    const blocks = src.split(/(?=\bid:\s*')/)

    for (const block of blocks) {
      const idMatch = block.match(/\bid:\s*'([^']+)'/)
      if (!idMatch) continue
      const reportId = idMatch[1]

      const importMatch = block.match(/import\('([^']+)'\)/)
      let file = null
      if (importMatch) {
        const filePath = path.resolve(dir, importMatch[1])
        file = toRelative(filePath)
      }

      entries.push({
        key: `${slug}/reports/${reportId}`,
        file,
        section: `${slug} > reports`
      })
    }
  }
  return entries
}

// ─── 4. Discover sub-tabs dynamically from all route view files ───

function discoverTabs() {
  const modulesDir = path.join(ROOT, 'modules')
  const entries = []

  for (const slug of fs.readdirSync(modulesDir).sort()) {
    const indexPath = path.join(modulesDir, slug, 'client', 'index.js')
    if (!fs.existsSync(indexPath)) continue
    const indexSrc = fs.readFileSync(indexPath, 'utf-8')
    const dir = path.dirname(indexPath)

    const viewFiles = []
    const importRe = /import\('([^']+\.vue)'\)/g
    let im
    while ((im = importRe.exec(indexSrc)) !== null) {
      viewFiles.push(im[1])
    }

    const routeIdRe = /'([^']+)':\s*(?:defineAsyncComponent|(\w+))\s*(?:\(|[,}])/g
    const routeIds = []
    let rm
    while ((rm = routeIdRe.exec(indexSrc)) !== null) {
      routeIds.push(rm[1])
    }

    for (let i = 0; i < viewFiles.length; i++) {
      const viewFile = path.resolve(dir, viewFiles[i])
      if (!fs.existsSync(viewFile)) continue
      const src = fs.readFileSync(viewFile, 'utf-8')

      const tabIds = extractTabIds(src)
      if (tabIds.length === 0) continue

      const viewId = routeIds[i] || path.basename(viewFile, '.vue').replace(/View$/, '').toLowerCase()
      const tabComponentMap = resolveTabComponents(src, path.dirname(viewFile))

      for (const tabId of tabIds) {
        entries.push({
          key: `${slug}/${viewId}/${tabId}`,
          file: tabComponentMap[tabId] || null,
          section: `${slug} > ${viewId}`
        })
      }
    }

    discoverTabsFromNonInlineViews(slug, indexSrc, dir, entries)
  }
  return entries
}

function discoverTabsFromNonInlineViews(slug, indexSrc, dir, entries) {
  const varRe = /(?:const|let|var)\s+(\w+)\s*=\s*defineAsyncComponent\(\(\)\s*=>\s*import\('([^']+\.vue)'\)\)/g
  const varViews = {}
  let vm
  while ((vm = varRe.exec(indexSrc)) !== null) {
    varViews[vm[1]] = path.resolve(dir, vm[2])
  }

  const refRe = /'([^']+)':\s*(\w+)\s*[,}]/g
  let rm
  while ((rm = refRe.exec(indexSrc)) !== null) {
    const viewId = rm[1]
    const varName = rm[2]
    if (!varViews[varName]) continue
    if (entries.some(e => e.key.startsWith(`${slug}/${viewId}/`))) continue

    const viewFile = varViews[varName]
    if (!fs.existsSync(viewFile)) continue
    const src = fs.readFileSync(viewFile, 'utf-8')
    const tabIds = extractTabIds(src)
    if (tabIds.length === 0) continue

    const tabComponentMap = resolveTabComponents(src, path.dirname(viewFile))
    for (const tabId of tabIds) {
      entries.push({
        key: `${slug}/${viewId}/${tabId}`,
        file: tabComponentMap[tabId] || null,
        section: `${slug} > ${viewId}`
      })
    }
  }
}

function extractTabIds(src) {
  const ids = []
  const re = /(?:const|var|let)\s+\w*[Tt][Aa][Bb][Ss]?\w*\s*=\s*\[([\s\S]*?)\]/gm
  let block
  while ((block = re.exec(src)) !== null) {
    const idRe = /id:\s*'([^']+)'/g
    let m
    while ((m = idRe.exec(block[1])) !== null) {
      if (!ids.includes(m[1])) ids.push(m[1])
    }
  }

  if (ids.length === 0) {
    const hardcoded = src.match(/(?:tab\s*===\s*'([^']+)')/g)
    if (hardcoded && hardcoded.length >= 3) {
      for (const match of hardcoded) {
        const id = match.match(/'([^']+)'/)[1]
        if (!ids.includes(id)) ids.push(id)
      }
      const defaultMatch = src.match(/return\s+'([^']+)'/)
      if (defaultMatch && !ids.includes(defaultMatch[1])) {
        ids.unshift(defaultMatch[1])
      }
    }
  }
  return ids
}

function resolveTabComponents(src, dir) {
  const map = {}

  const compMapBlock = src.match(/const\s+componentMap\s*=\s*\{([\s\S]*?)\}/m)
  if (compMapBlock) {
    const mapRe = /'([^']+)':\s*(\w+)/g
    let m
    while ((m = mapRe.exec(compMapBlock[1])) !== null) {
      const file = resolveImportedComponent(src, m[2], dir)
      if (file) map[m[1]] = file
    }
    return map
  }

  const condRe = /(?:v-if|v-else-if)="activeTab\s*===\s*'([^']+)'"[\s\S]*?<(\w+)/g
  let m
  while ((m = condRe.exec(src)) !== null) {
    const tabId = m[1]
    const compName = m[2]
    if (compName[0] !== compName[0].toUpperCase()) continue
    const file = resolveImportedComponent(src, compName, dir)
    if (file) map[tabId] = file
  }

  return map
}

function resolveImportedComponent(src, componentName, dir) {
  const importRe = new RegExp(`import\\s+${componentName}\\s+from\\s+'([^']+)'`)
  const m = importRe.exec(src)
  if (!m) return null
  let filePath = path.resolve(dir, m[1])
  if (!filePath.endsWith('.vue')) filePath += '.vue'
  return toRelative(filePath)
}

function toRelative(absPath) {
  return path.relative(ROOT, absPath)
}

// ─── 5. Git author lookup (name only, email not persisted) ───

function getGitAuthor(relFile) {
  if (!relFile) return null

  const absFile = path.join(ROOT, relFile)
  if (!fs.existsSync(absFile)) return null

  let result = gitLogAuthor(relFile)
  if (result) return result

  try {
    const realPath = fs.realpathSync(absFile)
    const realRel = path.relative(ROOT, realPath)
    if (realRel !== relFile) {
      result = gitLogAuthor(realRel)
    }
  } catch { /* symlink resolution failed */ }

  return result
}

function gitLogAuthor(relFile) {
  try {
    const out = execFileSync(
      'git',
      ['log', '--diff-filter=A', '--format=%an', '--follow', '--', relFile],
      { cwd: ROOT, encoding: 'utf-8', timeout: 10000 }
    ).trim()
    if (!out) return null
    return out.split('\n').pop()
  } catch { /* git not available or file never committed */ }
  return null
}

// ─── 6. Generate owners.js ───

function generateFile(allEntries) {
  const lines = []
  lines.push('/**')
  lines.push(' * Centralized view-to-owner mapping, auto-populated from git history.')
  lines.push(' *')
  lines.push(' * DO NOT EDIT MANUALLY — regenerated by scripts/update-view-owners.js')
  lines.push(' * Run: npm run update:view-owners')
  lines.push(' *')
  lines.push(' * Each key is "moduleSlug/viewId" and the value is the display name of the')
  lines.push(' * person who first introduced that view\'s component file.')
  lines.push(' *')
  lines.push(' * This mapping is also consumed by the org-pulse chatbot integration.')
  lines.push(' * Admin overrides from data/view-owner-overrides.json are merged in during generation.')
  lines.push(' */')
  lines.push('export const viewOwners = {')

  const withAuthor = allEntries.filter(e => e.author)

  const viewEntries = withAuthor.filter(e => e.key.split('/').length === 2)
  const subEntries = withAuthor.filter(e => e.key.split('/').length === 3)

  const tabEntries = subEntries.filter(e => !e.section.includes('reports'))
  const reportEntries = subEntries.filter(e => e.section.includes('reports'))

  writeSection(lines, viewEntries, false)

  if (tabEntries.length > 0) {
    lines.push('')
    lines.push('  // ── Sub-tab owners (module/view/tab) ──')
    lines.push('  // These override the view-level owner when a specific tab is active.')
    writeSection(lines, tabEntries, true)
  }

  if (reportEntries.length > 0) {
    lines.push('')
    lines.push('  // ── Report owners (module/view/reportId) ──')
    lines.push('  // These override the view-level owner when a specific report is selected.')
    writeSection(lines, reportEntries, true)
  }

  lines.push('}')
  lines.push('')
  lines.push('/**')
  lines.push(' * Look up the owner of a view, with optional sub-view granularity.')
  lines.push(' * Supports both ?tab= and ?report= query params as sub-view identifiers.')
  lines.push(' * Resolution order: sub-view-specific override > sub-view-specific default >')
  lines.push(' *                   view-level override > view-level default.')
  lines.push(' * @param {string} moduleSlug')
  lines.push(' * @param {string} viewId')
  lines.push(' * @param {Object} [overrides] - Admin overrides from view-owner-overrides.json')
  lines.push(' * @param {string} [subView] - Active sub-view id (tab or report from query params)')
  lines.push(' * @returns {string | null} Display name of the owner')
  lines.push(' */')
  lines.push('export function getViewOwner(moduleSlug, viewId, overrides = {}, subView = null) {')
  lines.push('  const viewKey = `${moduleSlug}/${viewId}`')
  lines.push('  if (subView) {')
  lines.push('    const subKey = `${viewKey}/${subView}`')
  lines.push('    if (overrides[subKey]) return overrides[subKey]')
  lines.push('    if (viewOwners[subKey]) return viewOwners[subKey]')
  lines.push('  }')
  lines.push('  return overrides[viewKey] || viewOwners[viewKey] || null')
  lines.push('}')
  lines.push('')

  return lines.join('\n')
}

function writeSection(lines, entries, isSub) {
  let lastSection = null
  const sorted = [...entries].sort((a, b) => {
    const sa = sectionOrder(a.section)
    const sb = sectionOrder(b.section)
    if (sa !== sb) return sa - sb
    return a.key.localeCompare(b.key)
  })

  for (const entry of sorted) {
    if (entry.section !== lastSection) {
      if (lastSection !== null || isSub) lines.push('')
      lines.push(`  // ${entry.section}`)
      lastSection = entry.section
    }

    const keyPad = padKey(entry.key)
    lines.push(`  '${entry.key}':${keyPad}'${esc(entry.author)}',`)
  }
}

const MODULE_ORDER = [
  'ai-catalyst', 'ai-impact', 'customer-insights', 'okr-hub',
  'pm-pipeline', 'product-builds', 'releases', 'system-health',
  'team-tracker', 'upstream-pulse'
]

function sectionOrder(s) {
  for (let i = 0; i < MODULE_ORDER.length; i++) {
    if (s === MODULE_ORDER[i]) return i * 100
    if (s.startsWith(MODULE_ORDER[i])) return i * 100 + 50
  }
  return 9999
}

function padKey(key) {
  const target = 50
  const used = key.length + 4
  const spaces = Math.max(1, target - used)
  return ' '.repeat(spaces)
}

function esc(s) {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

// ─── Main ───

function main() {
  const checkOnly = process.argv.includes('--check')

  console.log('[view-owners] Scanning modules for views, reports, and tabs...')

  const views = discoverRoutes()
  const platformViews = discoverPlatformViews()
  const reports = discoverReports()
  const tabs = discoverTabs()

  const all = [...views, ...platformViews, ...tabs, ...reports]

  console.log(`[view-owners] Found ${views.length} views, ${platformViews.length} platform views, ${tabs.length} tabs, ${reports.length} reports`)
  console.log('[view-owners] Looking up git authors...')

  const existing = parseExistingOwners()
  const adminOverrides = loadAdminOverrides()
  const adminOverrideCount = Object.keys(adminOverrides).length
  let fallbackCount = 0

  for (const entry of all) {
    if (adminOverrides[entry.key]) {
      const override = adminOverrides[entry.key]
      entry.author = typeof override === 'string' ? override : override.name
    } else {
      entry.author = getGitAuthor(entry.file)
      if (!entry.author && existing[entry.key]) {
        entry.author = existing[entry.key]
        fallbackCount++
      }
    }
  }

  const resolvedCount = all.filter(e => e.author).length
  const unresolvedCount = all.length - resolvedCount

  if (adminOverrideCount > 0) {
    console.log(`[view-owners] ${adminOverrideCount} admin overrides applied`)
  }

  if (fallbackCount > 0) {
    console.log(`[view-owners] ${fallbackCount} entries preserved from existing owners.js`)
  }

  if (unresolvedCount > 0) {
    console.log(`[view-owners] ${unresolvedCount} entries have no author (external URL or uncommitted)`)
  }

  const content = generateFile(all)

  if (checkOnly) {
    const existingContent = fs.existsSync(OUTPUT) ? fs.readFileSync(OUTPUT, 'utf-8') : ''
    if (content !== existingContent) {
      console.error('[view-owners] owners.js is stale. Run: npm run update:view-owners')
      process.exit(1)
    }
    console.log('[view-owners] owners.js is up to date.')
    return
  }

  const existingContent = fs.existsSync(OUTPUT) ? fs.readFileSync(OUTPUT, 'utf-8') : ''
  if (content === existingContent) {
    console.log('[view-owners] owners.js is already up to date.')
    return
  }

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true })
  fs.writeFileSync(OUTPUT, content, 'utf-8')
  console.log(`[view-owners] Updated ${path.relative(ROOT, OUTPUT)} (${resolvedCount} entries)`)

  try {
    execFileSync('git', ['add', path.relative(ROOT, OUTPUT)], { cwd: ROOT })
    console.log('[view-owners] \u26a0\ufe0f  Auto-staged owners.js — it was regenerated with updated view ownership data.')
  } catch { /* not in a git context */ }
}

main()
