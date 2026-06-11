import { describe, it, expect } from 'vitest'

const { mergeFeatureData, rebuildIndex, AI_REVIEW_FIELDS } = require('../feature-store')

describe('AI_REVIEW_FIELDS', function() {
  it('includes aiReview', function() {
    expect(AI_REVIEW_FIELDS).toContain('aiReview')
  })
})

describe('mergeFeatureData — aiReview handling', function() {
  it('preserves existing aiReview when pipeline data arrives', function() {
    const existing = {
      key: 'TEST-1',
      aiReview: { recommendation: 'approve', scores: { total: 7 } }
    }
    const merged = mergeFeatureData(existing, { key: 'TEST-1', metrics: {} }, null)
    expect(merged.aiReview).toEqual({ recommendation: 'approve', scores: { total: 7 } })
  })

  it('preserves existing aiReview when Jira data arrives without aiReview', function() {
    const existing = {
      key: 'TEST-1',
      aiReview: { recommendation: 'approve', scores: { total: 7 } }
    }
    const merged = mergeFeatureData(existing, null, { key: 'TEST-1', status: 'In Progress' })
    expect(merged.aiReview).toEqual({ recommendation: 'approve', scores: { total: 7 } })
  })

  it('merges aiReview from Jira enrichment into existing', function() {
    const existing = {
      key: 'TEST-1',
      aiReview: { recommendation: 'approve', scores: { total: 7 }, reviewedAt: '2026-01-01' }
    }
    const jiraData = {
      key: 'TEST-1',
      aiReview: { humanReviewStatus: 'approved', approvedBy: 'Alice' }
    }
    const merged = mergeFeatureData(existing, null, jiraData)
    expect(merged.aiReview.recommendation).toBe('approve')
    expect(merged.aiReview.scores.total).toBe(7)
    expect(merged.aiReview.humanReviewStatus).toBe('approved')
    expect(merged.aiReview.approvedBy).toBe('Alice')
  })

  it('does not create aiReview from Jira when no existing aiReview', function() {
    const existing = { key: 'TEST-1' }
    const jiraData = { key: 'TEST-1', aiReview: { humanReviewStatus: 'awaiting-review' } }
    const merged = mergeFeatureData(existing, null, jiraData)
    expect(merged.aiReview).toBeUndefined()
  })

  it('does not create aiReview when Jira data has no aiReview', function() {
    const existing = { key: 'TEST-1' }
    const jiraData = { key: 'TEST-1', status: 'New' }
    const merged = mergeFeatureData(existing, null, jiraData)
    expect(merged.aiReview).toBeUndefined()
  })

  it('does not let pipeline data overwrite aiReview', function() {
    const existing = { key: 'TEST-1', aiReview: { recommendation: 'approve' } }
    const pipelineData = { key: 'TEST-1', metrics: { totalEpics: 5 } }
    const merged = mergeFeatureData(existing, pipelineData, null)
    expect(merged.aiReview).toEqual({ recommendation: 'approve' })
    expect(merged.metrics.totalEpics).toBe(5)
  })
})

describe('rebuildIndex — aiReview summary', function() {
  it('includes slim aiReview in index entries for features with aiReview', function() {
    const stored = {}
    const storage = {
      listStorageFiles: function() { return ['TEST-1.json'] },
      readFromStorage: function(path) {
        if (path.endsWith('TEST-1.json')) {
          return {
            key: 'TEST-1',
            summary: 'Test',
            aiReview: {
              recommendation: 'approve',
              scores: { feasibility: 2, testability: 1, scope: 2, architecture: 2, total: 7 },
              humanReviewStatus: 'approved',
              needsAttention: false,
              reviewedAt: '2026-01-01',
              title: 'Should not be in index',
              history: [{ scores: {} }]
            }
          }
        }
        return null
      },
      writeToStorage: function(path, data) {
        stored[path] = data
      }
    }

    rebuildIndex(storage)

    const index = stored['releases/execution/index.json']
    expect(index.features[0].aiReview).toEqual({
      recommendation: 'approve',
      scores: { feasibility: 2, testability: 1, scope: 2, architecture: 2, total: 7 },
      humanReviewStatus: 'approved',
      needsAttention: false,
      reviewedAt: '2026-01-01'
    })
    // Should NOT include title or history in index
    expect(index.features[0].aiReview.title).toBeUndefined()
    expect(index.features[0].aiReview.history).toBeUndefined()
  })

  it('sets aiReview to null in index for features without aiReview', function() {
    const stored = {}
    const storage = {
      listStorageFiles: function() { return ['TEST-2.json'] },
      readFromStorage: function(path) {
        if (path.endsWith('TEST-2.json')) {
          return { key: 'TEST-2', summary: 'No AI review' }
        }
        return null
      },
      writeToStorage: function(path, data) {
        stored[path] = data
      }
    }

    rebuildIndex(storage)

    const index = stored['releases/execution/index.json']
    expect(index.features[0].aiReview).toBeNull()
  })
})
