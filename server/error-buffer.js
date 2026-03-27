/**
 * Ring buffer capturing recent console.error and console.warn messages.
 *
 * Call install() once at server startup to patch the global console.
 * Call getEntries() to retrieve the buffered entries.
 */

const DEFAULT_CAPACITY = 100

let entries = []
let capacity = DEFAULT_CAPACITY
let installed = false

function install(opts = {}) {
  if (installed) return
  installed = true
  capacity = opts.capacity || DEFAULT_CAPACITY

  const originalError = console.error
  const originalWarn = console.warn

  console.error = function(...args) {
    push('error', args)
    originalError.apply(console, args)
  }

  console.warn = function(...args) {
    push('warn', args)
    originalWarn.apply(console, args)
  }
}

function push(level, args) {
  const message = args
    .map(function(a) {
      if (typeof a === 'string') return a
      if (a instanceof Error) return a.stack || a.message
      try { return JSON.stringify(a) } catch { return String(a) }
    })
    .join(' ')

  entries.push({ level, message, at: new Date().toISOString() })

  if (entries.length > capacity) {
    entries = entries.slice(entries.length - capacity)
  }
}

function getEntries() {
  return entries.slice()
}

function clear() {
  entries = []
}

module.exports = { install, getEntries, clear }
