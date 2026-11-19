import { describe, it, expect, vi } from 'vitest'

const {
  PLAN,
  OUTCOME_JQL,
  normalizeIssue,
  fetchRankedOutcomes,
  fetchOutcomeChildren
} = require('../jira-plan')
const { CUSTOM_FIELDS } = require('../../hygiene/jira-fetch')

function jiraIssue(key, fields) {
  return { key: key, fields: fields || {} }
}

describe('jira-plan', function() {
  describe('OUTCOME_JQL', function() {
    it('queries open RHAISTRAT Outcomes in Jira Rank order', function() {
      expect(OUTCOME_JQL).toContain('project = RHAISTRAT')
      expect(OUTCOME_JQL).toContain('issuetype = Outcome')
      expect(OUTCOME_JQL).toContain('status not in (Closed, Done, Resolved, Cancelled)')
      expect(OUTCOME_JQL).toContain('ORDER BY Rank ASC')
    })
  })

  describe('normalizeIssue', function() {
    it('normalizes Plan display fields and links', function() {
      var fields = {
        summary: 'Ranked outcome',
        issuetype: { name: 'Outcome' },
        status: { name: 'In Progress', statusCategory: { name: 'In Progress' } },
        priority: { name: 'Critical' },
        assignee: { displayName: 'Ada Lovelace' },
        reporter: { displayName: 'Grace Hopper' },
        project: { key: 'RHAISTRAT' },
        components: [{ name: 'Dashboard' }, { name: 'Serving' }],
        fixVersions: [{ name: 'rhoai-3.7' }],
        labels: ['ranked']
      }
      fields[CUSTOM_FIELDS.targetVersion] = [{ name: '3.7 GA RHOAI RELEASE' }]
      fields[CUSTOM_FIELDS.productManager] = { displayName: 'PM Owner' }
      fields[CUSTOM_FIELDS.releaseType] = { value: 'GA' }

      var result = normalizeIssue(jiraIssue('RHAISTRAT-1', fields), 4)

      expect(result.key).toBe('RHAISTRAT-1')
      expect(result.rank).toBe(4)
      expect(result.summary).toBe('Ranked outcome')
      expect(result.status).toBe('In Progress')
      expect(result.statusCategory).toBe('In Progress')
      expect(result.priority).toBe('Critical')
      expect(result.assignee).toBe('Ada Lovelace')
      expect(result.productManager).toBe('PM Owner')
      expect(result.components).toEqual(['Dashboard', 'Serving'])
      expect(result.targetVersions).toEqual(['3.7 GA RHOAI RELEASE'])
      expect(result.fixVersions).toEqual(['rhoai-3.7'])
      expect(result.releaseType).toBe('GA')
      expect(result.url).toBe('https://redhat.atlassian.net/browse/RHAISTRAT-1')
    })
  })

  describe('fetchRankedOutcomes', function() {
    it('stops before the sentinel and numbers rows by rank', async function() {
      var client = {
        fetchAllJqlResults: vi.fn().mockResolvedValue([
          jiraIssue('RHAISTRAT-3004', { summary: 'First' }),
          jiraIssue('RHAISTRAT-1981', { summary: 'Second' }),
          jiraIssue(PLAN.sentinelKey, { summary: 'Cutoff marker' }),
          jiraIssue('RHAISTRAT-2046', { summary: 'Should not appear' })
        ])
      }

      var result = await fetchRankedOutcomes(client)

      expect(client.fetchAllJqlResults).toHaveBeenCalledWith(OUTCOME_JQL, expect.any(String), { maxResults: 100 })
      expect(result.sentinelKey).toBe(PLAN.sentinelKey)
      expect(result.outcomes.map(function(outcome) { return outcome.key })).toEqual([
        'RHAISTRAT-3004',
        'RHAISTRAT-1981'
      ])
      expect(result.outcomes.map(function(outcome) { return outcome.rank })).toEqual([1, 2])
    })

    it('fails closed when the ranked cutoff marker is missing', async function() {
      var client = {
        fetchAllJqlResults: vi.fn().mockResolvedValue([
          jiraIssue('RHAISTRAT-3004', { summary: 'First' })
        ])
      }

      await expect(fetchRankedOutcomes(client)).rejects.toThrow(/cutoff RHAISTRAT-2921 was not found/i)
    })

    it('rejects when Jira is not configured', async function() {
      await expect(fetchRankedOutcomes(null)).rejects.toThrow(/not configured/i)
    })
  })

  describe('fetchOutcomeChildren', function() {
    it('fetches open direct children for the requested Outcome', async function() {
      var client = {
        fetchAllJqlResults: vi.fn().mockResolvedValue([
          jiraIssue('RHAISTRAT-1935', {
            summary: 'Child feature',
            issuetype: { name: 'Feature' },
            status: { name: 'New', statusCategory: { name: 'To Do' } }
          }),
          jiraIssue('RHAISTRAT-1935', { summary: 'Duplicate child' })
        ])
      }

      var result = await fetchOutcomeChildren(client, 'RHAISTRAT-3004')

      expect(client.fetchAllJqlResults).toHaveBeenCalledTimes(1)
      var jql = client.fetchAllJqlResults.mock.calls[0][0]
      expect(jql).toContain('parent = "RHAISTRAT-3004"')
      expect(jql).toContain('"Epic Link" = "RHAISTRAT-3004"')
      expect(jql).toContain('status not in (Closed, Done, Resolved, Cancelled)')
      expect(result.children).toHaveLength(1)
      expect(result.children[0].key).toBe('RHAISTRAT-1935')
      expect(result.children[0].issueType).toBe('Feature')
    })

    it('rejects invalid issue keys before calling Jira', async function() {
      var client = { fetchAllJqlResults: vi.fn() }
      await expect(fetchOutcomeChildren(client, 'bad key')).rejects.toThrow(/invalid outcome key/i)
      expect(client.fetchAllJqlResults).not.toHaveBeenCalled()
    })
  })
})
