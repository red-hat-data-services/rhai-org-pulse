import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AutofixContent from '../../client/components/AutofixContent.vue'

const MOCK_DATA = {
  fetchedAt: '2026-04-18T12:00:00Z',
  jiraHost: 'https://redhat.atlassian.net',
  metrics: {
    triageTotal: 10,
    triageVerdicts: { ready: 6, missingInfo: 2, notFixable: 1, stale: 1, pending: 0 },
    autofixStates: { ready: 1, pending: 1, review: 1, ciFailing: 0, merged: 2, rejected: 0, maxRetries: 0, researched: 0, blocked: 1 },
    autofixTotal: 6,
    successRate: 100,
    windowTotal: 10,
    totalIssues: 10
  },
  trendData: [
    { date: '2026-04-11', triaged: 3, autofixed: 2, merged: 1, total: 3 },
    { date: '2026-04-18', triaged: 7, autofixed: 4, merged: 1, total: 7 }
  ],
  componentBreakdown: [
    { component: 'Model Server', triaged: 5, autofixed: 3, done: 1 },
    { component: 'Notebooks', triaged: 3, autofixed: 1, done: 0 }
  ],
  issues: [
    {
      key: 'AIPCC-100',
      summary: 'Fix null pointer',
      status: 'In Progress',
      priority: 'Major',
      created: '2026-04-16T10:00:00Z',
      updated: '2026-04-17T10:00:00Z',
      labels: ['jira-autofix-review'],
      components: ['Model Server'],
      assignee: 'Jane Doe',
      pipelineState: 'autofix-review'
    },
    {
      key: 'RHOAIENG-200',
      summary: 'Handle timeout',
      status: 'New',
      priority: 'Normal',
      created: '2026-04-15T10:00:00Z',
      updated: '2026-04-15T10:00:00Z',
      labels: ['jira-triage-not-fixable'],
      components: ['Notebooks'],
      assignee: null,
      pipelineState: 'triage-not-fixable'
    }
  ]
}

describe('AutofixContent', () => {
  it('renders summary stat cards with metric values', () => {
    const wrapper = mount(AutofixContent, {
      props: { autofixData: MOCK_DATA, loading: false, timeWindow: 'month' }
    })
    expect(wrapper.text()).toContain('10')
    expect(wrapper.text()).toContain('100%')
  })

  it('renders triage outcomes panel', () => {
    const wrapper = mount(AutofixContent, {
      props: { autofixData: MOCK_DATA, loading: false, timeWindow: 'month' }
    })
    expect(wrapper.text()).toContain('Triage Outcomes')
    expect(wrapper.text()).toContain('Ready for AI')
    expect(wrapper.text()).toContain('Missing Info')
    expect(wrapper.text()).toContain('Not AI-Fixable')
  })

  it('renders autofix progress panel', () => {
    const wrapper = mount(AutofixContent, {
      props: { autofixData: MOCK_DATA, loading: false, timeWindow: 'month' }
    })
    expect(wrapper.text()).toContain('Autofix Progress')
    expect(wrapper.text()).toContain('AI Fix Merged')
    expect(wrapper.text()).toContain('AI Fix Under Review')
  })

  it('renders issue table with Jira links', () => {
    const wrapper = mount(AutofixContent, {
      props: { autofixData: MOCK_DATA, loading: false, timeWindow: 'month' }
    })
    expect(wrapper.text()).toContain('AIPCC-100')
    expect(wrapper.text()).toContain('Fix null pointer')
    const link = wrapper.find('a[href*="AIPCC-100"]')
    expect(link.exists()).toBe(true)
    expect(link.attributes('href')).toBe('https://redhat.atlassian.net/browse/AIPCC-100')
  })

  it('shows empty state when no data', () => {
    const wrapper = mount(AutofixContent, {
      props: { autofixData: null, loading: false, timeWindow: 'month' }
    })
    expect(wrapper.text()).toContain('No autofix data yet')
  })

  it('shows error state', () => {
    const wrapper = mount(AutofixContent, {
      props: { autofixData: null, loading: false, error: 'Connection failed', timeWindow: 'month' }
    })
    expect(wrapper.text()).toContain('Failed to load data')
    expect(wrapper.text()).toContain('Connection failed')
  })

  function findIssueTableRows(wrapper) {
    const tables = wrapper.findAll('table')
    const issueTable = tables.find(t => {
      const th = t.findAll('th')
      return th.length > 0 && th[0].text() === 'Key'
    })
    return issueTable ? issueTable.findAll('tbody tr') : []
  }

  it('filters issues by search query', async () => {
    const wrapper = mount(AutofixContent, {
      props: { autofixData: MOCK_DATA, loading: false, timeWindow: 'month' }
    })
    const input = wrapper.find('input[placeholder="Search issues..."]')
    await input.setValue('null pointer')
    const rows = findIssueTableRows(wrapper)
    expect(rows).toHaveLength(1)
    expect(rows[0].text()).toContain('AIPCC-100')
  })

  it('filters issues by state', async () => {
    const wrapper = mount(AutofixContent, {
      props: { autofixData: MOCK_DATA, loading: false, timeWindow: 'month' }
    })
    const select = wrapper.findAll('select').find(s => {
      return s.findAll('option').some(o => o.attributes('value') === 'all' && o.text() === 'All')
    })
    await select.setValue('triage-not-fixable')
    const rows = findIssueTableRows(wrapper)
    expect(rows).toHaveLength(1)
    expect(rows[0].text()).toContain('RHOAIENG-200')
  })
})
