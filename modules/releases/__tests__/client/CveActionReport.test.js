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
    openVulnerabilities: { count: 3, jql: 'https://jira.example/open', byCvss: [{ score: '9', count: 2, jql: 'https://jira.example/cvss' }] }
  },
  timeline: [],
  createdWeekly: [{ label: 'Sep 21', count: 2, closed: 1 }],
  openAgeBuckets: [{
    label: '0–1 weeks',
    count: 3,
    outcomes: { 'needs-action': 2, 'needs-review': 1 }
  }]
}

describe('CveActionReport', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.stubGlobal('fetch', vi.fn(url => {
      if (url === '/api/modules/releases/cve-sustaining/action-report/components') {
        return Promise.resolve({ ok: true, json: async () => ({ availableComponents: ['Alpha'] }) })
      }
      return Promise.resolve({ ok: true, json: async () => report })
    }))
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
      'Needs action', 'Not found', 'Needs review', 'Possibly resolved', 'Missing outcome'
    ])
    expect(charts[1].props('data').datasets.map(dataset => dataset.data[0])).toEqual([2, 0, 1, 0, 0])
    expect(wrapper.text()).toContain('All open vulnerabilities')
    expect(wrapper.text()).not.toContain('Conflicting outcomes')
    expect(wrapper.findAll('a').some(link => link.attributes('aria-label') === 'All open vulnerabilities, CVSS 9: 2 issues')).toBe(true)
  })

  it('keeps the report visible when a refresh returns an application error', async () => {
    vi.stubGlobal('fetch', vi.fn(url => {
      if (url === '/api/modules/releases/cve-sustaining/action-report/components') {
        return Promise.resolve({ ok: true, json: async () => ({ availableComponents: ['Alpha'], lastRefreshed: '2026-09-22T12:00:00Z' }) })
      }
      if (url === '/api/modules/releases/cve-sustaining/refresh') {
        return Promise.resolve({ ok: false, status: 500, statusText: 'Internal Server Error', json: async () => ({ error: 'Refresh failed: Jira is unavailable' }) })
      }
      return Promise.resolve({ ok: true, json: async () => report })
    }))
    const wrapper = mount(CveActionReport, {
      global: {
        provide: {
          moduleNav: { params: ref({ component: 'Alpha' }), updateParams: vi.fn() }
        }
      }
    })
    await flushPromises()
    await flushPromises()

    await wrapper.get('button').trigger('click')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toBe('Refresh failed: Jira is unavailable')
    expect(wrapper.text()).toContain('All open vulnerabilities')
    expect(wrapper.findAll('.bar-chart')).toHaveLength(2)
  })
})
