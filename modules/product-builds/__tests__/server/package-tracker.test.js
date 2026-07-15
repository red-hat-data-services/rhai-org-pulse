import { describe, it, expect, vi } from 'vitest'

const registerRoutes = require('../../server/package-tracker')
const {
  extractAdfText, extractJiraLinks, parseDescriptionFields,
  computeRisk, computeLeadTime, extractTargetVersions,
} = registerRoutes._testExports

describe('package-tracker', () => {
  describe('extractAdfText', () => {
    it('returns empty for null', () => {
      expect(extractAdfText(null)).toBe('')
    })

    it('extracts text from simple ADF', () => {
      const adf = {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Hello ' }, { type: 'text', text: 'world' }] }
        ]
      }
      expect(extractAdfText(adf)).toBe('Hello world')
    })

    it('handles nested content', () => {
      const adf = {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Target Date: 2026-07-01' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Team: Platform' }] }
        ]
      }
      expect(extractAdfText(adf)).toContain('Target Date: 2026-07-01')
      expect(extractAdfText(adf)).toContain('Team: Platform')
    })
  })

  describe('extractJiraLinks', () => {
    it('returns empty for null', () => {
      expect(extractJiraLinks(null)).toEqual([])
    })

    it('extracts from inlineCard', () => {
      const node = {
        type: 'inlineCard',
        attrs: { url: 'https://redhat.atlassian.net/browse/RHEL-5678' }
      }
      expect(extractJiraLinks(node)).toEqual(['RHEL-5678'])
    })

    it('extracts from text with link mark', () => {
      const node = {
        type: 'text',
        text: 'Related ticket',
        marks: [{ type: 'link', attrs: { href: 'https://redhat.atlassian.net/browse/AIPCC-123' } }]
      }
      expect(extractJiraLinks(node)).toEqual(['AIPCC-123'])
    })

    it('recurses into content', () => {
      const node = {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [
            { type: 'inlineCard', attrs: { url: 'https://redhat.atlassian.net/browse/ABC-1' } },
            { type: 'inlineCard', attrs: { url: 'https://redhat.atlassian.net/browse/DEF-2' } }
          ]}
        ]
      }
      expect(extractJiraLinks(node)).toEqual(['ABC-1', 'DEF-2'])
    })

    it('ignores non-atlassian URLs', () => {
      const node = {
        type: 'inlineCard',
        attrs: { url: 'https://github.com/some/repo' }
      }
      expect(extractJiraLinks(node)).toEqual([])
    })
  })

  describe('parseDescriptionFields', () => {
    it('returns defaults for null', () => {
      const result = parseDescriptionFields(null)
      expect(result).toEqual({ targetDate: null, release: null, relatedTicket: null, team: null, requester: null })
    })

    it('extracts target date', () => {
      const adf = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Target Date: 2026-07-15' }] }] }
      expect(parseDescriptionFields(adf).targetDate).toBe('2026-07-15')
    })

    it('extracts release commitment', () => {
      const adf = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Release Commitment: 3.5 EA2 Testing' }] }] }
      expect(parseDescriptionFields(adf).release).toBe('3.5 EA2')
    })

    it('extracts related ticket from text', () => {
      const adf = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Related Jira Ticket: AIPCC-18313' }] }] }
      expect(parseDescriptionFields(adf).relatedTicket).toBe('AIPCC-18313')
    })

    it('prefers inlineCard links over text regex', () => {
      const adf = {
        type: 'doc',
        content: [{
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Related Jira Ticket: AIPCC-999' },
            { type: 'inlineCard', attrs: { url: 'https://redhat.atlassian.net/browse/AIPCC-111' } }
          ]
        }]
      }
      expect(parseDescriptionFields(adf).relatedTicket).toBe('AIPCC-111')
    })

    it('extracts team', () => {
      const adf = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Team: PyTorch Package' }] }] }
      expect(parseDescriptionFields(adf).team).toBe('PyTorch')
    })

    it('extracts requester email', () => {
      const adf = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Requester: user@redhat.com' }] }] }
      expect(parseDescriptionFields(adf).requester).toBe('user@redhat.com')
    })
  })

  describe('computeRisk', () => {
    it('returns no_date for null', () => {
      expect(computeRisk(null)).toEqual({ days_overdue: null, risk: 'no_date' })
    })

    it('returns no_date for invalid date', () => {
      expect(computeRisk('not-a-date')).toEqual({ days_overdue: null, risk: 'no_date' })
    })

    it('returns overdue for past dates', () => {
      const result = computeRisk('2020-01-01')
      expect(result.risk).toBe('overdue')
      expect(result.days_overdue).toBeGreaterThan(0)
    })

    it('returns on_track for far future dates', () => {
      const result = computeRisk('2099-12-31')
      expect(result.risk).toBe('on_track')
      expect(result.days_overdue).toBeLessThan(-7)
    })
  })

  describe('computeLeadTime', () => {
    it('returns null for missing dates', () => {
      expect(computeLeadTime(null, '2026-01-01')).toEqual({ lead_time: null, lead_time_flag: null })
      expect(computeLeadTime('2026-01-01', null)).toEqual({ lead_time: null, lead_time_flag: null })
    })

    it('flags critical for <= 3 days', () => {
      const result = computeLeadTime('2026-01-03', '2026-01-01')
      expect(result.lead_time).toBe(2)
      expect(result.lead_time_flag).toBe('critical')
    })

    it('flags tight for <= 7 days', () => {
      const result = computeLeadTime('2026-01-07', '2026-01-01')
      expect(result.lead_time).toBe(6)
      expect(result.lead_time_flag).toBe('tight')
    })

    it('returns null flag for > 7 days', () => {
      const result = computeLeadTime('2026-01-20', '2026-01-01')
      expect(result.lead_time).toBe(19)
      expect(result.lead_time_flag).toBeNull()
    })
  })

  describe('extractTargetVersions', () => {
    it('returns empty for null', () => {
      expect(extractTargetVersions(null)).toEqual([])
    })

    it('handles array of objects', () => {
      expect(extractTargetVersions([{ name: '3.5 GA' }, { name: '3.4' }])).toEqual(['3.5 GA', '3.4'])
    })

    it('handles single object', () => {
      expect(extractTargetVersions({ name: '3.5 EA1' })).toEqual(['3.5 EA1'])
    })

    it('filters empty names', () => {
      expect(extractTargetVersions([{ name: '' }, { name: '3.5' }])).toEqual(['3.5'])
    })
  })

  describe('route registration', () => {
    it('registers GET and POST routes', () => {
      const router = { get: vi.fn(), post: vi.fn() }
      const context = { secrets: {}, requireAdmin: vi.fn() }
      registerRoutes(router, context)
      expect(router.get).toHaveBeenCalledWith('/package-tracker', expect.any(Function))
      expect(router.post).toHaveBeenCalledWith('/package-tracker/refresh', context.requireAdmin, expect.any(Function))
    })
  })
})
