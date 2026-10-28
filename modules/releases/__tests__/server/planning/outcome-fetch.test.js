import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchOutcomesInPriorityOrder, getPriorityOutcomes } from '../../../server/planning/outcome-fetch'

describe('outcome-fetch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('fetchOutcomesInPriorityOrder', () => {
    it('returns empty array when jiraRequest is not available', async () => {
      const result = await fetchOutcomesInPriorityOrder(null)
      expect(result).toEqual([])
    })

    it('fetches outcomes from Jira and returns in priority order', async () => {
      const mockJiraRequest = vi.fn().mockResolvedValue({
        issues: [
          {
            key: 'RHAISTRAT-3004',
            fields: { summary: 'Deliver a Production-Ready, Praxis-Native AI Gateway' }
          },
          {
            key: 'RHAISTRAT-1981',
            fields: { summary: 'Outcome: Platform User Experience for Model Serving' }
          }
        ]
      })

      const result = await fetchOutcomesInPriorityOrder(mockJiraRequest)

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        key: 'RHAISTRAT-3004',
        title: 'Deliver a Production-Ready, Praxis-Native AI Gateway',
        orderNumber: 1
      })
      expect(result[1]).toEqual({
        key: 'RHAISTRAT-1981',
        title: 'Outcome: Platform User Experience for Model Serving',
        orderNumber: 2
      })
    })

    it('handles missing summaries gracefully', async () => {
      const mockJiraRequest = vi.fn().mockResolvedValue({
        issues: [
          { key: 'RHAISTRAT-3004', fields: {} },
          { key: 'RHAISTRAT-1981', fields: { summary: 'Outcome: Platform User Experience for Model Serving' } }
        ]
      })

      const result = await fetchOutcomesInPriorityOrder(mockJiraRequest)

      expect(result).toHaveLength(2)
      expect(result[0].title).toBe('')
      expect(result[1].title).toBe('Outcome: Platform User Experience for Model Serving')
    })

    it('returns empty array on Jira error', async () => {
      const mockJiraRequest = vi.fn().mockRejectedValue(new Error('Jira API error'))

      const result = await fetchOutcomesInPriorityOrder(mockJiraRequest)

      expect(result).toEqual([])
    })
  })

  describe('getPriorityOutcomes', () => {
    it('returns cached outcomes when available', async () => {
      const cachedOutcomes = [
        { orderNumber: 1, key: 'RHAISTRAT-3004', title: 'Deliver a Production-Ready, Praxis-Native AI Gateway' }
      ]

      const mockReadFromStorage = vi.fn().mockResolvedValue(cachedOutcomes)
      const mockWriteToStorage = vi.fn()
      const mockJiraRequest = vi.fn()

      const result = await getPriorityOutcomes(mockJiraRequest, mockReadFromStorage, mockWriteToStorage)

      expect(result).toEqual(cachedOutcomes)
      expect(mockJiraRequest).not.toHaveBeenCalled()
    })

    it('fetches from Jira when cache is empty', async () => {
      const mockReadFromStorage = vi.fn().mockResolvedValue(null)
      const mockWriteToStorage = vi.fn().mockResolvedValue(undefined)
      const mockJiraRequest = vi.fn().mockResolvedValue({
        issues: [
          {
            key: 'RHAISTRAT-3004',
            fields: { summary: 'Deliver a Production-Ready, Praxis-Native AI Gateway' }
          }
        ]
      })

      const result = await getPriorityOutcomes(mockJiraRequest, mockReadFromStorage, mockWriteToStorage)

      expect(result).toHaveLength(1)
      expect(result[0].key).toBe('RHAISTRAT-3004')
      expect(mockWriteToStorage).toHaveBeenCalledWith(
        'releases/planning/priority-outcomes.json',
        expect.any(Array)
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
          }
        ]
      })

      const result = await getPriorityOutcomes(mockJiraRequest, mockReadFromStorage, mockWriteToStorage)

      // Should still return fetched outcomes even if write fails
      expect(result).toHaveLength(1)
      expect(result[0].key).toBe('RHAISTRAT-3004')
    })
  })
})
