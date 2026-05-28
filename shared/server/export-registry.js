/**
 * Export registry — module data export hooks.
 *
 * @module shared/server/export-registry
 */

function createExportRegistry() {
  const handlers = new Map()

  function register(slug, fn) {
    if (typeof fn !== 'function') {
      console.warn('[export-registry] Export handler for "' + slug + '" is not a function, skipping')
      return
    }
    handlers.set(slug, fn)
  }

  function getAll() {
    return Object.fromEntries(handlers)
  }

  async function run(addFile, storage, mapping) {
    const errors = []
    for (const [slug, fn] of handlers) {
      try {
        await fn(addFile, storage, mapping)
      } catch (err) {
        console.error('[export-registry] Module "' + slug + '" export hook failed:', err.message)
        errors.push({ module: slug, error: err.message })
      }
    }
    return errors
  }

  return { register, getAll, run }
}

module.exports = { createExportRegistry }
