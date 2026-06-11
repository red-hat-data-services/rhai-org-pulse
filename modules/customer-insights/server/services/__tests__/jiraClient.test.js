const { markdownToAdf, parseInline } = require('../jiraClient')

describe('Jira Client - Markdown to ADF', () => {
  describe('parseInline', () => {
    test('parses bold text', () => {
      const result = parseInline('This is **bold** text')
      expect(result).toEqual([
        { type: 'text', text: 'This is ' },
        { type: 'text', text: 'bold', marks: [{ type: 'strong' }] },
        { type: 'text', text: ' text' }
      ])
    })

    test('parses italic text', () => {
      const result = parseInline('This is *italic* text')
      expect(result).toEqual([
        { type: 'text', text: 'This is ' },
        { type: 'text', text: 'italic', marks: [{ type: 'em' }] },
        { type: 'text', text: ' text' }
      ])
    })

    test('parses code spans', () => {
      const result = parseInline('Use `console.log()` to debug')
      expect(result).toEqual([
        { type: 'text', text: 'Use ' },
        { type: 'text', text: 'console.log()', marks: [{ type: 'code' }] },
        { type: 'text', text: ' to debug' }
      ])
    })

    test('parses links', () => {
      const result = parseInline('Visit [Google](https://google.com) now')
      expect(result).toEqual([
        { type: 'text', text: 'Visit ' },
        { type: 'text', text: 'Google', marks: [{ type: 'link', attrs: { href: 'https://google.com' } }] },
        { type: 'text', text: ' now' }
      ])
    })
  })

  describe('markdownToAdf', () => {
    test('converts headings', () => {
      const md = '# Heading 1\n## Heading 2'
      const result = markdownToAdf(md)

      expect(result.type).toBe('doc')
      expect(result.version).toBe(1)
      expect(result.content).toHaveLength(2)
      expect(result.content[0].type).toBe('heading')
      expect(result.content[0].attrs.level).toBe(1)
      expect(result.content[1].attrs.level).toBe(2)
    })

    test('converts bullet lists', () => {
      const md = '- Item 1\n- Item 2\n- Item 3'
      const result = markdownToAdf(md)

      expect(result.content[0].type).toBe('bulletList')
      expect(result.content[0].content).toHaveLength(3)
      expect(result.content[0].content[0].type).toBe('listItem')
    })

    test('converts ordered lists', () => {
      const md = '1. First\n2. Second\n3. Third'
      const result = markdownToAdf(md)

      expect(result.content[0].type).toBe('orderedList')
      expect(result.content[0].content).toHaveLength(3)
    })

    test('converts paragraphs', () => {
      const md = 'This is a paragraph.\n\nThis is another paragraph.'
      const result = markdownToAdf(md)

      expect(result.content).toHaveLength(2)
      expect(result.content[0].type).toBe('paragraph')
      expect(result.content[1].type).toBe('paragraph')
    })

    test('converts code blocks', () => {
      const md = '```javascript\nconst x = 42;\nconsole.log(x);\n```'
      const result = markdownToAdf(md)

      expect(result.content[0].type).toBe('codeBlock')
      expect(result.content[0].attrs.language).toBe('javascript')
      expect(result.content[0].content[0].text).toBe('const x = 42;\nconsole.log(x);')
    })

    test('converts complex markdown', () => {
      const md = `# Problem Statement

This is a **critical** issue affecting *multiple* customers.

## Acceptance Criteria

- [ ] Feature implemented
- [ ] Tests passing
- [ ] Documentation updated

Visit [Jira](https://issues.redhat.com) for more details.`

      const result = markdownToAdf(md)

      expect(result.type).toBe('doc')
      expect(result.content.length).toBeGreaterThan(0)

      // Check heading
      expect(result.content[0].type).toBe('heading')
      expect(result.content[0].attrs.level).toBe(1)

      // Should have paragraph with bold and italic
      const paragraphContent = result.content.find(c => c.type === 'paragraph')
      expect(paragraphContent).toBeDefined()
    })

    test('handles empty input', () => {
      const result = markdownToAdf('')

      expect(result.type).toBe('doc')
      expect(result.content).toHaveLength(1)
      expect(result.content[0].type).toBe('paragraph')
    })
  })
})
