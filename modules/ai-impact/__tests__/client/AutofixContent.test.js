import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AutofixContent from '../../client/components/AutofixContent.vue'

// Use relative dates so time-window filtering never ages out of the 30-day window
const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString()

const MOCK_DATA = {
  fetchedAt: daysAgo(0),
  jiraHost: 'https://redhat.atlassian.net',
  metrics: {
    triageTotal: 10,
    triageVerdicts: { ready: 6, missingInfo: 2, notFixable: 1, stale: 1, pending: 0, external: 0, securityReview: 0 },
    autofixStates: { ready: 1, pending: 1, review: 1, ciFailing: 0, merged: 2, rejected: 0, maxRetries: 0, researched: 0, blocked: 1 },
    autofixTotal: 6,
    successRate: 100,
    windowTotal: 10,
    totalIssues: 10,
    priorityBreakdown: { Major: 1, Normal: 1, Blocker: 1 },
    medianTimeToFixDays: 2.5,
    effortBreakdown: { quickWin: 1, standardFix: 1, complexFix: 0 },
    totalImpactScore: 4
  },
  trendData: [
    { date: daysAgo(7).slice(0, 10), triaged: 3, autofixed: 2, merged: 1, total: 3, review: 1, ciFailing: 0, blocked: 0, maxRetries: 0, missingInfo: 1, stale: 0, external: 0, securityReview: 0 },
    { date: daysAgo(0).slice(0, 10), triaged: 7, autofixed: 4, merged: 1, total: 7, review: 1, ciFailing: 1, blocked: 0, maxRetries: 0, missingInfo: 1, stale: 1, external: 0, securityReview: 0 }
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
      created: daysAgo(2),
      updated: daysAgo(1),
      terminalAt: daysAgo(0),
      labels: ['jira-autofix-merged'],
      components: ['Model Server'],
      assignee: 'Jane Doe',
      pipelineState: 'autofix-merged',
      effortScore: 1,
      effortTier: 'Quick Win'
    },
    {
      key: 'AIPCC-101',
      summary: 'Fix auth bypass',
      status: 'Closed',
      priority: 'Blocker',
      created: daysAgo(5),
      updated: daysAgo(1),
      terminalAt: daysAgo(1),
      labels: ['jira-autofix-merged'],
      components: ['Model Server'],
      assignee: 'John Smith',
      pipelineState: 'autofix-merged',
      effortScore: 3,
      effortTier: 'Standard Fix'
    },
    {
      key: 'RHOAIENG-200',
      summary: 'Handle timeout',
      status: 'New',
      priority: 'Normal',
      created: daysAgo(3),
      updated: daysAgo(3),
      terminalAt: null,
      labels: ['jira-triage-not-fixable'],
      components: ['Notebooks'],
      assignee: null,
      pipelineState: 'triage-not-fixable',
      effortScore: null,
      effortTier: null
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

  it('renders new triage states in state filter dropdown', async () => {
    const wrapper = mount(AutofixContent, {
      props: { autofixData: MOCK_DATA, loading: false, timeWindow: 'month' }
    })
    const stateBtn = wrapper.findAll('button').find(b => b.text().includes('All States'))
    await stateBtn.trigger('click')
    const labels = wrapper.findAll('label')
    const labelTexts = labels.map(l => l.text())
    expect(labelTexts).toContain('External Reporter')
    expect(labelTexts).toContain('Security Review')
  })

  it('renders priority distribution section', () => {
    const wrapper = mount(AutofixContent, {
      props: { autofixData: MOCK_DATA, loading: false, timeWindow: 'month' }
    })
    expect(wrapper.text()).toContain('Priority Distribution')
    expect(wrapper.text()).toContain('Major')
    expect(wrapper.text()).toContain('Blocker')
  })

  it('renders effort breakdown section', () => {
    const wrapper = mount(AutofixContent, {
      props: { autofixData: MOCK_DATA, loading: false, timeWindow: 'month' }
    })
    expect(wrapper.text()).toContain('Effort Breakdown')
    expect(wrapper.text()).toContain('Quick Win')
    expect(wrapper.text()).toContain('Standard Fix')
  })

  it('renders median time to fix', () => {
    const wrapper = mount(AutofixContent, {
      props: { autofixData: MOCK_DATA, loading: false, timeWindow: 'month' }
    })
    expect(wrapper.text()).toContain('Time to Fix')
    expect(wrapper.text()).toContain('2.5 days')
    expect(wrapper.text()).toContain('Median Time to Fix')
  })

  it('renders effort tier badge in issue table', () => {
    const wrapper = mount(AutofixContent, {
      props: { autofixData: MOCK_DATA, loading: false, timeWindow: 'month' }
    })
    expect(wrapper.text()).toContain('Quick Win')
    expect(wrapper.text()).toContain('Standard Fix')
  })

  it('filters issues by state', async () => {
    const wrapper = mount(AutofixContent, {
      props: { autofixData: MOCK_DATA, loading: false, timeWindow: 'month' }
    })
    const stateBtn = wrapper.findAll('button').find(b => b.text().includes('All States'))
    await stateBtn.trigger('click')
    const notFixableLabel = wrapper.findAll('label').find(l => l.text().includes('Not AI-Fixable'))
    const checkbox = notFixableLabel.find('input[type="checkbox"]')
    await checkbox.setValue(true)
    const rows = findIssueTableRows(wrapper)
    expect(rows).toHaveLength(1)
    expect(rows[0].text()).toContain('RHOAIENG-200')
  })
})
