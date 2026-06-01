/**
 * Refresh registry — ordered execution of module refresh handlers.
 *
 * Handlers at the same order run in parallel (Promise.allSettled),
 * then the next order group starts. Global mutex prevents concurrent
 * runAll() calls. Progress is tracked per-handler during execution.
 *
 * @module shared/server/refresh-registry
 */

const DEFAULT_ORDER = 100
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

const STORAGE_KEY = 'refresh-registry-state.json'

/**
 * @param {object} [storage] - Optional storage with readFromStorage/writeToStorage for persistence
 */
function createRefreshRegistry(storage) {
  const entries = new Map()
  let running = false
  /** @type {object|null} */
  let lastRun = storage ? storage.readFromStorage(STORAGE_KEY) : null
  /** @type {object} */
  let progress = {}

  function persistLastRun() {
    if (storage && lastRun) {
      try {
        // Strip result values (may be large/non-serializable), keep state + timestamps
        var persistable = {
          completedAt: lastRun.completedAt,
          progress: {}
        }
        for (var key in lastRun.progress) {
          var h = lastRun.progress[key]
          persistable.progress[key] = {
            state: h.state,
            order: h.order,
            completedAt: h.completedAt,
            error: h.error
          }
        }
        storage.writeToStorage(STORAGE_KEY, persistable)
      } catch (e) {
        console.error('[refresh-registry] Failed to persist state:', e.message)
      }
    }
  }

  function register(id, config) {
    if (typeof config.handler !== 'function') {
      console.warn('[refresh-registry] Handler for "' + id + '" is not a function, skipping')
      return
    }
    entries.set(id, {
      handler: config.handler,
      status: typeof config.status === 'function' ? config.status : null,
      order: typeof config.order === 'number' ? config.order : DEFAULT_ORDER,
      timeout: typeof config.timeout === 'number' ? config.timeout : null
    })
  }

  function get(id) {
    return entries.get(id) || null
  }

  function getAll() {
    return Object.fromEntries(entries)
  }

  /**
   * Run a single handler with its effective timeout.
   * @param {string} id
   * @param {object} config
   * @param {number} fallbackTimeout
   * @param {object} options - passed through to handler
   * @returns {Promise<{id: string, success: boolean, result?: *, error?: string}>}
   */
  function runHandler(id, config, fallbackTimeout, options) {
    const effectiveTimeout = config.timeout != null ? config.timeout : fallbackTimeout
    progress[id] = { state: 'running', order: config.order, startedAt: Date.now() }

    let timer
    return Promise.race([
      config.handler(options),
      new Promise(function (_, reject) {
        timer = setTimeout(function () {
          reject(new Error('Refresh "' + id + '" timed out after ' + effectiveTimeout + 'ms'))
        }, effectiveTimeout)
      })
    ]).then(function (result) {
      clearTimeout(timer)
      progress[id] = { state: 'completed', order: config.order, completedAt: Date.now(), result }
      return { id, success: true, result }
    }).catch(function (err) {
      clearTimeout(timer)
      console.error('[refresh-registry] "' + id + '" failed:', err.message)
      progress[id] = { state: 'failed', order: config.order, completedAt: Date.now(), error: err.message }
      return { id, success: false, error: err.message }
    })
  }

  /**
   * Run a filtered set of handlers grouped by order.
   * @param {Array<[string, object]>} handlerEntries - [id, config] pairs to run
   * @param {object} options - passed through to handlers
   * @returns {Promise<object>} results keyed by handler id
   */
  async function runEntries(handlerEntries, options) {
    const fallbackTimeout = options.timeout || DEFAULT_TIMEOUT_MS

    const sorted = handlerEntries.slice().sort(function (a, b) {
      return a[1].order - b[1].order
    })

    for (const [id, config] of sorted) {
      progress[id] = { state: 'pending', order: config.order }
    }

    // Group by order value
    const groups = []
    let currentOrder = null
    let currentGroup = null
    for (const [id, config] of sorted) {
      if (config.order !== currentOrder) {
        currentOrder = config.order
        currentGroup = []
        groups.push(currentGroup)
      }
      currentGroup.push([id, config])
    }

    const results = {}
    for (const group of groups) {
      const promises = group.map(function ([id, config]) {
        return runHandler(id, config, fallbackTimeout, options)
      })
      const settled = await Promise.allSettled(promises)
      for (const outcome of settled) {
        const val = outcome.value
        results[val.id] = val.success
          ? { success: true, result: val.result }
          : { success: false, error: val.error }
      }
    }

    return results
  }

  async function runAll(options = {}) {
    if (running) {
      throw new Error('Refresh is already running')
    }
    running = true
    progress = {}

    try {
      const all = Array.from(entries.entries())
      const results = await runEntries(all, options)
      return results
    } finally {
      running = false
      lastRun = {
        completedAt: Date.now(),
        progress: { ...progress },
        results: {}
      }
      persistLastRun()
    }
  }

  async function runModule(slug, options = {}) {
    if (running) {
      throw new Error('Refresh is already running')
    }
    const prefix = slug + ':'
    const moduleEntries = Array.from(entries.entries()).filter(function ([id]) {
      return id.startsWith(prefix)
    })
    if (moduleEntries.length === 0) {
      throw new Error('No handlers registered for module "' + slug + '"')
    }
    running = true
    progress = {}

    try {
      const results = await runEntries(moduleEntries, options)
      return results
    } finally {
      running = false
      // Build baseline: previous lastRun progress, or registered-but-never-run stubs
      var baseline = {}
      if (lastRun) {
        Object.assign(baseline, lastRun.progress)
      } else {
        for (var [baseId, baseConfig] of entries) {
          baseline[baseId] = { registered: true, order: baseConfig.order }
        }
      }
      // Overlay this module's fresh progress onto the baseline
      lastRun = {
        completedAt: Date.now(),
        progress: Object.assign(baseline, progress),
        results: {}
      }
      persistLastRun()
    }
  }

  async function getStatus() {
    if (running) {
      // Build baseline from previous run or registered stubs, then overlay current progress
      var baseline = {}
      if (lastRun) {
        Object.assign(baseline, lastRun.progress)
      } else {
        for (var [baseId, baseConfig] of entries) {
          baseline[baseId] = { registered: true, order: baseConfig.order }
        }
      }
      return {
        running: true,
        handlers: Object.assign(baseline, progress)
      }
    }

    if (lastRun) {
      return {
        running: false,
        completedAt: lastRun.completedAt,
        handlers: lastRun.progress
      }
    }

    // Legacy behavior: return per-handler status from status functions
    const status = {}
    for (const [id, config] of entries) {
      if (config.status) {
        try {
          const s = await config.status()
          status[id] = { ...s, order: config.order }
        } catch (err) {
          status[id] = { error: err.message, order: config.order }
        }
      } else {
        status[id] = { registered: true, order: config.order }
      }
    }
    return {
      running: false,
      handlers: status
    }
  }

  function isRunning() {
    return running
  }

  return { register, get, getAll, runAll, runModule, getStatus, isRunning }
}

module.exports = { createRefreshRegistry }
