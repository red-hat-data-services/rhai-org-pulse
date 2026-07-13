import fs from 'fs'
import path from 'path'
import { glob } from 'glob'

const VIRTUAL_ID = 'virtual:nav-discovery'
const RESOLVED_ID = '\0' + VIRTUAL_ID

/**
 * Vite plugin that auto-discovers tabs and reports from module source files.
 * Scans Vue view files for tab arrays and report registries for report entries,
 * then serves them as a virtual module for the command palette.
 */
export default function navDiscovery() {
  let modulesDir
  let cachedResult = null

  function invalidate() {
    cachedResult = null
  }

  // Phase A: Build module metadata from module.json files
  function buildModuleMap() {
    const moduleMap = new Map()
    const manifests = glob.sync('modules/*/module.json', { cwd: modulesDir, absolute: true })

    for (const manifestPath of manifests) {
      try {
        const raw = fs.readFileSync(manifestPath, 'utf-8')
        const manifest = JSON.parse(raw)
        const slug = manifest.slug || path.basename(path.dirname(manifestPath))
        const name = manifest.name || slug
        const navItems = manifest.client?.navItems || []
        const hiddenRoutes = manifest.hiddenRoutes || {}

        const navItemLabels = {}
        for (const item of navItems) {
          if (item.id && item.label) {
            navItemLabels[item.id] = item.label
          }
        }

        moduleMap.set(slug, {
          name,
          navItemLabels,
          hiddenViewIds: new Set(Object.keys(hiddenRoutes)),
          dir: path.dirname(manifestPath)
        })
      } catch {
        // skip malformed manifests
      }
    }
    return moduleMap
  }

  // Phase B: Build filename → [viewId, ...] map from client/index.js
  function buildRouteMap(moduleDir) {
    const indexPath = path.join(moduleDir, 'client', 'index.js')
    if (!fs.existsSync(indexPath)) return new Map()

    const content = fs.readFileSync(indexPath, 'utf-8')
    const filenameToViewIds = new Map()

    // Pass 1: find hoisted view imports
    // const VarName = defineAsyncComponent(() => import('./views/Filename.vue'))
    const hoisted = new Map()
    const hoistRegex = /const\s+(\w+)\s*=\s*defineAsyncComponent\(\(\)\s*=>\s*import\(\s*['"]\.\/views\/(\w+)\.vue['"]\s*\)\)/g
    let m
    while ((m = hoistRegex.exec(content)) !== null) {
      hoisted.set(m[1], m[2])
    }

    // Pass 2: parse route entries
    // 'viewId': defineAsyncComponent(() => import('./views/Filename.vue'))
    const inlineRegex = /['"]?([\w-]+)['"]?\s*:\s*defineAsyncComponent\(\(\)\s*=>\s*import\(\s*['"]\.\/views\/(\w+)\.vue['"]\s*\)\)/g
    while ((m = inlineRegex.exec(content)) !== null) {
      const viewId = m[1]
      const filename = m[2]
      if (!filenameToViewIds.has(filename)) filenameToViewIds.set(filename, [])
      filenameToViewIds.get(filename).push(viewId)
    }

    // 'viewId': VarName (hoisted reference)
    for (const [varName, filename] of hoisted) {
      const varRefRegex = new RegExp("['\"]([\\w-]+)['\"]\\s*:\\s*" + varName + '\\b', 'g')
      while ((m = varRefRegex.exec(content)) !== null) {
        const viewId = m[1]
        if (!filenameToViewIds.has(filename)) filenameToViewIds.set(filename, [])
        if (!filenameToViewIds.get(filename).includes(viewId)) {
          filenameToViewIds.get(filename).push(viewId)
        }
      }
    }

    return filenameToViewIds
  }

  // Phase C: Extract tabs from a Vue view file
  function extractTabs(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8')

    // Extract <script setup> or <script> block
    const scriptMatch = content.match(/<script[^>]*>([\s\S]*?)<\/script>/)
    if (!scriptMatch) return []

    const script = scriptMatch[1]
    const tabs = []

    // Find tab variable declarations: const/let/var <name containing Tab/tab/Tabs/tabs> =
    const tabVarRegex = /(?:const|let|var)\s+(\w*[Tt]abs?\w*)\s*=/g
    let varMatch
    while ((varMatch = tabVarRegex.exec(script)) !== null) {
      const startPos = varMatch.index + varMatch[0].length
      const block = extractBlock(script, startPos)
      if (!block) continue

      // Extract { id: '...', label: '...' } pairs from the block
      const itemRegex = /\{\s*id:\s*['"]([^'"]+)['"]\s*,\s*label:\s*['"]([^'"]+)['"]/g
      let itemMatch
      while ((itemMatch = itemRegex.exec(block)) !== null) {
        tabs.push({ id: itemMatch[1], label: itemMatch[2] })
      }
    }

    return tabs
  }

  // Extract block content using bracket counting from a start position
  function extractBlock(content, startPos) {
    let depth = 0
    let started = false
    const openers = new Set(['[', '(', '{'])
    const closers = new Set([']', ')', '}'])

    for (let i = startPos; i < content.length; i++) {
      const ch = content[i]
      if (openers.has(ch)) {
        depth++
        started = true
      }
      if (closers.has(ch)) {
        depth--
        if (started && depth === 0) {
          return content.slice(startPos, i + 1)
        }
      }
    }
    return null
  }

  // Phase D: Extract reports from a registry file
  function extractReports(filePath) {
    if (!fs.existsSync(filePath)) return []

    const content = fs.readFileSync(filePath, 'utf-8')
    const reports = []

    // Split into individual object blocks to check for externalUrl
    const objectRegex = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g
    let objMatch
    while ((objMatch = objectRegex.exec(content)) !== null) {
      const block = objMatch[0]

      // Skip entries with externalUrl
      if (/externalUrl\s*:/.test(block)) continue

      // Extract id
      const idMatch = block.match(/id:\s*['"]([^'"]+)['"]/)
      if (!idMatch) continue

      // Extract label or title
      const labelMatch = block.match(/(?:label|title):\s*['"]([^'"]+)['"]/)
      if (!labelMatch) continue

      reports.push({ id: idMatch[1], label: labelMatch[1] })
    }

    return reports
  }

  function discover() {
    if (cachedResult) return cachedResult

    const entries = []
    const moduleMap = buildModuleMap()

    for (const [slug, meta] of moduleMap) {
      const routeMap = buildRouteMap(meta.dir)

      // Phase C: Scan view files for tabs
      const viewsDir = path.join(meta.dir, 'client', 'views')
      if (fs.existsSync(viewsDir)) {
        const viewFiles = glob.sync('*View.vue', { cwd: viewsDir, absolute: true })
        // Also match files without View suffix (e.g., Dashboard.vue in upstream-pulse)
        const allVueFiles = glob.sync('*.vue', { cwd: viewsDir, absolute: true })
        const uniqueFiles = [...new Set([...viewFiles, ...allVueFiles])]

        for (const viewFile of uniqueFiles) {
          const filename = path.basename(viewFile, '.vue')
          const viewIds = routeMap.get(filename) || []

          // Filter out hidden routes
          const visibleViewIds = viewIds.filter(vid => !meta.hiddenViewIds.has(vid))
          if (visibleViewIds.length === 0) continue

          const tabs = extractTabs(viewFile)
          for (const tab of tabs) {
            for (const viewId of visibleViewIds) {
              const navLabel = meta.navItemLabels[viewId]
              if (!navLabel) continue

              entries.push({
                slug,
                viewId,
                label: tab.label,
                context: meta.name + ' → ' + navLabel,
                params: { tab: tab.id }
              })
            }
          }
        }
      }

      // Phase D: Scan report registries
      const reportPath = path.join(meta.dir, 'client', 'reports', 'registry.js')
      const reports = extractReports(reportPath)
      const reportsNavLabel = meta.navItemLabels['reports']
      if (reportsNavLabel && reports.length > 0) {
        for (const report of reports) {
          entries.push({
            slug,
            viewId: 'reports',
            label: report.label,
            context: meta.name + ' → ' + reportsNavLabel,
            params: { report: report.id }
          })
        }
      }
    }

    cachedResult = entries
    return entries
  }

  return {
    name: 'nav-discovery',

    configResolved(config) {
      modulesDir = config.root
    },

    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID
    },

    load(id) {
      if (id === RESOLVED_ID) {
        const entries = discover()
        return 'export default ' + JSON.stringify(entries)
      }
    },

    handleHotUpdate({ file, server }) {
      if (!file.includes('/modules/')) return

      const isRelevant =
        file.endsWith('View.vue') ||
        file.endsWith('.vue') && file.includes('/views/') ||
        file.endsWith('module.json') ||
        file.endsWith('client/index.js') ||
        file.includes('/reports/registry.js')

      if (isRelevant) {
        invalidate()
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID)
        if (mod) {
          server.moduleGraph.invalidateModule(mod)
          server.ws.send({ type: 'full-reload' })
        }
      }
    }
  }
}
