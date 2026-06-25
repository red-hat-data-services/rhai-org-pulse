const { createSession, sendMessage } = require('./opencode-client')

const RATE_LIMIT_MAX = 20
const RATE_LIMIT_WINDOW_MS = 60_000
const rateCounts = new Map()

function isRateLimited(email) {
  const now = Date.now()
  const entry = rateCounts.get(email)
  if (!entry || now - entry.windowStart >= RATE_LIMIT_WINDOW_MS) {
    rateCounts.set(email, { windowStart: now, count: 1 })
    return false
  }
  entry.count++
  return entry.count > RATE_LIMIT_MAX
}

function buildSystemPrompt(context) {
  if (!context) return ''
  const parts = ['You are an AI assistant embedded in Org Pulse, an internal org-health dashboard.']
  if (context.module) parts.push(`The user is currently viewing the "${context.module}" module.`)
  if (context.view) parts.push(`They are on the "${context.view}" view.`)
  if (context.params && Object.keys(context.params).length > 0) {
    parts.push(`Page parameters: ${JSON.stringify(context.params)}`)
  }
  parts.push('Answer concisely. Use markdown for formatting. If you don\'t know something, say so.')
  return parts.join(' ')
}

module.exports = function registerRoutes(router, context) {
  const { requireScope } = context

  context.registerScopes([
    { key: 'ai-assistant:use', label: 'Use', description: 'Send messages to the AI assistant', category: 'AI Assistant' }
  ])

  const openCodeUrl = context.resolveSecret('OPENCODE_URL')

  if (context.registerDiagnostics) {
    context.registerDiagnostics(async function () {
      return {
        configured: !!openCodeUrl,
        openCodeUrl: openCodeUrl ? openCodeUrl.replace(/\/\/.*@/, '//***@') : null
      }
    })
  }

  router.post('/chat', requireScope('ai-assistant:use'), async function (req, res) {
    const baseUrl = context.resolveSecret('OPENCODE_URL')
    if (!baseUrl) {
      return res.status(503).json({ error: 'AI assistant is not configured (OPENCODE_URL missing)' })
    }

    if (isRateLimited(req.userEmail)) {
      return res.status(429).json({ error: 'Rate limit exceeded. Try again in a minute.' })
    }

    const { message, sessionId: existingSessionId, context: pageContext } = req.body
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message is required' })
    }
    if (message.length > 4000) {
      return res.status(400).json({ error: 'message too long (max 4000 characters)' })
    }

    // Set up SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    })

    let aborted = false
    req.on('close', () => { aborted = true })

    try {
      // Create or reuse session
      let sessionId = existingSessionId
      if (!sessionId) {
        sessionId = await createSession(baseUrl)
        res.write(`event: session\ndata: ${JSON.stringify({ sessionId })}\n\n`)
      }

      // Prepend page context to the user message
      const systemPrompt = buildSystemPrompt(pageContext)
      const fullMessage = systemPrompt
        ? `[System context: ${systemPrompt}]\n\n${message}`
        : message

      await sendMessage(baseUrl, sessionId, fullMessage, function (event) {
        if (aborted) return

        // Forward text content events to the client
        if (event.type === 'message.part.text.delta' || event.type === 'text_delta') {
          res.write(`event: delta\ndata: ${JSON.stringify({ text: event.properties?.text || event.text || '' })}\n\n`)
        } else if (event.type === 'message.complete' || event.type === 'message_stop') {
          res.write(`event: done\ndata: ${JSON.stringify({ sessionId })}\n\n`)
        } else if (event.type === 'error') {
          res.write(`event: error\ndata: ${JSON.stringify({ error: event.properties?.message || 'Unknown error' })}\n\n`)
        }
      })

      // Ensure done is sent even if no explicit complete event
      if (!aborted) {
        res.write(`event: done\ndata: ${JSON.stringify({ sessionId })}\n\n`)
        res.end()
      }
    } catch (err) {
      console.error('[ai-assistant] Chat error:', err.message)
      if (!aborted) {
        res.write(`event: error\ndata: ${JSON.stringify({ error: 'Failed to get response from AI assistant' })}\n\n`)
        res.end()
      }
    }
  })
}
