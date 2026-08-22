import { describe, it, expect } from 'vitest'

var { extractFirstInProgressAt } = require('../../../server/planning/bu-feedback-issue')

describe('extractFirstInProgressAt', function() {
  it('returns null for null changelog', function() {
    expect(extractFirstInProgressAt(null)).toBeNull()
  })

  it('returns null for empty histories', function() {
    expect(extractFirstInProgressAt({ histories: [] })).toBeNull()
  })

  it('returns null when no in-progress transition exists', function() {
    var changelog = {
      histories: [
        {
          created: '2026-06-01T12:00:00.000Z',
          items: [{ field: 'status', toString: 'New' }]
        },
        {
          created: '2026-06-02T12:00:00.000Z',
          items: [{ field: 'status', toString: 'Closed' }]
        }
      ]
    }
    expect(extractFirstInProgressAt(changelog)).toBeNull()
  })

  it('returns the first In Progress transition timestamp', function() {
    var changelog = {
      histories: [
        {
          created: '2026-06-01T12:00:00.000Z',
          items: [{ field: 'status', toString: 'New' }]
        },
        {
          created: '2026-06-05T12:00:00.000Z',
          items: [{ field: 'status', toString: 'In Progress' }]
        },
        {
          created: '2026-06-10T12:00:00.000Z',
          items: [{ field: 'status', toString: 'In Review' }]
        }
      ]
    }
    expect(extractFirstInProgressAt(changelog)).toBe('2026-06-05T12:00:00.000Z')
  })

  it('handles unsorted histories and picks the earliest', function() {
    var changelog = {
      histories: [
        {
          created: '2026-06-10T12:00:00.000Z',
          items: [{ field: 'status', toString: 'In Review' }]
        },
        {
          created: '2026-06-03T12:00:00.000Z',
          items: [{ field: 'status', toString: 'In Progress' }]
        }
      ]
    }
    expect(extractFirstInProgressAt(changelog)).toBe('2026-06-03T12:00:00.000Z')
  })

  it('is case-insensitive on status names', function() {
    var changelog = {
      histories: [
        {
          created: '2026-06-01T12:00:00.000Z',
          items: [{ field: 'status', toString: 'IN PROGRESS' }]
        }
      ]
    }
    expect(extractFirstInProgressAt(changelog)).toBe('2026-06-01T12:00:00.000Z')
  })

  it('recognises QA, Testing, Development, Coding statuses', function() {
    var names = ['QA', 'Testing', 'Development', 'Coding']
    for (var i = 0; i < names.length; i++) {
      var changelog = {
        histories: [
          {
            created: '2026-06-01T12:00:00.000Z',
            items: [{ field: 'status', toString: names[i] }]
          }
        ]
      }
      expect(extractFirstInProgressAt(changelog)).toBe('2026-06-01T12:00:00.000Z')
    }
  })

  it('ignores non-status field changes', function() {
    var changelog = {
      histories: [
        {
          created: '2026-06-01T12:00:00.000Z',
          items: [{ field: 'assignee', toString: 'In Progress' }]
        }
      ]
    }
    expect(extractFirstInProgressAt(changelog)).toBeNull()
  })
})
