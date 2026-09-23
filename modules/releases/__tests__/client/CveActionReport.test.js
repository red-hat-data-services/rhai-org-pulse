import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('vue-chartjs', () => ({
  Bar: {
    name: 'MockBar',
    props: ['data', 'options'],
    template: '<div class="bar-chart" />'
  }
}))

import CveActionReport from '../../client/reports/CveActionReport.vue'

const report = {
  component: 'Alpha',
  asOfDate: '2026-09-22',
  windowEndDate: '2026-12-21',
  summary: {
    openVulnerabilities: { count: 3, jql: 'https://jira.example/open', byCvss: [{ score: '9', count: 2, jql: 'https://jira.example/cvss' }] },
    slaBreached: { count: 1, jql: 'https://jira.example/sla-breached' },
    noSlaDate: { count: 1, jql: 'https://jira.example/no-sla-date' }
  },
  timeline: [
    { dueDate: '2026-09-20', isPastDue: true, total: 1, total_jql: 'https://jira.example/past-due', outcomes: {} },
    { dueDate: '2026-09-29', isPastDue: false, upcomingDueDate: true, total: 1, total_jql: 'https://jira.example/upcoming', outcomes: {} },
    { dueDate: '2026-10-15', isPastDue: false, upcomingDueDate: false, total: 1, total_jql: 'https://jira.example/due', outcomes: {} }
  ],
  createdWeekly: [{ label: 'Sep 21', count: 2, closed: 1 }],
  openAgeBuckets: [{
    label: '0–1 weeks',
    count: 3,
    outcomes: { 'needs-action': 2, 'needs-review': 1 }
  }]
}

function mockReport(payload = report) {
  vi.stubGlobal('fetch', vi.fn(url => {
    if (url === '/api/modules/releases/cve-sustaining/action-report/components') {
      return Promise.resolve({ ok: true, json: async () => ({ availableComponents: ['Alpha'] }) })
    }
    return Promise.resolve({ ok: true, json: async () => payload })
  }))
}

function summaryCard(wrapper, label) {
  return wrapper.findAll('section').find(section => section.classes().includes('p-4') && section.text().includes(label))
}

describe('CveActionReport', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    mockReport()
  })

  it('renders charts when the action-report API provides weekly and age buckets', async () => {
    const wrapper = mount(CveActionReport, {
      global: {
        provide: {
          moduleNav: { params: ref({ component: 'Alpha' }), updateParams: vi.fn() }
        }
      }
    })
    await flushPromises()
    await flushPromises()

    expect(wrapper.text()).not.toContain('No data available for this period.')
    expect(wrapper.findAll('.bar-chart')).toHaveLength(2)
    const charts = wrapper.findAllComponents({ name: 'MockBar' })
    expect(charts[1].props('options').scales.x.stacked).toBe(true)
    expect(charts[1].props('options').scales.y.stacked).toBe(true)
    expect(charts[1].props('data').datasets.map(dataset => dataset.label)).toEqual([
      'Needs action', 'Not found', 'Needs review', 'Possibly resolved'
    ])
    expect(charts[1].props('data').datasets.map(dataset => dataset.data[0])).toEqual([2, 0, 1, 0])
    expect(wrapper.text()).toContain('All open vulnerabilities')
    expect(wrapper.text()).toContain('SLA breached')
    expect(wrapper.text()).toContain('No SLA date')
    expect(summaryCard(wrapper, 'All open vulnerabilities').classes()).toContain('bg-white')
    expect(summaryCard(wrapper, 'No SLA date').classes()).toContain('bg-white')
    expect(summaryCard(wrapper, 'SLA breached').classes()).toContain('bg-red-50')
    expect(wrapper.text()).not.toContain('Missing review outcome')
    expect(wrapper.text()).toContain('Upcoming due dates until 2026-12-21')
    const dueDateLegend = wrapper.find('[aria-label="Due date color legend"]')
    expect(dueDateLegend.exists()).toBe(true)
    expect(dueDateLegend.text()).toContain('Past due')
    expect(dueDateLegend.text()).toContain('Due within 7 days')
    expect(dueDateLegend.find('.bg-red-50').exists()).toBe(true)
    expect(dueDateLegend.find('.bg-amber-50').exists()).toBe(true)
    expect(wrapper.text()).toContain('2026-10-15')
    const pastDueRow = wrapper.findAll('tbody tr').find(row => row.text().includes('2026-09-20'))
    const upcomingRow = wrapper.findAll('tbody tr').find(row => row.text().includes('2026-09-29'))
    const futureRow = wrapper.findAll('tbody tr').find(row => row.text().includes('2026-10-15'))
    expect(pastDueRow.text()).not.toContain('Past due')
    expect(pastDueRow.classes()).toContain('bg-red-50')
    expect(pastDueRow.classes()).not.toContain('bg-amber-50')
    expect(upcomingRow.classes()).toContain('bg-amber-50')
    expect(upcomingRow.classes()).not.toContain('bg-red-50')
    expect(futureRow.classes()).not.toContain('bg-amber-50')
    expect(futureRow.classes()).not.toContain('bg-red-50')
    expect(wrapper.text()).not.toContain('Conflicting outcomes')
    expect(wrapper.findAll('a').some(link => link.attributes('aria-label') === 'All open vulnerabilities, CVSS 9: 2 issues')).toBe(true)
  })

  it('keeps the SLA breached summary neutral when its count is zero', async () => {
    mockReport({
      ...report,
      summary: {
        ...report.summary,
        slaBreached: { count: 0, jql: 'https://jira.example/sla-breached', byCvss: [] }
      }
    })
    const wrapper = mount(CveActionReport, {
      global: {
        provide: {
          moduleNav: { params: ref({ component: 'Alpha' }), updateParams: vi.fn() }
        }
      }
    })
    await flushPromises()
    await flushPromises()

    const slaCard = summaryCard(wrapper, 'SLA breached')
    expect(slaCard.classes()).toContain('bg-white')
    expect(slaCard.classes()).not.toContain('bg-red-50')
  })
})
