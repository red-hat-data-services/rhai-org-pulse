import { describe, it, expect, vi } from 'vitest'

const { fetchFeatures, normalizeIssue, JQL, QUERY_FIELDS } = require('../feature-query')
const { CUSTOM_FIELDS } = require('../../hygiene/jira-fetch')

describe('feature-query', function() {

  describe('JQL', function() {
    it('queries RHAISTRAT Features and Initiatives excluding closed statuses', function() {
      expect(JQL).toContain('project = RHAISTRAT')
      expect(JQL).toContain('issuetype IN (Feature, Initiative)')
      expect(JQL).toContain('status NOT IN (Closed, Done, Resolved, Cancelled)')
    })

    it('does not include a created date filter', function() {
      expect(JQL).not.toContain('created')
    })
  })

  describe('QUERY_FIELDS', function() {
    it('includes standard Jira fields', function() {
      expect(QUERY_FIELDS).toContain('summary')
      expect(QUERY_FIELDS).toContain('status')
      expect(QUERY_FIELDS).toContain('issuetype')
      expect(QUERY_FIELDS).toContain('assignee')
      expect(QUERY_FIELDS).toContain('fixVersions')
      expect(QUERY_FIELDS).toContain('components')
      expect(QUERY_FIELDS).toContain('labels')
      expect(QUERY_FIELDS).toContain('priority')
    })

    it('includes custom field IDs for team, targetVersion, riceScore', function() {
      expect(QUERY_FIELDS).toContain(CUSTOM_FIELDS.team)
      expect(QUERY_FIELDS).toContain(CUSTOM_FIELDS.targetVersion)
      expect(QUERY_FIELDS).toContain(CUSTOM_FIELDS.riceScore)
    })
  })

  describe('normalizeIssue', function() {
    it('extracts key and summary', function() {
      var result = normalizeIssue({ key: 'RHAISTRAT-1', fields: { summary: 'My Feature' } })
      expect(result.key).toBe('RHAISTRAT-1')
      expect(result.summary).toBe('My Feature')
    })

    it('extracts assignee displayName from object', function() {
      var result = normalizeIssue({
        key: 'RHAISTRAT-2',
        fields: { assignee: { displayName: 'Jane Doe', emailAddress: 'jane@example.com' } }
      })
      expect(result.assignee).toBe('Jane Doe')
    })

    it('handles assignee as string', function() {
      var result = normalizeIssue({ key: 'RHAISTRAT-3', fields: { assignee: 'John' } })
      expect(result.assignee).toBe('John')
    })

    it('handles null assignee', function() {
      var result = normalizeIssue({ key: 'RHAISTRAT-4', fields: { assignee: null } })
      expect(result.assignee).toBeNull()
    })

    it('extracts component names from objects', function() {
      var result = normalizeIssue({
        key: 'RHAISTRAT-5',
        fields: { components: [{ name: 'UI' }, { name: 'API' }] }
      })
      expect(result.components).toEqual(['UI', 'API'])
    })

    it('handles missing components', function() {
      var result = normalizeIssue({ key: 'RHAISTRAT-6', fields: {} })
      expect(result.components).toEqual([])
    })

    it('extracts fixVersion names from objects', function() {
      var result = normalizeIssue({
        key: 'RHAISTRAT-7',
        fields: { fixVersions: [{ name: 'rhoai-3.6' }] }
      })
      expect(result.fixVersions).toEqual(['rhoai-3.6'])
    })

    it('extracts status name from object', function() {
      var result = normalizeIssue({
        key: 'RHAISTRAT-8',
        fields: { status: { name: 'In Progress' } }
      })
      expect(result.status).toBe('In Progress')
    })

    it('handles status as string', function() {
      var result = normalizeIssue({ key: 'RHAISTRAT-9', fields: { status: 'New' } })
      expect(result.status).toBe('New')
    })

    it('extracts priority name from object', function() {
      var result = normalizeIssue({
        key: 'RHAISTRAT-10',
        fields: { priority: { name: 'Major' } }
      })
      expect(result.priority).toBe('Major')
    })

    it('extracts issueType name from object', function() {
      var result = normalizeIssue({
        key: 'RHAISTRAT-11',
        fields: { issuetype: { name: 'Feature' } }
      })
      expect(result.issueType).toBe('Feature')
    })

    it('preserves labels array', function() {
      var result = normalizeIssue({
        key: 'RHAISTRAT-12',
        fields: { labels: ['strat-creator-human-sign-off', 'priority-1'] }
      })
      expect(result.labels).toEqual(['strat-creator-human-sign-off', 'priority-1'])
    })

    it('extracts team from custom field', function() {
      var fields = {}
      fields[CUSTOM_FIELDS.team] = { value: 'Platform' }
      var result = normalizeIssue({ key: 'RHAISTRAT-13', fields: fields })
      expect(result.team).toBe('Platform')
    })

    it('extracts targetVersion from custom field', function() {
      var fields = {}
      fields[CUSTOM_FIELDS.targetVersion] = { name: 'rhoai-3.6' }
      var result = normalizeIssue({ key: 'RHAISTRAT-14', fields: fields })
      expect(result.targetVersions).toEqual(['rhoai-3.6'])
    })

    it('returns empty targetVersions when custom field is null', function() {
      var result = normalizeIssue({ key: 'RHAISTRAT-15', fields: {} })
      expect(result.targetVersions).toEqual([])
    })

    it('extracts riceScore from custom field', function() {
      var fields = {}
      fields[CUSTOM_FIELDS.riceScore] = 42
      var result = normalizeIssue({ key: 'RHAISTRAT-16', fields: fields })
      expect(result.riceScore).toBe(42)
    })

    it('handles completely empty fields', function() {
      var result = normalizeIssue({ key: 'RHAISTRAT-17', fields: {} })
      expect(result.key).toBe('RHAISTRAT-17')
      expect(result.summary).toBe('')
      expect(result.status).toBeNull()
      expect(result.assignee).toBeNull()
      expect(result.components).toEqual([])
      expect(result.fixVersions).toEqual([])
      expect(result.labels).toEqual([])
      expect(result.targetVersions).toEqual([])
      expect(result.priority).toBeNull()
      expect(result.riceScore).toBeNull()
    })

    it('handles missing fields object', function() {
      var result = normalizeIssue({ key: 'RHAISTRAT-18' })
      expect(result.key).toBe('RHAISTRAT-18')
      expect(result.summary).toBe('')
    })
  })

  describe('fetchFeatures', function() {
    it('returns empty Map when jiraClient is null', async function() {
      var result = await fetchFeatures(null)
      expect(result).toBeInstanceOf(Map)
      expect(result.size).toBe(0)
    })

    it('returns empty Map when jiraClient has no fetchAllJqlResults', async function() {
      var result = await fetchFeatures({})
      expect(result).toBeInstanceOf(Map)
      expect(result.size).toBe(0)
    })

    it('calls fetchAllJqlResults with correct JQL and fields', async function() {
      var mockFetch = vi.fn().mockResolvedValue([])
      var client = { fetchAllJqlResults: mockFetch }

      await fetchFeatures(client)

      expect(mockFetch).toHaveBeenCalledWith(JQL, QUERY_FIELDS, { maxResults: 100 })
    })

    it('returns Map keyed by issue key', async function() {
      var issues = [
        { key: 'RHAISTRAT-100', fields: { summary: 'Feature A', status: { name: 'In Progress' } } },
        { key: 'RHAISTRAT-200', fields: { summary: 'Feature B', status: { name: 'New' } } }
      ]
      var client = { fetchAllJqlResults: vi.fn().mockResolvedValue(issues) }

      var result = await fetchFeatures(client)

      expect(result.size).toBe(2)
      expect(result.get('RHAISTRAT-100').summary).toBe('Feature A')
      expect(result.get('RHAISTRAT-200').summary).toBe('Feature B')
    })

    it('skips issues without a key', async function() {
      var issues = [
        { key: 'RHAISTRAT-100', fields: { summary: 'Valid' } },
        { key: null, fields: { summary: 'No key' } },
        { fields: { summary: 'Also no key' } }
      ]
      var client = { fetchAllJqlResults: vi.fn().mockResolvedValue(issues) }

      var result = await fetchFeatures(client)

      expect(result.size).toBe(1)
      expect(result.has('RHAISTRAT-100')).toBe(true)
    })

    it('normalizes all fields in returned features', async function() {
      var fields = {
        summary: 'Test Feature',
        status: { name: 'In Progress' },
        issuetype: { name: 'Feature' },
        assignee: { displayName: 'Alice' },
        components: [{ name: 'Dashboard' }],
        fixVersions: [{ name: 'rhoai-3.6' }],
        labels: ['strat-creator-human-sign-off'],
        priority: { name: 'Major' }
      }
      fields[CUSTOM_FIELDS.team] = { value: 'Platform' }
      fields[CUSTOM_FIELDS.targetVersion] = { name: 'rhoai-3.6' }
      fields[CUSTOM_FIELDS.riceScore] = 150

      var client = { fetchAllJqlResults: vi.fn().mockResolvedValue([{ key: 'RHAISTRAT-300', fields: fields }]) }

      var result = await fetchFeatures(client)
      var feature = result.get('RHAISTRAT-300')

      expect(feature.summary).toBe('Test Feature')
      expect(feature.status).toBe('In Progress')
      expect(feature.issueType).toBe('Feature')
      expect(feature.assignee).toBe('Alice')
      expect(feature.components).toEqual(['Dashboard'])
      expect(feature.fixVersions).toEqual(['rhoai-3.6'])
      expect(feature.labels).toEqual(['strat-creator-human-sign-off'])
      expect(feature.priority).toBe('Major')
      expect(feature.team).toBe('Platform')
      expect(feature.targetVersions).toEqual(['rhoai-3.6'])
      expect(feature.riceScore).toBe(150)
    })
  })
})
