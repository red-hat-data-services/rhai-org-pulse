const providers = new Map()

function registerProvider(id, fn) {
  if (typeof fn !== 'function') {
    console.warn(`[message-registry] Provider "${id}" is not a function, skipping`)
    return
  }
  providers.set(id, fn)
}

async function getMessages(userContext) {
  const results = []
  const TIMEOUT_MS = 5000

  for (const [id, fn] of providers) {
    try {
      const messages = await Promise.race([
        fn(userContext),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Provider "${id}" timed out`)), TIMEOUT_MS)
        )
      ])
      if (Array.isArray(messages)) {
        results.push(...messages)
      }
    } catch (err) {
      console.warn(`[message-registry] Provider "${id}" failed:`, err.message)
    }
  }

  return results
}

module.exports = { registerProvider, getMessages }
