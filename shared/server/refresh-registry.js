/**
 * Refresh registry — ordered execution of module refresh handlers.
 *
 * @module shared/server/refresh-registry
 */

const DEFAULT_ORDER = 100
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

function createRefreshRegistry() {
  const entries = new Map()

  function register(id, config) {
    if (typeof config.handler !== 'function') {
      console.warn('[refresh-registry] Handler for "' + id + '" is not a function, skipping')
      return
    }
    entries.set(id, {
      handler: config.handler,
      status: typeof config.status === 'function' ? config.status : null,
      order: typeof config.order === 'number' ? config.order : DEFAULT_ORDER
    })
  }

  function get(id) {
    return entries.get(id) || null
  }

  function getAll() {
    return Object.fromEntries(entries)
  }

  async function runAll(options = {}) {
    const timeoutMs = options.timeout || DEFAULT_TIMEOUT_MS
    const sorted = Array.from(entries.entries()).sort(function (a, b) {
      return a[1].order - b[1].order
    })

    const results = {}
    for (const [id, config] of sorted) {
      try {
        let timer
        const result = await Promise.race([
          config.handler(options),
          new Promise(function (_, reject) {
            timer = setTimeout(function () { reject(new Error('Refresh "' + id + '" timed out after ' + timeoutMs + 'ms')) }, timeoutMs)
          })
        ])
        clearTimeout(timer)
        results[id] = { success: true, result }
      } catch (err) {
        console.error('[refresh-registry] "' + id + '" failed:', err.message)
        results[id] = { success: false, error: err.message }
      }
    }
    return results
  }

  async function getStatus() {
    const status = {}
    for (const [id, config] of entries) {
      if (config.status) {
        try {
          status[id] = await config.status()
        } catch (err) {
          status[id] = { error: err.message }
        }
      } else {
        status[id] = { registered: true }
      }
    }
    return status
  }

  return { register, get, getAll, runAll, getStatus }
}

module.exports = { createRefreshRegistry }
