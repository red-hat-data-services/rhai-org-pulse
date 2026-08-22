import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import BuFeedbackExecutiveSummary from '../../../client/plan/components/BuFeedbackExecutiveSummary.vue'

function issue(overrides) {
  return Object.assign({
    key: 'RHOAIENG-1',
    summary: 'Test',
    issueType: 'Bug',
    assignee: 'Jane',
    reporter: 'Alex',
    priority: 'Major',
    status: 'New',
    statusCategory: 'To Do',
    resolution: 'Unresolved',
    created: '2026-06-01T12:00:00.000Z',
    updated: '2026-08-01T12:00:00.000Z',
    dueDate: null,
    resolved: null,
    inProgressAt: null,
    components: ['Dashboard'],
    fixVersions: [],
    feedbackLabels: ['AIBU_Feedback']
  }, overrides)
}

function mountSummary(issues) {
  return mount(BuFeedbackExecutiveSummary, { props: { issues: issues } })
}

describe('BuFeedbackExecutiveSummary', function() {
  beforeEach(function() {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-19T12:00:00.000Z'))
  })

  afterEach(function() {
    vi.useRealTimers()
  })

  it('does not render when issues array is empty', function() {
    var wrapper = mountSummary([])
    expect(wrapper.find('[data-testid="bu-feedback-exec-summary"]').exists()).toBe(false)
  })

  it('renders the heading and subtitle', function() {
    var wrapper = mountSummary([issue()])
    expect(wrapper.text()).toContain('Executive Summary')
    expect(wrapper.text()).toContain('Process-efficiency metrics')
  })

  it('renders the metrics table', function() {
    var wrapper = mountSummary([
      issue({
        key: 'A',
        statusCategory: 'Done',
        resolved: '2026-06-11T12:00:00.000Z',
        inProgressAt: '2026-06-05T12:00:00.000Z',
        created: '2026-06-01T12:00:00.000Z'
      }),
      issue({ key: 'B', created: '2026-08-09T12:00:00.000Z' })
    ])
    expect(wrapper.find('[data-testid="bu-feedback-metrics-table"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Avg Lead Time')
    expect(wrapper.text()).toContain('Resolution Rate')
    expect(wrapper.text()).toContain('Throughput')
  })

  it('renders the bottleneck table when components exist', function() {
    var wrapper = mountSummary([
      issue({ key: 'A', components: ['Serving'] }),
      issue({ key: 'B', components: ['Serving'] }),
      issue({ key: 'C', components: ['Dashboard'] })
    ])
    expect(wrapper.find('[data-testid="bu-feedback-bottleneck-table"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Serving')
  })

  it('renders bullet points with the three required metrics', function() {
    var wrapper = mountSummary([
      issue({
        key: 'CLOSED',
        statusCategory: 'Done',
        resolved: '2026-06-11T12:00:00.000Z',
        inProgressAt: '2026-06-05T12:00:00.000Z',
        created: '2026-06-01T12:00:00.000Z'
      }),
      issue({ key: 'OPEN', created: '2026-08-09T12:00:00.000Z' })
    ])
    expect(wrapper.text()).toContain('Avg Lead Time:')
    expect(wrapper.text()).toContain('Avg Cycle Time:')
    expect(wrapper.text()).toContain('Avg Open Issue Age:')
  })
})
