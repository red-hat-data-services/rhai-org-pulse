const { createOpencodeClient } = require('@opencode-ai/sdk')

let _client = null

function getClient(baseUrl) {
  if (!_client) {
    _client = createOpencodeClient({ baseUrl })
  }
  return _client
}

/**
 * Create a new OpenCode session and return its ID.
 */
async function createSession(baseUrl) {
  const client = getClient(baseUrl)
  const session = await client.session.create()
  return session.id
}

/**
 * Send a message to an OpenCode session and stream back events.
 *
 * @param {string} baseUrl - OpenCode server URL
 * @param {string} sessionId - Session ID
 * @param {string} message - User message text
 * @param {(event: object) => void} onEvent - Called for each SSE event
 * @returns {Promise<void>} Resolves when the stream ends
 */
async function sendMessage(baseUrl, sessionId, message, onEvent) {
  const client = getClient(baseUrl)

  // Send prompt (non-blocking — the response streams via events)
  const stream = await client.session.prompt({
    path: { id: sessionId },
    body: {
      parts: [{ type: 'text', text: message }]
    }
  })

  // Iterate the SSE stream
  for await (const event of stream) {
    onEvent(event)
  }
}

/**
 * Reset the cached client (useful if config changes at runtime).
 */
function resetClient() {
  _client = null
}

module.exports = { createSession, sendMessage, resetClient }
