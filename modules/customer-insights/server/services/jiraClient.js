/**
 * Thin async Jira REST API client for RFE creation
 *
 * Handles markdown to ADF (Atlassian Document Format) conversion
 * and issue creation with proper authentication.
 */

/**
 * Convert text node with optional marks (bold, italic, etc.)
 */
function adfText(text, marks = null) {
  const node = { type: 'text', text }
  if (marks) node.marks = marks
  return node
}

/**
 * Parse inline markdown: **bold**, *italic*, `code`, [text](url)
 */
function parseInline(text) {
  const nodes = []
  const pattern = /(\*\*(?<bold>.+?)\*\*)|(\*(?<italic>.+?)\*)|(`(?<code>[^`]+)`)|(\[(?<lt>[^\]]*)\]\((?<lu>[^)]+)\))/g

  let lastIndex = 0
  let match

  while ((match = pattern.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      nodes.push(adfText(text.slice(lastIndex, match.index)))
    }

    // Add the matched element
    if (match.groups.bold) {
      nodes.push(adfText(match.groups.bold, [{ type: 'strong' }]))
    } else if (match.groups.italic) {
      nodes.push(adfText(match.groups.italic, [{ type: 'em' }]))
    } else if (match.groups.code) {
      nodes.push(adfText(match.groups.code, [{ type: 'code' }]))
    } else if (match.groups.lt) {
      nodes.push(adfText(match.groups.lt, [{ type: 'link', attrs: { href: match.groups.lu } }]))
    }

    lastIndex = pattern.lastIndex
  }

  // Add remaining text
  if (lastIndex < text.length) {
    nodes.push(adfText(text.slice(lastIndex)))
  }

  return nodes.length > 0 ? nodes : [adfText(text)]
}

/**
 * Convert markdown to Atlassian Document Format (ADF)
 *
 * Handles headings, paragraphs, bullet/ordered lists, bold, italic,
 * code spans, fenced code blocks, and links.
 */
function markdownToAdf(markdown) {
  const lines = markdown.split('\n')
  const content = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Fenced code block
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim()
      const codeLines = []
      i++

      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      i++ // Skip closing ```

      const node = {
        type: 'codeBlock',
        content: [adfText(codeLines.join('\n'))]
      }
      if (lang) node.attrs = { language: lang }
      content.push(node)
      continue
    }

    // Heading
    const headingMatch = line.match(/^(#{1,6})\s+(.*)/)
    if (headingMatch) {
      const level = headingMatch[1].length
      const text = headingMatch[2].trim()
      content.push({
        type: 'heading',
        attrs: { level },
        content: text ? parseInline(text) : [adfText('')]
      })
      i++
      continue
    }

    // Horizontal rule
    if (/^---+\s*$/.test(line)) {
      content.push({ type: 'rule' })
      i++
      continue
    }

    // Bullet list
    if (/^[-*]\s/.test(line)) {
      const items = []
      while (i < lines.length && /^[-*]\s/.test(lines[i])) {
        const itemText = lines[i].replace(/^[-*]\s+/, '')
        items.push(parseInline(itemText))
        i++
      }
      content.push({
        type: 'bulletList',
        content: items.map(nodes => ({
          type: 'listItem',
          content: [{ type: 'paragraph', content: nodes }]
        }))
      })
      continue
    }

    // Ordered list
    if (/^\d+\.\s/.test(line)) {
      const items = []
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        const itemText = lines[i].replace(/^\d+\.\s+/, '')
        items.push(parseInline(itemText))
        i++
      }
      content.push({
        type: 'orderedList',
        content: items.map(nodes => ({
          type: 'listItem',
          content: [{ type: 'paragraph', content: nodes }]
        }))
      })
      continue
    }

    // Empty line
    if (!line.trim()) {
      i++
      continue
    }

    // Paragraph (collect multi-line paragraphs)
    const paraLines = []
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].startsWith('#') &&
      !lines[i].startsWith('```') &&
      !/^[-*]\s/.test(lines[i]) &&
      !/^\d+\.\s/.test(lines[i]) &&
      !/^---+\s*$/.test(lines[i])
    ) {
      paraLines.push(lines[i])
      i++
    }

    if (paraLines.length > 0) {
      content.push({
        type: 'paragraph',
        content: parseInline(paraLines.join(' '))
      })
    } else {
      content.push({
        type: 'paragraph',
        content: parseInline(line)
      })
      i++
    }
  }

  // ADF requires at least one content node
  if (content.length === 0) {
    content.push({ type: 'paragraph', content: [adfText('')]})
  }

  return {
    type: 'doc',
    version: 1,
    content
  }
}

/**
 * Create Jira client with authentication
 */
function createJiraClient(credentials) {
  const { email, token, baseUrl = 'https://redhat.atlassian.net' } = credentials

  if (!email || !token) {
    throw new Error('Jira email and token are required')
  }

  const authHeader = 'Basic ' + Buffer.from(`${email}:${token}`).toString('base64')

  return {
    baseUrl: baseUrl.replace(/\/$/, ''),

    /**
     * Create a new Jira issue
     */
    async createIssue(fields) {
      // Convert description to ADF if it's a string
      if (fields.description && typeof fields.description === 'string') {
        fields = { ...fields, description: markdownToAdf(fields.description) }
      }

      const response = await fetch(`${this.baseUrl}/rest/api/3/issue`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ fields })
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Jira API error (${response.status}): ${errorText}`)
      }

      return await response.json()
    },

    /**
     * Search for issues using JQL
     */
    async search(jql, fields = null, maxResults = 50) {
      const params = new URLSearchParams({
        jql,
        maxResults: maxResults.toString()
      })

      if (fields && fields.length > 0) {
        params.append('fields', fields.join(','))
      }

      const response = await fetch(`${this.baseUrl}/rest/api/3/search?${params}`, {
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/json'
        }
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Jira API error (${response.status}): ${errorText}`)
      }

      const data = await response.json()
      return data.issues || []
    }
  }
}

module.exports = {
  createJiraClient,
  markdownToAdf,
  parseInline,
  adfText
}
