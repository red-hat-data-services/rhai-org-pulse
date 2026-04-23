import { describe, it, expect } from 'vitest'
const { validateBigRock, RESERVED_NAMES, FIELD_LIMITS, MAX_OUTCOME_KEYS, OUTCOME_KEY_PATTERN } = require('../../server/validation')

function makeValidRock(overrides) {
  return {
    name: 'MaaS',
    fullName: 'MaaS (continue from 3.4)',
    pillar: 'Inference',
    state: 'continue from 3.4',
    owner: 'jsmith@redhat.com',
    outcomeKeys: ['RHAISTRAT-1513'],
    notes: 'Test notes',
    description: 'Test description',
    ...overrides
  }
}

describe('validateBigRock', () => {
  it('accepts a valid Big Rock', () => {
    const result = validateBigRock(makeValidRock())
    expect(result.valid).toBe(true)
    expect(Object.keys(result.errors)).toHaveLength(0)
  })

  it('accepts minimal input (name only)', () => {
    const result = validateBigRock({ name: 'Test' })
    expect(result.valid).toBe(true)
  })

  // Name validation
  it('rejects missing name', () => {
    const result = validateBigRock(makeValidRock({ name: undefined }))
    expect(result.valid).toBe(false)
    expect(result.errors.name).toContain('required')
  })

  it('rejects empty string name', () => {
    const result = validateBigRock(makeValidRock({ name: '' }))
    expect(result.valid).toBe(false)
    expect(result.errors.name).toContain('required')
  })

  it('rejects whitespace-only name', () => {
    const result = validateBigRock(makeValidRock({ name: '   ' }))
    expect(result.valid).toBe(false)
    expect(result.errors.name).toContain('required')
  })

  it('rejects name exceeding max length', () => {
    const result = validateBigRock(makeValidRock({ name: 'x'.repeat(101) }))
    expect(result.valid).toBe(false)
    expect(result.errors.name).toContain('100')
  })

  it('accepts name at exactly max length', () => {
    const result = validateBigRock(makeValidRock({ name: 'x'.repeat(100) }))
    expect(result.valid).toBe(true)
  })

  it('rejects reserved name "reorder"', () => {
    const result = validateBigRock(makeValidRock({ name: 'reorder' }))
    expect(result.valid).toBe(false)
    expect(result.errors.name).toContain('reserved')
  })

  it('rejects reserved name "Reorder" (case insensitive)', () => {
    const result = validateBigRock(makeValidRock({ name: 'Reorder' }))
    expect(result.valid).toBe(false)
    expect(result.errors.name).toContain('reserved')
  })

  it('rejects duplicate name within existing names', () => {
    const result = validateBigRock(makeValidRock({ name: 'Existing' }), {
      existingNames: ['Existing', 'Other']
    })
    expect(result.valid).toBe(false)
    expect(result.errors.name).toContain('already exists')
  })

  it('allows same name when it matches originalName (editing)', () => {
    const result = validateBigRock(makeValidRock({ name: 'MaaS' }), {
      existingNames: ['MaaS', 'Other'],
      originalName: 'MaaS'
    })
    expect(result.valid).toBe(true)
  })

  it('rejects duplicate when renaming to an existing name', () => {
    const result = validateBigRock(makeValidRock({ name: 'Other' }), {
      existingNames: ['MaaS', 'Other'],
      originalName: 'MaaS'
    })
    expect(result.valid).toBe(false)
    expect(result.errors.name).toContain('already exists')
  })

  // String field max lengths
  it('rejects fullName exceeding max length', () => {
    const result = validateBigRock(makeValidRock({ fullName: 'x'.repeat(201) }))
    expect(result.valid).toBe(false)
    expect(result.errors.fullName).toContain('200')
  })

  it('rejects pillar exceeding max length', () => {
    const result = validateBigRock(makeValidRock({ pillar: 'x'.repeat(101) }))
    expect(result.valid).toBe(false)
    expect(result.errors.pillar).toContain('100')
  })

  it('rejects state exceeding max length', () => {
    const result = validateBigRock(makeValidRock({ state: 'x'.repeat(101) }))
    expect(result.valid).toBe(false)
    expect(result.errors.state).toContain('100')
  })

  it('rejects owner exceeding max length', () => {
    const result = validateBigRock(makeValidRock({ owner: 'x'.repeat(201) }))
    expect(result.valid).toBe(false)
    expect(result.errors.owner).toContain('200')
  })

  it('rejects notes exceeding max length', () => {
    const result = validateBigRock(makeValidRock({ notes: 'x'.repeat(2001) }))
    expect(result.valid).toBe(false)
    expect(result.errors.notes).toContain('2000')
  })

  it('rejects description exceeding max length', () => {
    const result = validateBigRock(makeValidRock({ description: 'x'.repeat(2001) }))
    expect(result.valid).toBe(false)
    expect(result.errors.description).toContain('2000')
  })

  it('accepts fields at exactly max length', () => {
    const result = validateBigRock(makeValidRock({
      fullName: 'x'.repeat(200),
      notes: 'x'.repeat(2000),
      description: 'x'.repeat(2000)
    }))
    expect(result.valid).toBe(true)
  })

  // outcomeKeys validation
  it('accepts valid outcome keys', () => {
    const result = validateBigRock(makeValidRock({
      outcomeKeys: ['RHAISTRAT-1513', 'PROJ-42']
    }))
    expect(result.valid).toBe(true)
  })

  it('accepts empty outcomeKeys array', () => {
    const result = validateBigRock(makeValidRock({ outcomeKeys: [] }))
    expect(result.valid).toBe(true)
  })

  it('accepts undefined outcomeKeys', () => {
    const result = validateBigRock(makeValidRock({ outcomeKeys: undefined }))
    expect(result.valid).toBe(true)
  })

  it('rejects non-array outcomeKeys', () => {
    const result = validateBigRock(makeValidRock({ outcomeKeys: 'RHAISTRAT-1513' }))
    expect(result.valid).toBe(false)
    expect(result.errors.outcomeKeys).toContain('array')
  })

  it('rejects outcomeKeys exceeding max count', () => {
    const keys = Array.from({ length: 21 }, (_, i) => `PROJ-${i + 1}`)
    const result = validateBigRock(makeValidRock({ outcomeKeys: keys }))
    expect(result.valid).toBe(false)
    expect(result.errors.outcomeKeys).toContain('20')
  })

  it('accepts exactly 20 outcome keys', () => {
    const keys = Array.from({ length: 20 }, (_, i) => `PROJ-${i + 1}`)
    const result = validateBigRock(makeValidRock({ outcomeKeys: keys }))
    expect(result.valid).toBe(true)
  })

  it('rejects invalid outcome key format', () => {
    const result = validateBigRock(makeValidRock({
      outcomeKeys: ['RHAISTRAT-1513', 'bad-key', 'lowercase-1']
    }))
    expect(result.valid).toBe(false)
    expect(result.errors.outcomeKeys).toContain('bad-key')
  })

  it('rejects non-string elements in outcomeKeys', () => {
    const result = validateBigRock(makeValidRock({
      outcomeKeys: ['PROJ-1', 42]
    }))
    expect(result.valid).toBe(false)
  })

  // Priority validation
  it('accepts valid priority', () => {
    const result = validateBigRock(makeValidRock({ priority: 5 }))
    expect(result.valid).toBe(true)
  })

  it('rejects priority of 0', () => {
    const result = validateBigRock(makeValidRock({ priority: 0 }))
    expect(result.valid).toBe(false)
    expect(result.errors.priority).toContain('positive integer')
  })

  it('rejects negative priority', () => {
    const result = validateBigRock(makeValidRock({ priority: -1 }))
    expect(result.valid).toBe(false)
  })

  it('rejects non-integer priority', () => {
    const result = validateBigRock(makeValidRock({ priority: 1.5 }))
    expect(result.valid).toBe(false)
  })

  it('accepts undefined priority (server-assigned)', () => {
    const result = validateBigRock(makeValidRock({ priority: undefined }))
    expect(result.valid).toBe(true)
  })

  // Multiple errors
  it('reports multiple field errors at once', () => {
    const result = validateBigRock({
      name: '',
      fullName: 'x'.repeat(201),
      outcomeKeys: 'not-array',
      priority: -1
    })
    expect(result.valid).toBe(false)
    expect(Object.keys(result.errors).length).toBeGreaterThanOrEqual(3)
  })

  // No options provided
  it('works without options parameter', () => {
    const result = validateBigRock(makeValidRock())
    expect(result.valid).toBe(true)
  })
})

describe('exports', () => {
  it('exports RESERVED_NAMES containing "reorder"', () => {
    expect(RESERVED_NAMES).toContain('reorder')
  })

  it('exports FIELD_LIMITS with correct values', () => {
    expect(FIELD_LIMITS.name).toBe(100)
    expect(FIELD_LIMITS.fullName).toBe(200)
    expect(FIELD_LIMITS.pillar).toBe(100)
    expect(FIELD_LIMITS.state).toBe(100)
    expect(FIELD_LIMITS.owner).toBe(200)
    expect(FIELD_LIMITS.notes).toBe(2000)
    expect(FIELD_LIMITS.description).toBe(2000)
  })

  it('exports MAX_OUTCOME_KEYS as 20', () => {
    expect(MAX_OUTCOME_KEYS).toBe(20)
  })

  it('exports OUTCOME_KEY_PATTERN that matches valid keys', () => {
    expect(OUTCOME_KEY_PATTERN.test('RHAISTRAT-1513')).toBe(true)
    expect(OUTCOME_KEY_PATTERN.test('PROJ-1')).toBe(true)
    expect(OUTCOME_KEY_PATTERN.test('bad-key')).toBe(false)
    expect(OUTCOME_KEY_PATTERN.test('')).toBe(false)
  })
})
