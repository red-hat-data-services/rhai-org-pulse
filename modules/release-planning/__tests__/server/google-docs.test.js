import { describe, it, expect } from 'vitest'
const {
  extractBigRocksFromDoc,
  extractText,
  extractOutcomeKeys,
  parseTopLevelItem,
  getNestingLevel
} = require('../../../../shared/server/google-docs')

const fixture = require('../../../../fixtures/release-planning/google-doc-response.json')

describe('getNestingLevel', () => {
  it('returns 0 when nestingLevel is omitted (Google Docs API behavior)', () => {
    expect(getNestingLevel({ listId: 'kix.list1' })).toBe(0)
  })

  it('returns 0 when nestingLevel is explicitly 0', () => {
    expect(getNestingLevel({ listId: 'kix.list1', nestingLevel: 0 })).toBe(0)
  })

  it('returns the value when nestingLevel is set', () => {
    expect(getNestingLevel({ listId: 'kix.list1', nestingLevel: 1 })).toBe(1)
    expect(getNestingLevel({ listId: 'kix.list1', nestingLevel: 2 })).toBe(2)
  })
})

describe('extractText', () => {
  it('extracts text from paragraph elements', () => {
    const para = {
      elements: [
        { textRun: { content: 'Hello ' } },
        { textRun: { content: 'World' } }
      ]
    }
    expect(extractText(para)).toBe('Hello World')
  })

  it('returns empty string for empty paragraph', () => {
    expect(extractText({ elements: [] })).toBe('')
    expect(extractText({})).toBe('')
  })

  it('handles elements without textRun', () => {
    const para = {
      elements: [
        { inlineObjectElement: { inlineObjectId: '123' } },
        { textRun: { content: 'Text' } }
      ]
    }
    expect(extractText(para)).toBe('Text')
  })
})

describe('extractOutcomeKeys', () => {
  it('extracts single RHAISTRAT key', () => {
    expect(extractOutcomeKeys('Outcome: RHAISTRAT-1513')).toEqual(['RHAISTRAT-1513'])
  })

  it('extracts multiple RHAISTRAT keys', () => {
    const keys = extractOutcomeKeys('RHAISTRAT-1515 and RHAISTRAT-1403')
    expect(keys).toEqual(['RHAISTRAT-1515', 'RHAISTRAT-1403'])
  })

  it('deduplicates keys', () => {
    const keys = extractOutcomeKeys('RHAISTRAT-1513 blah RHAISTRAT-1513')
    expect(keys).toEqual(['RHAISTRAT-1513'])
  })

  it('returns empty array when no keys found', () => {
    expect(extractOutcomeKeys('No outcome key here')).toEqual([])
    expect(extractOutcomeKeys('[Outcome TBD]')).toEqual([])
  })
})

describe('parseTopLevelItem', () => {
  it('extracts name, state, and outcome key', () => {
    const result = parseTopLevelItem('MaaS (continue from 3.4) Outcome: RHAISTRAT-1513', 1)
    expect(result.name).toBe('MaaS')
    expect(result.state).toBe('continue from 3.4')
    expect(result.outcomeKeys).toEqual(['RHAISTRAT-1513'])
    expect(result.priority).toBe(1)
  })

  it('extracts name with "new for" state', () => {
    const result = parseTopLevelItem('Enable tool calling for open source models (new for 3.5)', 4)
    expect(result.name).toBe('Enable tool calling for open source models')
    expect(result.state).toBe('new for 3.5')
    expect(result.outcomeKeys).toEqual([])
    expect(result.priority).toBe(4)
  })

  it('handles items without state', () => {
    const result = parseTopLevelItem('2.25 to 3.5 upgrade support Outcome: RHAISTRAT-1480', 6)
    expect(result.name).toBe('2.25 to 3.5 upgrade support')
    expect(result.state).toBe('')
    expect(result.outcomeKeys).toEqual(['RHAISTRAT-1480'])
  })

  it('handles items with [Outcome TBD]', () => {
    const result = parseTopLevelItem('Bring Your Own Agent (continue from 3.4) [Outcome TBD]', 3)
    expect(result.name).toBe('Bring Your Own Agent')
    expect(result.state).toBe('continue from 3.4')
    expect(result.outcomeKeys).toEqual([])
  })

  it('defaults pillar, owner, notes, description to empty', () => {
    const result = parseTopLevelItem('Test Rock', 1)
    expect(result.pillar).toBe('')
    expect(result.owner).toBe('')
    expect(result.notes).toBe('')
    expect(result.description).toBe('')
  })
})

describe('extractBigRocksFromDoc', () => {
  it('parses all 14 Big Rocks from the fixture', () => {
    const result = extractBigRocksFromDoc(fixture)
    expect(result.bigRocks).toHaveLength(14)
  })

  it('extracts the document title', () => {
    const result = extractBigRocksFromDoc(fixture)
    expect(result.title).toBe('RH AI Big Rocks for 3.5')
  })

  it('extracts names correctly', () => {
    const result = extractBigRocksFromDoc(fixture)
    const names = result.bigRocks.map(function(r) { return r.name })
    expect(names[0]).toBe('MaaS')
    expect(names[1]).toBe('Gen AI Studio / Prompt Lab')
    expect(names[2]).toBe('Bring Your Own Agent')
    expect(names[3]).toBe('Enable tool calling for open source models')
    expect(names[4]).toBe('Llm-d / llm-d on xKS')
    expect(names[5]).toBe('2.25 to 3.5 upgrade support')
    expect(names[6]).toBe('Eval Hub')
    expect(names[10]).toBe('AutoRAG')
    expect(names[13]).toBe('AutoML')
  })

  it('extracts state from parenthesized text', () => {
    const result = extractBigRocksFromDoc(fixture)
    expect(result.bigRocks[0].state).toBe('continue from 3.4')
    expect(result.bigRocks[3].state).toBe('new for 3.5')
    expect(result.bigRocks[5].state).toBe('') // "2.25 to 3.5 upgrade support" has no state
  })

  it('extracts single outcome key from top-level item', () => {
    const result = extractBigRocksFromDoc(fixture)
    expect(result.bigRocks[0].outcomeKeys).toEqual(['RHAISTRAT-1513'])
    expect(result.bigRocks[1].outcomeKeys).toEqual(['RHAISTRAT-1312'])
  })

  it('extracts multiple outcome keys from sub-items (Big Rock #5)', () => {
    const result = extractBigRocksFromDoc(fixture)
    // Llm-d / llm-d on xKS has outcome keys in sub-items
    expect(result.bigRocks[4].outcomeKeys).toContain('RHAISTRAT-1515')
    expect(result.bigRocks[4].outcomeKeys).toContain('RHAISTRAT-1403')
    expect(result.bigRocks[4].outcomeKeys).toHaveLength(2)
  })

  it('handles missing outcome key with warning (Big Rock #3)', () => {
    const result = extractBigRocksFromDoc(fixture)
    // "Bring Your Own Agent" has [Outcome TBD]
    expect(result.bigRocks[2].outcomeKeys).toEqual([])
    expect(result.warnings).toContain("Big Rock #3 'Bring Your Own Agent' has no outcome key")
  })

  it('handles items without state text (Big Rock #6)', () => {
    const result = extractBigRocksFromDoc(fixture)
    expect(result.bigRocks[5].state).toBe('')
    expect(result.bigRocks[5].outcomeKeys).toEqual(['RHAISTRAT-1480'])
  })

  it('ignores non-list content (headings, blank paragraphs)', () => {
    const result = extractBigRocksFromDoc(fixture)
    // The fixture has a heading paragraph and a sectionBreak before the list
    // These should not be counted as Big Rocks
    expect(result.bigRocks[0].name).toBe('MaaS')
    expect(result.bigRocks[0].priority).toBe(1)
  })

  it('assigns sequential priorities', () => {
    const result = extractBigRocksFromDoc(fixture)
    for (let i = 0; i < result.bigRocks.length; i++) {
      expect(result.bigRocks[i].priority).toBe(i + 1)
    }
  })

  it('handles an empty document', () => {
    const result = extractBigRocksFromDoc({ title: 'Empty', body: { content: [] } })
    expect(result.bigRocks).toHaveLength(0)
    expect(result.warnings).toHaveLength(0)
  })

  it('handles a document with no body', () => {
    const result = extractBigRocksFromDoc({ title: 'No body' })
    expect(result.bigRocks).toHaveLength(0)
  })

  it('generates warnings for all rocks without outcome keys', () => {
    const result = extractBigRocksFromDoc(fixture)
    // Expected: Big Rocks #3, #4, #12, #13, #14 have no outcome keys
    const noKeyRocks = result.bigRocks.filter(function(r) { return r.outcomeKeys.length === 0 })
    expect(noKeyRocks.length).toBe(result.warnings.length)
  })

  it('extracts outcome keys from sub-items for Observability', () => {
    const result = extractBigRocksFromDoc(fixture)
    // Observability (index 8) has outcome keys in sub-items only
    expect(result.bigRocks[8].outcomeKeys).toContain('RHAISTRAT-1517')
    expect(result.bigRocks[8].outcomeKeys).toContain('RHAISTRAT-1446')
  })

  it('extracts outcome keys from sub-items for Multitenancy', () => {
    const result = extractBigRocksFromDoc(fixture)
    // Multitenancy (index 9) has outcome keys in sub-items
    expect(result.bigRocks[9].outcomeKeys).toContain('RHAISTRAT-1516')
    expect(result.bigRocks[9].outcomeKeys).toContain('RHAISTRAT-898')
  })
})
