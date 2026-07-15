import { describe, it, expect } from 'vitest'

const { transformIssue } = require('../jira-fetch')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal raw Jira issue with the given issuelinks.
 * Only fields relevant to blocked detection are populated.
 */
function makeRawIssue(issueLinks, overrides) {
  return Object.assign({
    key: 'RHAISTRAT-100',
    fields: Object.assign({
      summary: 'Test feature',
      status: { name: 'In Progress', statusCategory: { name: 'In Progress' } },
      issuetype: { name: 'Feature' },
      issuelinks: issueLinks
    }, overrides)
  })
}

/**
 * Build an inward "Blocks" link with the given blocking issue details.
 * @param {string} key - Blocking issue key
 * @param {string} statusName - Status name of the blocking issue
 * @param {string} statusCategoryName - Status category name of the blocking issue
 * @param {string} [summary] - Optional summary
 */
function makeBlocksLink(key, statusName, statusCategoryName, summary) {
  return {
    type: { name: 'Blocks', inward: 'is blocked by', outward: 'blocks' },
    inwardIssue: {
      key: key,
      fields: {
        summary: summary || 'Blocking issue ' + key,
        status: {
          name: statusName,
          statusCategory: { name: statusCategoryName }
        }
      }
    }
  }
}

/**
 * Build an outward "Blocks" link (this issue blocks another).
 */
function makeOutwardBlocksLink(key, statusName, statusCategoryName) {
  return {
    type: { name: 'Blocks', inward: 'is blocked by', outward: 'blocks' },
    outwardIssue: {
      key: key,
      fields: {
        summary: 'Downstream issue ' + key,
        status: {
          name: statusName,
          statusCategory: { name: statusCategoryName }
        }
      }
    }
  }
}

/**
 * Build a non-blocking link (e.g., "Relates").
 */
function makeRelatesLink(key) {
  return {
    type: { name: 'Relates', inward: 'relates to', outward: 'relates to' },
    inwardIssue: {
      key: key,
      fields: {
        summary: 'Related issue ' + key,
        status: {
          name: 'In Progress',
          statusCategory: { name: 'In Progress' }
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('blocked detection in transformIssue', function () {
  var rfeMap = {}

  it('Done category resolves block — blocking issue with statusCategory "Done" does NOT block', function () {
    var links = [makeBlocksLink('RHOAIENG-50', 'Closed', 'Done')]
    var result = transformIssue(makeRawIssue(links), rfeMap)

    expect(result.isBlocked).toBe(false)
    expect(result.blockedBy).toEqual([])
  })

  it('Non-done category causes block — statusCategory "In Progress" with status "In Progress" blocks', function () {
    var links = [makeBlocksLink('RHOAIENG-51', 'In Progress', 'In Progress')]
    var result = transformIssue(makeRawIssue(links), rfeMap)

    expect(result.isBlocked).toBe(true)
    expect(result.blockedBy).toHaveLength(1)
    expect(result.blockedBy[0]).toEqual({
      key: 'RHOAIENG-51',
      summary: 'Blocking issue RHOAIENG-51',
      status: 'In Progress'
    })
  })

  it('Status-name fallback — "Resolved" with non-Done category is treated as resolved', function () {
    var links = [makeBlocksLink('RHOAIENG-52', 'Resolved', 'In Progress')]
    var result = transformIssue(makeRawIssue(links), rfeMap)

    expect(result.isBlocked).toBe(false)
    expect(result.blockedBy).toEqual([])
  })

  it('Status-name fallback — "Closed" with non-Done category is treated as resolved', function () {
    var links = [makeBlocksLink('RHOAIENG-53', 'Closed', 'Complete')]
    var result = transformIssue(makeRawIssue(links), rfeMap)

    expect(result.isBlocked).toBe(false)
    expect(result.blockedBy).toEqual([])
  })

  it('Status-name fallback — "Release Pending" with non-Done category is treated as resolved', function () {
    var links = [makeBlocksLink('RHOAIENG-54', 'Release Pending', 'In Progress')]
    var result = transformIssue(makeRawIssue(links), rfeMap)

    expect(result.isBlocked).toBe(false)
    expect(result.blockedBy).toEqual([])
  })

  it('Multiple blockers — 1 resolved (Done) + 2 unresolved yields blockedBy with 2 entries', function () {
    var links = [
      makeBlocksLink('RHOAIENG-60', 'Closed', 'Done'),
      makeBlocksLink('RHOAIENG-61', 'In Progress', 'In Progress', 'First unresolved'),
      makeBlocksLink('RHOAIENG-62', 'Open', 'To Do', 'Second unresolved')
    ]
    var result = transformIssue(makeRawIssue(links), rfeMap)

    expect(result.isBlocked).toBe(true)
    expect(result.blockedBy).toHaveLength(2)

    var keys = result.blockedBy.map(function (b) { return b.key })
    expect(keys).toContain('RHOAIENG-61')
    expect(keys).toContain('RHOAIENG-62')

    // Verify structure of each entry
    for (var i = 0; i < result.blockedBy.length; i++) {
      expect(result.blockedBy[i]).toHaveProperty('key')
      expect(result.blockedBy[i]).toHaveProperty('summary')
      expect(result.blockedBy[i]).toHaveProperty('status')
    }
  })

  it('No issuelinks field — not blocked, blockedBy empty', function () {
    var raw = {
      key: 'RHAISTRAT-200',
      fields: {
        summary: 'Feature without links',
        status: { name: 'In Progress', statusCategory: { name: 'In Progress' } },
        issuetype: { name: 'Feature' }
        // issuelinks is undefined
      }
    }
    var result = transformIssue(raw, rfeMap)

    expect(result.isBlocked).toBe(false)
    expect(result.blockedBy).toEqual([])
  })

  it('Empty issuelinks array — not blocked, blockedBy empty', function () {
    var links = []
    var result = transformIssue(makeRawIssue(links), rfeMap)

    expect(result.isBlocked).toBe(false)
    expect(result.blockedBy).toEqual([])
  })

  it('Non-blocking link type ("Relates") is ignored — not blocked', function () {
    var links = [makeRelatesLink('RHOAIENG-70')]
    var result = transformIssue(makeRawIssue(links), rfeMap)

    expect(result.isBlocked).toBe(false)
    expect(result.blockedBy).toEqual([])
  })

  it('Outward "Blocks" link only (no inwardIssue) is ignored — not blocked', function () {
    var links = [makeOutwardBlocksLink('RHOAIENG-80', 'In Progress', 'In Progress')]
    var result = transformIssue(makeRawIssue(links), rfeMap)

    expect(result.isBlocked).toBe(false)
    expect(result.blockedBy).toEqual([])
  })
})
