/**
 * Fail-soft delivered-in-version JQL and fetch.
 */
import { describe, it, expect, vi } from 'vitest'

const {
  DELIVERED_STATUSES,
  buildDeliveredJql,
  fetchDeliveredInVersion,
  normalizeIssues,
  quoteJql
} = require('../../../server/pm-hub/delivered-in-version')

describe('buildDeliveredJql', function() {
  it('returns null when no versions are selected', function() {
    expect(buildDeliveredJql([])).toBeNull()
    expect(buildDeliveredJql(null)).toBeNull()
  })

  it('requires Fix Version in the selected releases and Closed/Done/Resolved only', function() {
    var jql = buildDeliveredJql(['3.6 EA2 RHOAI RELEASE', '3.6 EA2 RHAII RELEASE'])
    expect(jql).toContain('project IN (RHAISTRAT, AIPCC)')
    expect(jql).toContain('issuetype IN (Feature, Initiative)')
    expect(jql).toContain('status IN (Closed, Done, Resolved)')
    expect(jql).toContain('fixVersion IN ("3.6 EA2 RHOAI RELEASE", "3.6 EA2 RHAII RELEASE")')
    expect(jql).not.toContain('Cancelled')
    expect(jql).not.toContain('Target Version')
    expect(jql).not.toContain('statusCategory')
  })

  it('adds a component clause when components are selected', function() {
    var jql = buildDeliveredJql(['3.6 EA2 RHOAI RELEASE'], ['GenAI Studio'])
    expect(jql).toContain('component IN ("GenAI Studio")')
  })

  it('quotes names that contain quotes', function() {
    expect(quoteJql('foo"bar')).toBe('"foo\\"bar"')
  })
})

describe('normalizeIssues', function() {
  it('dedupes by key and keeps fixVersions', function() {
    var issues = normalizeIssues([
      {
        key: 'RHAISTRAT-1',
        fields: {
          fixVersions: [{ name: '3.6 EA2 RHOAI RELEASE' }],
          components: [{ name: 'Dashboard' }]
        }
      },
      {
        key: 'RHAISTRAT-1',
        fields: { fixVersions: [{ name: 'dup' }] }
      }
    ])
    expect(issues).toHaveLength(1)
    expect(issues[0].key).toBe('RHAISTRAT-1')
    expect(issues[0].fixVersions).toEqual(['3.6 EA2 RHOAI RELEASE'])
    expect(issues[0].components).toEqual(['Dashboard'])
  })
})

describe('fetchDeliveredInVersion', function() {
  it('skips Jira when no versions are selected', async function() {
    var client = { fetchAllJqlResults: vi.fn() }
    var result = await fetchDeliveredInVersion(client, { versions: [] })
    expect(result.skipped).toBe('no-versions')
    expect(result.issues).toEqual([])
    expect(client.fetchAllJqlResults).not.toHaveBeenCalled()
  })

  it('returns timedOut when the search exceeds the timeout', async function() {
    var client = {
      fetchAllJqlResults: vi.fn().mockImplementation(function() {
        return new Promise(function() { /* never resolves */ })
      })
    }
    var result = await fetchDeliveredInVersion(client, {
      versions: ['3.6 EA2 RHOAI RELEASE'],
      timeoutMs: 20
    })
    expect(result.timedOut).toBe(true)
    expect(result.issues).toEqual([])
  })

  it('returns issues on success', async function() {
    var client = {
      fetchAllJqlResults: vi.fn().mockResolvedValue([
        {
          key: 'RHAISTRAT-9',
          fields: { fixVersions: [{ name: '3.6 EA2 RHOAI RELEASE' }], components: [] }
        }
      ])
    }
    var result = await fetchDeliveredInVersion(client, {
      versions: ['3.6 EA2 RHOAI RELEASE']
    })
    expect(result.timedOut).toBe(false)
    expect(result.issues).toHaveLength(1)
    expect(result.issues[0].key).toBe('RHAISTRAT-9')
    expect(client.fetchAllJqlResults.mock.calls[0][0]).toContain('status IN (' + DELIVERED_STATUSES.join(', ') + ')')
  })

  it('clears the timeout timer when Jira returns first', async function() {
    vi.useFakeTimers()
    try {
      var client = {
        fetchAllJqlResults: vi.fn().mockResolvedValue([])
      }
      await fetchDeliveredInVersion(client, {
        versions: ['3.6 EA2 RHOAI RELEASE'],
        timeoutMs: 8000
      })
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('fails soft when Jira throws', async function() {
    var client = {
      fetchAllJqlResults: vi.fn().mockRejectedValue(new Error('Jira down'))
    }
    var result = await fetchDeliveredInVersion(client, {
      versions: ['3.6 EA2 RHOAI RELEASE']
    })
    expect(result.error).toBe('fetch-failed')
    expect(result.issues).toEqual([])
  })
})
