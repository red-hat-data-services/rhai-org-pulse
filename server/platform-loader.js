/**
 * Server-side platform extension discovery.
 *
 * Extends the platform/ directory pattern (established for frontend-only
 * extensions like about-tabs) to support server-side hooks. Currently
 * supports allocation strategy discovery.
 */

const fs = require('fs')
const path = require('path')

const DEFAULT_PLATFORM_DIR = path.join(__dirname, '..', 'platform')

/**
 * Load the allocation strategy from platform/allocation-strategy/.
 * Searches multiple platform directories if provided (first-found wins).
 * @param {string|string[]} [platformDirs] - Single directory or array of directories to search.
 * Returns a frozen strategy object or null if not present.
 */
function loadAllocationStrategy(platformDirs) {
  const dirs = platformDirs
    ? (Array.isArray(platformDirs) ? platformDirs : [platformDirs])
    : [DEFAULT_PLATFORM_DIR]

  for (const platformDir of dirs) {
    const strategyDir = path.join(platformDir, 'allocation-strategy')
    const manifestPath = path.join(strategyDir, 'manifest.json')

    if (!fs.existsSync(manifestPath)) continue

    let manifest
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
    } catch (err) {
      console.error('[platform-loader] Failed to parse allocation-strategy manifest:', err.message)
      return null
    }

    if (!manifest.classify) {
      console.error('[platform-loader] allocation-strategy manifest missing "classify" field')
      return null
    }

    const classifyFile = manifest.classify.replace(/^\.\//, '')
    const classifyPath = path.join(strategyDir, classifyFile)

    // Validate the classify path doesn't escape the strategy directory
    const resolved = path.resolve(classifyPath)
    if (!resolved.startsWith(strategyDir + path.sep) && resolved !== strategyDir) {
      console.error('[platform-loader] classify path escapes strategy directory')
      return null
    }

    if (!fs.existsSync(classifyPath)) {
      console.error(`[platform-loader] classify file not found: ${classifyPath}`)
      return null
    }

    let classifier
    try {
      classifier = require(classifyPath)
    } catch (err) {
      console.error('[platform-loader] Failed to load classify module:', err.message)
      return null
    }

    if (typeof classifier.classifyIssue !== 'function') {
      console.error('[platform-loader] classify module must export classifyIssue()')
      return null
    }

    return Object.freeze({
      id: manifest.id,
      name: manifest.name,
      description: manifest.description || '',
      categories: Object.freeze(manifest.categories.map(c => Object.freeze({ ...c }))),
      classifyIssue: classifier.classifyIssue,
      getJiraFields: typeof classifier.getJiraFields === 'function' ? classifier.getJiraFields : null
    })
  }

  return null
}

module.exports = { loadAllocationStrategy }
