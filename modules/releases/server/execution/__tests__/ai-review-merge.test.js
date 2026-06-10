import { describe, it, expect } from 'vitest'

const { mergeAiReview, trimForHistory, MAX_HISTORY } = require('../ai-review-merge')

describe('trimForHistory', function() {
  it('extracts only history-relevant fields', function() {
    const full = {
      title: 'Test',
      sourceRfe: 'RHAIRFE-1',
      size: 'M',
      recommendation: 'approve',
      needsAttention: false,
      humanReviewStatus: 'approved',
      scores: { feasibility: 2, total: 7 },
      reviewers: { feasibility: 'approve' },
      reviewedAt: '2026-01-01',
      runId: 'run-1',
      labels: ['a']
    }
    const trimmed = trimForHistory(full)
    expect(Object.keys(trimmed).sort()).toEqual([
      'humanReviewStatus', 'needsAttention', 'recommendation', 'reviewedAt', 'scores'
    ])
  })
})

describe('mergeAiReview', function() {
  it('creates new entry when no existing aiReview', function() {
    const incoming = {
      recommendation: 'approve',
      scores: { total: 7 },
      reviewedAt: '2026-01-01'
    }
    const { aiReview, status } = mergeAiReview(null, incoming)
    expect(status).toBe('created')
    expect(aiReview.recommendation).toBe('approve')
    expect(aiReview.history).toEqual([])
  })

  it('creates new entry when existing has no reviewedAt', function() {
    const existing = { humanReviewStatus: 'awaiting-review' }
    const incoming = { recommendation: 'approve', reviewedAt: '2026-01-01', scores: { total: 7 } }
    const { status } = mergeAiReview(existing, incoming)
    expect(status).toBe('created')
  })

  it('returns unchanged for idempotent reviewedAt', function() {
    const existing = { recommendation: 'approve', reviewedAt: '2026-01-01', history: [] }
    const incoming = { recommendation: 'revise', reviewedAt: '2026-01-01' }
    const { aiReview, status } = mergeAiReview(existing, incoming)
    expect(status).toBe('unchanged')
    expect(aiReview.recommendation).toBe('approve') // keeps existing
  })

  it('rotates current to history when incoming is newer', function() {
    const existing = {
      recommendation: 'revise',
      scores: { total: 5 },
      needsAttention: true,
      humanReviewStatus: 'needs-review',
      reviewedAt: '2026-01-01',
      history: []
    }
    const incoming = {
      recommendation: 'approve',
      scores: { total: 7 },
      needsAttention: false,
      humanReviewStatus: 'approved',
      reviewedAt: '2026-02-01'
    }
    const { aiReview, status } = mergeAiReview(existing, incoming)
    expect(status).toBe('updated')
    expect(aiReview.recommendation).toBe('approve')
    expect(aiReview.reviewedAt).toBe('2026-02-01')
    expect(aiReview.history).toHaveLength(1)
    expect(aiReview.history[0].recommendation).toBe('revise')
    expect(aiReview.history[0].reviewedAt).toBe('2026-01-01')
  })

  it('preserves existing sign-off details when incoming is newer', function() {
    const existing = {
      recommendation: 'approve',
      reviewedAt: '2026-01-01',
      approvedBy: 'Alice',
      approvedAt: '2026-01-15',
      history: []
    }
    const incoming = {
      recommendation: 'approve',
      reviewedAt: '2026-02-01'
    }
    const { aiReview } = mergeAiReview(existing, incoming)
    expect(aiReview.approvedBy).toBe('Alice')
    expect(aiReview.approvedAt).toBe('2026-01-15')
  })

  it('inserts older entry at correct position in history', function() {
    const existing = {
      recommendation: 'approve',
      reviewedAt: '2026-03-01',
      history: [
        { recommendation: 'revise', reviewedAt: '2026-01-01', scores: {}, needsAttention: false, humanReviewStatus: 'awaiting-review' }
      ]
    }
    const incoming = {
      recommendation: 'approve',
      scores: { total: 6 },
      needsAttention: false,
      humanReviewStatus: 'awaiting-review',
      reviewedAt: '2026-02-01'
    }
    const { aiReview, status } = mergeAiReview(existing, incoming)
    expect(status).toBe('updated')
    expect(aiReview.history).toHaveLength(2)
    expect(aiReview.history[0].reviewedAt).toBe('2026-02-01')
    expect(aiReview.history[1].reviewedAt).toBe('2026-01-01')
  })

  it('returns unchanged for duplicate history entry', function() {
    const existing = {
      recommendation: 'approve',
      reviewedAt: '2026-03-01',
      history: [
        { recommendation: 'revise', reviewedAt: '2026-01-01', scores: {}, needsAttention: false, humanReviewStatus: 'awaiting-review' }
      ]
    }
    const incoming = { recommendation: 'revise', reviewedAt: '2026-01-01' }
    const { status } = mergeAiReview(existing, incoming)
    expect(status).toBe('unchanged')
  })

  it('applies smart eviction when history is full', function() {
    const history = []
    for (let i = 0; i < MAX_HISTORY; i++) {
      history.push({
        recommendation: 'revise',
        scores: {},
        needsAttention: false,
        humanReviewStatus: 'awaiting-review',
        reviewedAt: '2026-01-' + String(MAX_HISTORY - i).padStart(2, '0')
      })
    }
    const existing = {
      recommendation: 'approve',
      reviewedAt: '2026-03-01',
      history
    }

    // Older than everything — should be evicted
    const oldIncoming = { recommendation: 'reject', reviewedAt: '2025-12-01' }
    const { status: oldStatus } = mergeAiReview(existing, oldIncoming)
    expect(oldStatus).toBe('unchanged')

    // Newer than oldest — should be inserted (use Feb date to avoid collision with Jan dates)
    const newIncoming = {
      recommendation: 'approve',
      scores: { total: 7 },
      needsAttention: false,
      humanReviewStatus: 'approved',
      reviewedAt: '2026-02-15'
    }
    const { status: newStatus, aiReview } = mergeAiReview(existing, newIncoming)
    expect(newStatus).toBe('updated')
    expect(aiReview.history).toHaveLength(MAX_HISTORY)
  })
})
