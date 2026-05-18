/**
 * In-process mutex for serializing config read-modify-write operations.
 *
 * Every route handler that mutates config.json wraps its read-modify-write
 * in withConfigLock() to prevent concurrent interleaving. This is sufficient
 * for the current single-replica deployment.
 */

let pending = Promise.resolve()

function withConfigLock(fn) {
  const next = pending.then(() => fn()).catch(function(err) { throw err })
  pending = next.catch(function() {}) // swallow for chaining
  return next
}

module.exports = { withConfigLock }
