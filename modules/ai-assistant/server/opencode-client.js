// @opencode-ai/sdk is ESM-only — use dynamic import() from CJS
let _clientPromise = null

function getClient(baseUrl) {
  if (!_clientPromise) {
    _clientPromise = import('@opencode-ai/sdk').then(({ createOpencodeClient }) =>
      createOpencodeClient({ baseUrl })
    )
  }
  return _clientPromise
}

/**
 * Create a new OpenCode session and return its ID.
 */
async function createSession(baseUrl) {
  const client = await getClient(baseUrl)
  const result = await client.session.create()
  return result.data.id
}

/**
 * Send a message and wait for the complete response.
 *
 * Uses the blocking prompt endpoint which returns the assistant reply inline.
 *
 * @param {string} baseUrl - OpenCode server URL
 * @param {string} sessionId - Session ID
 * @param {string} message - User message text
 * @returns {Promise<string>} The assistant's response text
 */
async function sendMessage(baseUrl, sessionId, message) {
  const client = await getClient(baseUrl)

  // prompt() is blocking — waits for the full response and returns it inline
  const result = await client.session.prompt({
    path: { id: sessionId },
    body: {
      parts: [{ type: 'text', text: message }]
    }
  })

  // Extract text from response parts
  const parts = result.data?.parts || []
  const text = parts
    .filter(p => p.type === 'text')
    .map(p => p.text)
    .join('')
  return text || '(No response)'
}

/**
 * Reset the cached client (useful if config changes at runtime).
 */
function resetClient() {
  _clientPromise = null
}

module.exports = { createSession, sendMessage, resetClient }
