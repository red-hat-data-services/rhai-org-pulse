import { describe, it, expect } from 'vitest'

const { deriveHumanReviewStatus, extractSignOffInfo } = require('../ai-review-fields')

describe('deriveHumanReviewStatus', function() {
  it('returns approved when sign-off label is present', function() {
    expect(deriveHumanReviewStatus(['strat-creator-human-sign-off'])).toBe('approved')
  })

  it('returns needs-review when needs-attention label is present', function() {
    expect(deriveHumanReviewStatus(['strat-creator-needs-attention'])).toBe('needs-review')
  })

  it('returns awaiting-review when no relevant labels', function() {
    expect(deriveHumanReviewStatus(['other-label'])).toBe('awaiting-review')
  })

  it('returns awaiting-review for empty array', function() {
    expect(deriveHumanReviewStatus([])).toBe('awaiting-review')
  })

  it('returns awaiting-review for null/undefined', function() {
    expect(deriveHumanReviewStatus(null)).toBe('awaiting-review')
    expect(deriveHumanReviewStatus(undefined)).toBe('awaiting-review')
  })

  it('sign-off takes precedence over needs-attention', function() {
    expect(deriveHumanReviewStatus([
      'strat-creator-needs-attention',
      'strat-creator-human-sign-off'
    ])).toBe('approved')
  })
})

describe('extractSignOffInfo', function() {
  it('returns null for null/undefined changelog', function() {
    expect(extractSignOffInfo(null)).toBeNull()
    expect(extractSignOffInfo(undefined)).toBeNull()
  })

  it('returns null for empty histories', function() {
    expect(extractSignOffInfo({ histories: [] })).toBeNull()
  })

  it('returns null when no label changes', function() {
    expect(extractSignOffInfo({
      histories: [{
        created: '2026-01-01T00:00:00Z',
        author: { displayName: 'Alice' },
        items: [{ field: 'status', fromString: 'New', toString: 'In Progress' }]
      }]
    })).toBeNull()
  })

  it('extracts sign-off info from label addition', function() {
    const result = extractSignOffInfo({
      histories: [{
        created: '2026-04-20T03:00:00Z',
        author: { displayName: 'Alice Chen' },
        items: [{
          field: 'labels',
          fromString: 'strat-creator-auto-created strat-creator-rubric-pass',
          toString: 'strat-creator-auto-created strat-creator-rubric-pass strat-creator-human-sign-off'
        }]
      }]
    })
    expect(result).toEqual({
      approvedBy: 'Alice Chen',
      approvedAt: '2026-04-20T03:00:00Z'
    })
  })

  it('picks the latest sign-off when multiple exist', function() {
    const result = extractSignOffInfo({
      histories: [
        {
          created: '2026-04-15T00:00:00Z',
          author: { displayName: 'Bob' },
          items: [{
            field: 'labels',
            fromString: '',
            toString: 'strat-creator-human-sign-off'
          }]
        },
        {
          created: '2026-04-20T00:00:00Z',
          author: { displayName: 'Alice' },
          items: [{
            field: 'labels',
            fromString: '',
            toString: 'strat-creator-human-sign-off'
          }]
        }
      ]
    })
    expect(result.approvedBy).toBe('Alice')
    expect(result.approvedAt).toBe('2026-04-20T00:00:00Z')
  })

  it('ignores sign-off label removal', function() {
    const result = extractSignOffInfo({
      histories: [{
        created: '2026-04-20T03:00:00Z',
        author: { displayName: 'Alice' },
        items: [{
          field: 'labels',
          fromString: 'strat-creator-human-sign-off',
          toString: ''
        }]
      }]
    })
    expect(result).toBeNull()
  })
})
