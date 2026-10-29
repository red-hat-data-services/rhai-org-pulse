import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchOutcomesInPriorityOrder, getPriorityOutcomes } from '../../../server/planning/outcome-fetch'

describe('outcome-fetch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const SAMPLE_FALLBACKS = [
    { key: 'RHAISTRAT-3004', title: 'Deliver a Production-Ready, Praxis-Native AI Gateway', orderNumber: 1 },
    { key: 'RHAISTRAT-1981', title: 'Outcome: Platform User Experience for Model Serving', orderNumber: 2 }
  ]

  describe('fetchOutcomesInPriorityOrder', () => {
    it('returns empty array when jiraRequest is not available', async () => {
      const result = await fetchOutcomesInPriorityOrder(null, SAMPLE_FALLBACKS)
      expect(result).toEqual([])
    })

    it('returns empty array when fallbackOutcomes is missing', async () => {
      const mockJiraRequest = vi.fn()
      const result = await fetchOutcomesInPriorityOrder(mockJiraRequest, null)
      expect(result).toEqual([])
    })

    it('fetches fresh titles from Jira and merges with fallback ordering', async () => {
      const mockJiraRequest = vi.fn().mockResolvedValue({
        issues: [
          {
            key: 'RHAISTRAT-3004',
            fields: { summary: 'Fresh Gateway Title' }
          },
          {
            key: 'RHAISTRAT-1981',
            fields: { summary: 'Fresh Model Serving Title' }
          }
        ]
      })

      const result = await fetchOutcomesInPriorityOrder(mockJiraRequest, SAMPLE_FALLBACKS)

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        key: 'RHAISTRAT-3004',
        title: 'Fresh Gateway Title',
        orderNumber: 1
      })
      expect(result[1]).toEqual({
        key: 'RHAISTRAT-1981',
        title: 'Fresh Model Serving Title',
        orderNumber: 2
      })
    })

    it('uses fallback titles when Jira returns missing summaries', async () => {
      const mockJiraRequest = vi.fn().mockResolvedValue({
        issues: [
          { key: 'RHAISTRAT-3004', fields: {} },
          { key: 'RHAISTRAT-1981', fields: { summary: 'Fresh Model Serving Title' } }
        ]
      })

      const result = await fetchOutcomesInPriorityOrder(mockJiraRequest, SAMPLE_FALLBACKS)

      expect(result).toHaveLength(2)
      expect(result[0].title).toBe('Deliver a Production-Ready, Praxis-Native AI Gateway')
      expect(result[1].title).toBe('Fresh Model Serving Title')
    })

    it('returns empty array on Jira error', async () => {
      const mockJiraRequest = vi.fn().mockRejectedValue(new Error('Jira API error'))

      const result = await fetchOutcomesInPriorityOrder(mockJiraRequest, SAMPLE_FALLBACKS)

      expect(result).toEqual([])
    })
  })

  describe('getPriorityOutcomes', () => {
    it('returns cached outcomes when available and fresh', async () => {
      const cachedOutcomes = [
        { orderNumber: 1, key: 'RHAISTRAT-3004', title: 'Deliver a Production-Ready, Praxis-Native AI Gateway' }
      ]

      const mockReadFromStorage = vi.fn().mockResolvedValue({ data: cachedOutcomes, timestamp: Date.now() })
      const mockWriteToStorage = vi.fn()
      const mockJiraRequest = vi.fn()

      const result = await getPriorityOutcomes(mockJiraRequest, mockReadFromStorage, mockWriteToStorage, SAMPLE_FALLBACKS)

      expect(result).toEqual(cachedOutcomes)
      expect(mockJiraRequest).not.toHaveBeenCalled()
    })

    it('refreshes when cache is expired', async () => {
      const staleOutcomes = [
        { orderNumber: 1, key: 'RHAISTRAT-3004', title: 'Old title' }
      ]
      const thirteenHoursAgo = Date.now() - 13 * 60 * 60 * 1000

      const mockReadFromStorage = vi.fn().mockResolvedValue({ data: staleOutcomes, timestamp: thirteenHoursAgo })
      const mockWriteToStorage = vi.fn().mockResolvedValue(undefined)
      const mockJiraRequest = vi.fn().mockResolvedValue({
        issues: [
          { key: 'RHAISTRAT-3004', fields: { summary: 'Fresh title' } },
          { key: 'RHAISTRAT-1981', fields: { summary: 'Fresh Model Serving' } }
        ]
      })

      const result = await getPriorityOutcomes(mockJiraRequest, mockReadFromStorage, mockWriteToStorage, SAMPLE_FALLBACKS)

      expect(result).toHaveLength(2)
      expect(result[0].title).toBe('Fresh title')
      expect(mockJiraRequest).toHaveBeenCalled()
    })

    it('fetches from Jira when cache is empty', async () => {
      const mockReadFromStorage = vi.fn().mockResolvedValue(null)
      const mockWriteToStorage = vi.fn().mockResolvedValue(undefined)
      const mockJiraRequest = vi.fn().mockResolvedValue({
        issues: [
          {
            key: 'RHAISTRAT-3004',
            fields: { summary: 'Deliver a Production-Ready, Praxis-Native AI Gateway' }
          },
          {
            key: 'RHAISTRAT-1981',
            fields: { summary: 'Fresh Model Serving' }
          }
        ]
      })

      const result = await getPriorityOutcomes(mockJiraRequest, mockReadFromStorage, mockWriteToStorage, SAMPLE_FALLBACKS)

      expect(result).toHaveLength(2)
      expect(result[0].key).toBe('RHAISTRAT-3004')
      expect(mockWriteToStorage).toHaveBeenCalledWith(
        'releases/planning/priority-outcomes.json',
        expect.objectContaining({ data: expect.any(Array), timestamp: expect.any(Number) })
      )
    })

    it('handles storage write failures gracefully', async () => {
      const mockReadFromStorage = vi.fn().mockResolvedValue(null)
      const mockWriteToStorage = vi.fn().mockRejectedValue(new Error('Storage error'))
      const mockJiraRequest = vi.fn().mockResolvedValue({
        issues: [
          {
            key: 'RHAISTRAT-3004',
            fields: { summary: 'Deliver a Production-Ready, Praxis-Native AI Gateway' }
          },
          {
            key: 'RHAISTRAT-1981',
            fields: { summary: 'Fresh Model Serving' }
          }
        ]
      })

      const result = await getPriorityOutcomes(mockJiraRequest, mockReadFromStorage, mockWriteToStorage, SAMPLE_FALLBACKS)

      expect(result).toHaveLength(2)
      expect(result[0].key).toBe('RHAISTRAT-3004')
    })
  })
})
