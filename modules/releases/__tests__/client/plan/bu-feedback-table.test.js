import { describe, it, expect } from 'vitest'
import {
  PAGE_SIZE,
  emptyFilters,
  hasActiveFilters,
  collectFilterOptions,
  issueMatchesSearch,
  filterIssues,
  sortIssues,
  paginate,
  sourceShortLabel,
  toggleFilterValue,
  typeBadgeClass,
  statusClasses,
  priorityDot,
  formatDate,
  visibleChips
} from '../../../client/plan/utils/bu-feedback-table.js'

function issue(overrides) {
  return Object.assign({
    key: 'RHOAIENG-1',
    summary: 'Dashboard filter is broken',
    issueType: 'Bug',
    assignee: 'Jane Smith',
    reporter: 'Alex Lee',
    priority: 'Major',
    status: 'New',
    statusCategory: 'To Do',
    resolution: 'Unresolved',
    created: '2026-08-19T12:00:00.000Z',
    updated: '2026-08-19T13:00:00.000Z',
    dueDate: null,
    components: ['AI Core Dashboard'],
    fixVersions: [],
    feedbackLabels: ['AIBU_Feedback']
  }, overrides)
}

describe('bu-feedback-table helpers', function() {
  describe('hasActiveFilters', function() {
    it('is false for empty filters', function() {
      expect(hasActiveFilters(emptyFilters())).toBe(false)
    })

    it('is true when search or a select is set', function() {
      expect(hasActiveFilters(Object.assign(emptyFilters(), { search: 'dash' }))).toBe(true)
      expect(hasActiveFilters(Object.assign(emptyFilters(), { status: ['New'] }))).toBe(true)
    })
  })

  describe('collectFilterOptions', function() {
    it('collects unique sorted values including multi-component issues', function() {
      var opts = collectFilterOptions([
        issue({ issueType: 'Bug', components: ['Docs', 'AI Core Dashboard'], feedbackLabels: ['AIBU_Feedback'] }),
        issue({ key: '2', issueType: 'Feature Request', components: ['Docs'], feedbackLabels: ['AISSA_Feedback'] })
      ])
      expect(opts.issueType).toEqual(['Bug', 'Feature Request'])
      expect(opts.component).toEqual(['AI Core Dashboard', 'Docs'])
      expect(opts.source).toEqual(['AIBU_Feedback', 'AISSA_Feedback'])
    })
  })

  describe('issueMatchesSearch', function() {
    it('matches key, summary, people, and components', function() {
      var row = issue()
      expect(issueMatchesSearch(row, 'RHOAIENG-1')).toBe(true)
      expect(issueMatchesSearch(row, 'filter')).toBe(true)
      expect(issueMatchesSearch(row, 'jane')).toBe(true)
      expect(issueMatchesSearch(row, 'core')).toBe(true)
      expect(issueMatchesSearch(row, 'unrelated')).toBe(false)
    })

    it('matches empty search', function() {
      expect(issueMatchesSearch(issue(), '  ')).toBe(true)
    })
  })

  describe('filterIssues', function() {
    var rows = [
      issue({ key: 'A', issueType: 'Bug', status: 'New', priority: 'Major', components: ['Docs'], feedbackLabels: ['AIBU_Feedback'] }),
      issue({ key: 'B', issueType: 'Feature Request', status: 'Done', priority: 'Normal', components: ['Serving'], feedbackLabels: ['AISSA_Feedback'] })
    ]

    it('filters by type, status, priority, component, and source', function() {
      expect(filterIssues(rows, Object.assign(emptyFilters(), { issueType: ['Bug'] })).map(function(i) { return i.key })).toEqual(['A'])
      expect(filterIssues(rows, Object.assign(emptyFilters(), { status: ['Done'] })).map(function(i) { return i.key })).toEqual(['B'])
      expect(filterIssues(rows, Object.assign(emptyFilters(), { component: ['Serving'] })).map(function(i) { return i.key })).toEqual(['B'])
      expect(filterIssues(rows, Object.assign(emptyFilters(), { source: ['AIBU_Feedback'] })).map(function(i) { return i.key })).toEqual(['A'])
    })

    it('multi-selects multiple values in a single filter', function() {
      expect(filterIssues(rows, Object.assign(emptyFilters(), { issueType: ['Bug', 'Feature Request'] })).map(function(i) { return i.key })).toEqual(['A', 'B'])
      expect(filterIssues(rows, Object.assign(emptyFilters(), { status: ['New', 'Done'] })).map(function(i) { return i.key })).toEqual(['A', 'B'])
    })

    it('combines search with selects', function() {
      var result = filterIssues(rows, Object.assign(emptyFilters(), { search: 'feature', issueType: ['Bug'] }))
      expect(result).toEqual([])
    })
  })

  describe('sortIssues', function() {
    it('sorts by created descending by default direction', function() {
      var rows = [
        issue({ key: 'OLD', created: '2026-01-01T00:00:00.000Z' }),
        issue({ key: 'NEW', created: '2026-08-01T00:00:00.000Z' })
      ]
      expect(sortIssues(rows, 'created', 'desc').map(function(i) { return i.key })).toEqual(['NEW', 'OLD'])
      expect(sortIssues(rows, 'created', 'asc').map(function(i) { return i.key })).toEqual(['OLD', 'NEW'])
    })

    it('sorts components as a joined string', function() {
      var rows = [
        issue({ key: 'Z', components: ['Zeta'] }),
        issue({ key: 'A', components: ['Alpha'] })
      ]
      expect(sortIssues(rows, 'component', 'asc').map(function(i) { return i.key })).toEqual(['A', 'Z'])
    })
  })

  describe('paginate', function() {
    it('returns the requested page and range labels', function() {
      var items = []
      for (var i = 0; i < 30; i++) items.push(issue({ key: 'K-' + i }))
      var first = paginate(items, 1, PAGE_SIZE)
      expect(first.items.length).toBe(25)
      expect(first.start).toBe(1)
      expect(first.end).toBe(25)
      expect(first.pageCount).toBe(2)
      var second = paginate(items, 2, PAGE_SIZE)
      expect(second.items.length).toBe(5)
      expect(second.start).toBe(26)
      expect(second.end).toBe(30)
    })

    it('clamps out-of-range pages', function() {
      var page = paginate([issue()], 99, PAGE_SIZE)
      expect(page.page).toBe(1)
      expect(page.items.length).toBe(1)
    })
  })

  describe('toggleFilterValue', function() {
    it('adds a value when not present', function() {
      var arr = []
      toggleFilterValue(arr, 'Bug')
      expect(arr).toEqual(['Bug'])
    })

    it('removes a value when already present', function() {
      var arr = ['Bug', 'Story']
      toggleFilterValue(arr, 'Bug')
      expect(arr).toEqual(['Story'])
    })
  })

  describe('display helpers', function() {
    it('shortens feedback source labels', function() {
      expect(sourceShortLabel('AIBU_Feedback')).toBe('BU')
      expect(sourceShortLabel('AISSA_Feedback')).toBe('SSA')
    })

    it('returns type and status badge classes', function() {
      expect(typeBadgeClass('Bug')).toContain('bg-red-100')
      expect(typeBadgeClass('Feature Request')).toContain('bg-blue-100')
      expect(statusClasses('Done')).toContain('bg-green-100')
      expect(statusClasses('In Progress')).toContain('bg-blue-100')
    })

    it('maps priority to a dot color', function() {
      expect(priorityDot('Critical')).toBe('bg-red-500')
      expect(priorityDot('Major')).toBe('bg-orange-400')
    })

    it('formats dates and overflow chips', function() {
      expect(formatDate('2026-08-19T12:00:00.000Z')).toMatch(/Aug 19, 2026/)
      var chips = visibleChips(['A', 'B', 'C'], 2)
      expect(chips.shown).toEqual(['A', 'B'])
      expect(chips.overflow).toBe(1)
      expect(chips.overflowTitle).toBe('C')
    })
  })
})
