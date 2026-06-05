/**
 * Refresh registry — ordered execution of module refresh handlers
 * with per-handler cadence support.
 *
 * Handlers at the same order run in parallel (Promise.allSettled),
 * then the next order group starts. Global mutex prevents concurrent
 * runAll() calls. Progress is tracked per-handler during execution.
 *
 * Cadence: each handler declares a cadence (e.g. '12h', '24h').
 * runAll() skips handlers whose lastSuccessfulRun is too recent,
 * unless force: true is passed.
 *
 * @module shared/server/refresh-registry
 */

const DEFAULT_ORDER = 100
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes
const DEFAULT_CADENCE = '24h'
const MIN_CADENCE_MS = 60 * 1000 // 1 minute
const MIN_OVERRIDE_MS = 15 * 60 * 1000 // 15 minutes

const STORAGE_KEY = 'refresh-registry-state.json'
const OVERRIDES_KEY = 'refresh-cadence-overrides.json'

/**
 * Parse a cadence string to milliseconds.
 * Supported formats: '15m', '12h', '1d'.
 * @param {string} str
 * @returns {number} milliseconds
 * @throws {Error} on invalid format or zero/negative values
 */
function parseCadence(str) {
  if (typeof str !== 'string' || !str) {
    throw new Error('Invalid cadence: must be a non-empty string (e.g. "12h", "15m", "1d")')
  }
  const match = str.match(/^(\d+)(m|h|d)$/)
  if (!match) {
    throw new Error('Invalid cadence format "' + str + '": must match /^\\d+(m|h|d)$/ (e.g. "12h", "15m", "1d")')
  }
  const value = parseInt(match[1], 10)
  const unit = match[2]
  if (value <= 0) {
    throw new Error('Invalid cadence "' + str + '": value must be greater than zero')
  }
  var ms
  if (unit === 'm') ms = value * 60 * 1000
  else if (unit === 'h') ms = value * 60 * 60 * 1000
  else ms = value * 24 * 60 * 60 * 1000

  if (ms < MIN_CADENCE_MS) {
    throw new Error('Invalid cadence "' + str + '": minimum cadence is 1m')
  }
  return ms
}

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
  /** @type {object} cadence overrides from admin UI */
  let cadenceOverrides = {}

  // Load cadence overrides from storage
  if (storage) {
    var stored = storage.readFromStorage(OVERRIDES_KEY)
    if (stored && typeof stored === 'object') {
      cadenceOverrides = stored
    }
  }

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
            error: h.error,
            lastSuccessfulRun: h.lastSuccessfulRun,
            cadence: h.cadence,
            skippedAt: h.skippedAt
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
    var cadence = DEFAULT_CADENCE
    if (config.cadence !== undefined) {
      cadence = config.cadence
      parseCadence(cadence) // validate — throws on bad input
    }
    entries.set(id, {
      handler: config.handler,
      status: typeof config.status === 'function' ? config.status : null,
      order: typeof config.order === 'number' ? config.order : DEFAULT_ORDER,
      timeout: typeof config.timeout === 'number' ? config.timeout : null,
      cadence: cadence
    })
  }

  function get(id) {
    return entries.get(id) || null
  }

  function getAll() {
    return Object.fromEntries(entries)
  }

  /**
   * Get the effective cadence for a handler, considering admin overrides.
   * @param {string} id
   * @param {object} config
   * @returns {{ cadenceStr: string, cadenceMs: number }}
   */
  function getEffectiveCadence(id, config) {
    var overrideStr = cadenceOverrides[id] || null
    var cadenceStr = overrideStr || config.cadence || DEFAULT_CADENCE
    return { cadenceStr, cadenceMs: parseCadence(cadenceStr) }
  }

  /**
   * Check if a handler is due to run based on cadence.
   * @param {string} id
   * @param {object} config
   * @returns {{ isDue: boolean, nextDueAt: number|null }}
   */
  function checkCadence(id, config) {
    var { cadenceMs } = getEffectiveCadence(id, config)
    var lastSuccessful = getLastSuccessfulRun(id)
    var now = Date.now()

    // Missing or future timestamp → immediately due
    if (lastSuccessful == null || lastSuccessful > now) {
      return { isDue: true, nextDueAt: null }
    }

    var isDue = (now - lastSuccessful) >= cadenceMs
    var nextDueAt = lastSuccessful + cadenceMs
    return { isDue, nextDueAt }
  }

  /**
   * Get lastSuccessfulRun timestamp for a handler from persisted state.
   * @param {string} id
   * @returns {number|null}
   */
  function getLastSuccessfulRun(id) {
    if (lastRun && lastRun.progress && lastRun.progress[id]) {
      return lastRun.progress[id].lastSuccessfulRun || null
    }
    return null
  }

  /**
   * Filter handlers by cadence, partitioning into due and skipped lists.
   * @param {Array<[string, object]>} handlerEntries
   * @param {object} options
   * @returns {{ due: Array<[string, object]>, skipped: Array<{ id: string, nextDueAt: number|null }> }}
   */
  function filterByCadence(handlerEntries, options) {
    if (options.force) {
      return { due: handlerEntries, skipped: [] }
    }
    var due = []
    var skipped = []
    for (var [id, config] of handlerEntries) {
      var { isDue, nextDueAt } = checkCadence(id, config)
      if (isDue) {
        due.push([id, config])
      } else {
        skipped.push({ id, nextDueAt })
      }
    }
    return { due, skipped }
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
      var now = Date.now()
      progress[id] = {
        state: 'completed',
        order: config.order,
        completedAt: now,
        result,
        lastSuccessfulRun: now,
        cadence: config.cadence || DEFAULT_CADENCE
      }
      return { id, success: true, result }
    }).catch(function (err) {
      clearTimeout(timer)
      console.error('[refresh-registry] "' + id + '" failed:', err.message)
      progress[id] = {
        state: 'failed',
        order: config.order,
        completedAt: Date.now(),
        error: err.message,
        lastSuccessfulRun: getLastSuccessfulRun(id),
        cadence: config.cadence || DEFAULT_CADENCE
      }
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
      const { due, skipped } = filterByCadence(all, options)
      const counts = { total: all.length, due: due.length, skipped: skipped.length }

      // Mark skipped handlers in progress
      var now = Date.now()
      for (var skip of skipped) {
        var skipConfig = entries.get(skip.id)
        var { cadenceStr } = getEffectiveCadence(skip.id, skipConfig)
        progress[skip.id] = {
          state: 'skipped',
          reason: 'cadence',
          order: skipConfig.order,
          cadence: cadenceStr,
          lastSuccessfulRun: getLastSuccessfulRun(skip.id),
          skippedAt: now,
          nextDueAt: skip.nextDueAt
        }
      }

      if (due.length === 0) {
        // Nothing to run — resolve immediately
        running = false
        lastRun = {
          completedAt: Date.now(),
          progress: { ...progress },
          results: {}
        }
        persistLastRun()
        return { counts, results: {} }
      }

      // Return counts + a promise for background execution
      const execution = runEntries(due, options).then(function (results) {
        return results
      }).finally(function () {
        running = false
        lastRun = {
          completedAt: Date.now(),
          progress: { ...progress },
          results: {}
        }
        persistLastRun()
      })

      return { counts, execution }
    } catch (err) {
      running = false
      throw err
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
      // runModule ignores cadence — all handlers for the module run
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
      // Enrich handler data with cadence info
      var handlers = {}
      for (var id in lastRun.progress) {
        var h = lastRun.progress[id]
        var config = entries.get(id)
        var enriched = { ...h }
        if (config) {
          var { cadenceStr } = getEffectiveCadence(id, config)
          enriched.cadence = cadenceStr
          enriched.baseCadence = config.cadence || DEFAULT_CADENCE
          enriched.cadenceOverride = cadenceOverrides[id] || null
          if (enriched.lastSuccessfulRun) {
            enriched.nextDueAt = enriched.lastSuccessfulRun + parseCadence(cadenceStr)
          }
        }
        handlers[id] = enriched
      }
      return {
        running: false,
        completedAt: lastRun.completedAt,
        handlers: handlers
      }
    }

    // Legacy behavior: return per-handler status from status functions
    const status = {}
    for (const [id, config] of entries) {
      if (config.status) {
        try {
          const s = await config.status()
          const ec = getEffectiveCadence(id, config)
          status[id] = { ...s, order: config.order, cadence: ec.cadenceStr, baseCadence: config.cadence || DEFAULT_CADENCE, cadenceOverride: cadenceOverrides[id] || null }
        } catch (err) {
          status[id] = { error: err.message, order: config.order }
        }
      } else {
        const ec = getEffectiveCadence(id, config)
        status[id] = { registered: true, order: config.order, cadence: ec.cadenceStr, baseCadence: config.cadence || DEFAULT_CADENCE, cadenceOverride: cadenceOverrides[id] || null }
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

  /**
   * Set a cadence override for a handler.
   * @param {string} handlerId
   * @param {string|null} cadence - cadence string or null to clear override
   */
  function setCadenceOverride(handlerId, cadence) {
    if (handlerId === '__proto__' || handlerId === 'constructor' || handlerId === 'prototype') {
      throw new Error('Invalid handlerId')
    }
    if (cadence === null || cadence === undefined) {
      delete cadenceOverrides[handlerId]
    } else {
      var ms = parseCadence(cadence)
      if (ms < MIN_OVERRIDE_MS) {
        throw new Error('Cadence override "' + cadence + '" is below the minimum of 15m')
      }
      cadenceOverrides[handlerId] = cadence
    }
    if (storage) {
      storage.writeToStorage(OVERRIDES_KEY, cadenceOverrides)
    }
  }

  /**
   * Get all cadence overrides.
   * @returns {object}
   */
  function getCadenceOverrides() {
    return { ...cadenceOverrides }
  }

  return {
    register, get, getAll, runAll, runModule, getStatus, isRunning,
    setCadenceOverride, getCadenceOverrides, parseCadence
  }
}

module.exports = { createRefreshRegistry, parseCadence }
