import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

vi.mock('@shared/client/services/api', function () {
  return { apiRequest: vi.fn() }
})

import { apiRequest } from '@shared/client/services/api'
import TechDebtPrioritizationView from '../../../client/plan/views/TechDebtPrioritizationView.vue'
import {
  clearTechDebtIssueCache,
  TECH_DEBT_CACHE_TTL_MS,
  techDebtIssueCacheKey,
  writeTechDebtIssueCache
} from '../../../client/plan/services/techDebtIssueCache'

const componentsResponse = {
  project: 'RHAI',
  components: [
    { id: '1', name: 'AI Gateway' },
    { id: '2', name: 'Model Serving' }
  ]
}

function issue(key, overrides = {}) {
  return {
    key,
    link: 'https://jira.example.test/browse/' + key,
    summary: 'Summary for ' + key,
    issueType: 'Bug',
    jiraPriority: 'Medium',
    priorityScore: null,
    scoreStatus: 'pending',
    status: 'Open',
    statusCategory: 'To Do',
    components: ['AI Gateway'],
    assignee: { id: 'person-1', name: 'Pat Engineer' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-02-01T00:00:00.000Z',
    dueDate: '2026-11-01',
    fixVersions: ['3.0 GA'],
    ...overrides
  }
}

function scoredVulnerability(key, overrides = {}) {
  return issue(key, {
    issueType: 'Vulnerability',
    jiraPriority: 'Critical',
    rawScore: 95,
    priorityScore: 95,
    scoreStatus: 'scored',
    priorityBand: {
      level: 'P0',
      label: 'Immediate',
      expectedAction: 'Begin within 1–2 business days'
    },
    scoreBreakdown: {
      sla: { points: 35, state: 'Breached' },
      cvss: { points: 30, state: 'Critical (9.0–10.0)' },
      dueDate: { points: 15, state: 'Past due' },
      reviewOutcome: { points: 10, state: 'Needs action' },
      age: { points: 5, state: '13+ weeks' },
      uncertainty: { points: 0, state: 'Complete tracking data', reasons: [] }
    },
    guardrail: { applied: false, minimumScore: null, reasons: [] },
    triageFlags: [{ code: 'sla-breached', label: 'SLA breached' }],
    rankGroup: 'combined',
    ...overrides
  })
}

function scoredBug(key, overrides = {}) {
  return issue(key, {
    jiraPriority: 'High',
    rawScore: 60,
    priorityScore: 70,
    scoreStatus: 'scored',
    scoreModel: 'bug-v1',
    priorityBand: {
      level: 'P1',
      label: 'Urgent',
      expectedAction: 'Begin within 2–4 business days'
    },
    primaryBugType: { code: 'approved-release-blocker', label: 'Approved Release Blocker' },
    classificationSignals: [
      { code: 'approved-release-blocker', label: 'Approved Release Blocker', evidence: 'Release Blocker is Approved' },
      { code: 'ci-detected', label: 'CI/nightly detected', evidence: 'CI, Cypress, or nightly label' }
    ],
    scoreBreakdown: {
      customerImpact: { points: 0, state: 'No customer or field signal' },
      deliverySecurity: { points: 22, state: 'Approved Release Blocker' },
      detectionSource: { points: 2, state: 'CI, nightly, gate, or human test' },
      jiraSeverity: { points: 16, state: 'High' },
      dueDate: { points: 15, state: 'Past due' },
      age: { points: 5, state: '13+ weeks' }
    },
    guardrail: {
      applied: true,
      minimumScore: 70,
      reasons: ['Approved Release Blocker guarantees at least P1']
    },
    ...overrides
  })
}

function cockpitResponse(overrides = {}) {
  return {
    selectedComponents: ['AI Gateway'],
    fetchedAt: '2026-10-26T14:30:00.000Z',
    cacheStatus: 'refreshed',
    warning: null,
    counts: { total: 2, inFlight: 1, backlog: 1, bugs: 1, vulnerabilities: 1 },
    inFlight: [scoredBug('RHAI-10', { status: 'In Progress', jiraPriority: 'High' })],
    backlog: [scoredVulnerability('RHAI-20', { rank: 1 })],
    ...overrides
  }
}

function mockSuccessfulApi(response = cockpitResponse()) {
  apiRequest.mockImplementation(function (path) {
    if (path === '/modules/releases/tech-debt/components') return Promise.resolve(componentsResponse)
    return Promise.resolve(response)
  })
}

async function selectComponent(wrapper, name = 'AI Gateway') {
  await wrapper.get('[data-testid="tech-debt-component-filter"]').trigger('click')
  await wrapper.get(`input[aria-label="${name}"]`).setValue(true)
  await flushPromises()
}

describe('TechDebtPrioritizationView', function () {
  beforeEach(function () {
    vi.clearAllMocks()
    clearTechDebtIssueCache()
  })

  it('requires a component before requesting issues', async function () {
    mockSuccessfulApi()
    const wrapper = mount(TechDebtPrioritizationView)
    await flushPromises()

    expect(apiRequest).toHaveBeenCalledTimes(1)
    expect(apiRequest).toHaveBeenCalledWith('/modules/releases/tech-debt/components')
    expect(wrapper.get('[data-testid="tech-debt-user-testing-warning"]').text()).toContain('This report is currently under user testing')
    expect(wrapper.get('[data-testid="tech-debt-user-testing-warning"]').text()).toContain('proceed with caution')
    expect(wrapper.get('[data-testid="tech-debt-importance"]').text()).toContain('Why this report matters')
    expect(wrapper.get('[data-testid="tech-debt-importance"]').text()).toContain('CVE remediation as part of every feature')
    expect(wrapper.find('[data-testid="tech-debt-component-required"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="tech-debt-cockpit"]').exists()).toBe(false)
  })

  it('loads RHAI components into the multi-select filter', async function () {
    mockSuccessfulApi()
    const wrapper = mount(TechDebtPrioritizationView)
    await flushPromises()

    await wrapper.get('[data-testid="tech-debt-component-filter"]').trigger('click')
    expect(wrapper.text()).toContain('AI Gateway')
    expect(wrapper.text()).toContain('Model Serving')
  })

  it('opens the vulnerability scoring rubric and explains the complete score', async function () {
    mockSuccessfulApi()
    const wrapper = mount(TechDebtPrioritizationView, { attachTo: document.body })
    await flushPromises()

    await wrapper.get('[data-testid="vulnerability-rubric-open"]').trigger('click')
    const rubric = wrapper.get('[data-testid="vulnerability-scoring-rubric"]')
    expect(rubric.text()).toContain('Priority score = SLA + CVSS + due date + review outcome + age + uncertainty')
    expect(rubric.text()).toContain('Missing or invalid values receive zero category points')
    expect(rubric.text()).toContain('P0 — Immediate')
    await wrapper.get('[data-testid="bug-rubric-tab"]').trigger('click')
    expect(wrapper.get('[data-testid="bug-rubric-content"]').text()).toContain('Bug score = customer + delivery/security + detection + Jira severity + due date + age')
    expect(wrapper.get('[data-testid="bug-rubric-content"]').text()).toContain('Affecting customer (SFDC)')
    expect(wrapper.get('[data-testid="bug-source-rules"]').text()).toContain('prerelease-cve-remediation label plus DevTestOps Jira Bot reporter')
    expect(wrapper.get('[data-testid="bug-rubric-content"]').text()).toContain('Active prioritization')

    await wrapper.get('[data-testid="vulnerability-rubric-close"]').trigger('click')
    expect(wrapper.find('[data-testid="vulnerability-scoring-rubric"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('closes the component menu when clicking outside it', async function () {
    mockSuccessfulApi()
    const wrapper = mount(TechDebtPrioritizationView)
    await flushPromises()

    await wrapper.get('[data-testid="tech-debt-component-filter"]').trigger('click')
    expect(wrapper.find('[role="listbox"]').exists()).toBe(true)

    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[role="listbox"]').exists()).toBe(false)
  })

  it('requests union-selected components and renders both cockpit panes', async function () {
    mockSuccessfulApi()
    const wrapper = mount(TechDebtPrioritizationView)
    await flushPromises()
    await selectComponent(wrapper)
    await wrapper.get('input[aria-label="Model Serving"]').setValue(true)
    await flushPromises()

    expect(apiRequest).toHaveBeenLastCalledWith('/modules/releases/tech-debt/issues?component=AI+Gateway&component=Model+Serving')
    expect(wrapper.get('[data-testid="tech-debt-in-flight-pane"]').text()).toContain('RHAI-10')
    expect(wrapper.get('[data-testid="tech-debt-backlog-pane"]').text()).toContain('RHAI-20')
    expect(wrapper.get('[data-testid="tech-debt-backlog-pane"]').text()).toContain('1')
    expect(wrapper.findAll('[data-testid="tech-debt-issue-type"]').map(node => node.text())).toEqual(['Bug', 'Vulnerability'])
    expect(wrapper.findAll('[data-testid="tech-debt-status"]').map(node => node.text())).toEqual(['In Progress', 'Open'])
    expect(wrapper.get('a[href="https://jira.example.test/browse/RHAI-20"]').attributes('target')).toBe('_blank')
  })

  it('instantly restores a previously loaded component selection from the session cache', async function () {
    apiRequest.mockImplementation(function (path) {
      if (path === '/modules/releases/tech-debt/components') return Promise.resolve(componentsResponse)
      const modelServing = path.includes('component=Model+Serving')
      const component = modelServing ? 'Model Serving' : 'AI Gateway'
      const key = modelServing ? 'RHAI-MODEL-1' : 'RHAI-GATEWAY-1'
      return Promise.resolve(cockpitResponse({
        selectedComponents: [component],
        counts: { total: 1, inFlight: 0, backlog: 1, bugs: 1, vulnerabilities: 0 },
        inFlight: [],
        backlog: [scoredBug(key, { rank: 1, components: [component] })]
      }))
    })
    const wrapper = mount(TechDebtPrioritizationView)
    await flushPromises()

    await selectComponent(wrapper, 'AI Gateway')
    expect(wrapper.get('[data-testid="tech-debt-backlog-pane"]').text()).toContain('RHAI-GATEWAY-1')

    await wrapper.get('input[aria-label="AI Gateway"]').setValue(false)
    await flushPromises()
    await wrapper.get('input[aria-label="Model Serving"]').setValue(true)
    await flushPromises()
    expect(wrapper.get('[data-testid="tech-debt-backlog-pane"]').text()).toContain('RHAI-MODEL-1')

    await wrapper.get('input[aria-label="Model Serving"]').setValue(false)
    await flushPromises()
    await wrapper.get('input[aria-label="AI Gateway"]').setValue(true)
    await flushPromises()

    const issueRequests = apiRequest.mock.calls.map(function (call) { return call[0] }).filter(function (path) {
      return path.startsWith('/modules/releases/tech-debt/issues?')
    })
    expect(issueRequests).toHaveLength(2)
    expect(wrapper.get('[data-testid="tech-debt-backlog-pane"]').text()).toContain('RHAI-GATEWAY-1')
    expect(wrapper.get('[data-testid="tech-debt-fetched-at"]').text()).toContain('saved session data')
  })

  it('keeps stale cached stats visible while refreshing them in the background', async function () {
    let resolveIssues
    apiRequest.mockImplementation(function (path) {
      if (path === '/modules/releases/tech-debt/components') return Promise.resolve(componentsResponse)
      return new Promise(function (resolve) { resolveIssues = resolve })
    })
    writeTechDebtIssueCache(
      techDebtIssueCacheKey(['AI Gateway'], '', ''),
      cockpitResponse({ counts: { total: 7, inFlight: 1, backlog: 6, bugs: 6, vulnerabilities: 1 } }),
      Date.now() - TECH_DEBT_CACHE_TTL_MS
    )
    const wrapper = mount(TechDebtPrioritizationView)
    await flushPromises()

    await selectComponent(wrapper, 'AI Gateway')

    expect(wrapper.get('[data-testid="tech-debt-summary"]').text()).toContain('7')
    expect(wrapper.get('[data-testid="tech-debt-background-refresh"]').text()).toContain('Previously loaded results remain available')

    resolveIssues(cockpitResponse({ counts: { total: 3, inFlight: 1, backlog: 2, bugs: 2, vulnerabilities: 1 } }))
    await flushPromises()

    expect(wrapper.get('[data-testid="tech-debt-summary"]').text()).toContain('3')
    expect(wrapper.find('[data-testid="tech-debt-background-refresh"]').exists()).toBe(false)
  })

  it('sends the selected Bug or CVE issue type filter with the component request', async function () {
    mockSuccessfulApi()
    const wrapper = mount(TechDebtPrioritizationView)
    await flushPromises()
    await selectComponent(wrapper)

    await wrapper.get('[data-testid="tech-debt-issue-type-filter"]').setValue('Vulnerability')
    await flushPromises()

    expect(apiRequest).toHaveBeenLastCalledWith('/modules/releases/tech-debt/issues?component=AI+Gateway&issueType=Vulnerability')
    expect(wrapper.get('[data-testid="tech-debt-selected-filters"]').text()).toContain('Issue type: CVE (Vulnerability)')
  })

  it('sends the Needs Triage filter, reflects it as a chip, and clears it for Bugs', async function () {
    mockSuccessfulApi()
    const wrapper = mount(TechDebtPrioritizationView)
    await flushPromises()
    await selectComponent(wrapper)

    await wrapper.get('[data-testid="tech-debt-triage-filter"]').setValue('exceptions')
    await flushPromises()

    expect(apiRequest).toHaveBeenLastCalledWith('/modules/releases/tech-debt/issues?component=AI+Gateway&triage=exceptions')
    expect(wrapper.get('[data-testid="tech-debt-selected-filters"]').text()).toContain('Triage: Needs Triage / Exceptions')

    await wrapper.get('[data-testid="tech-debt-issue-type-filter"]').setValue('Bug')
    await flushPromises()

    expect(wrapper.get('[data-testid="tech-debt-triage-filter"]').attributes('disabled')).toBeDefined()
    expect(apiRequest).toHaveBeenLastCalledWith('/modules/releases/tech-debt/issues?component=AI+Gateway&issueType=Bug')
  })

  it('shows one mixed, globally ranked queue with an auditable CVE score breakdown', async function () {
    mockSuccessfulApi(cockpitResponse({
      counts: { total: 2, inFlight: 0, backlog: 2, bugs: 1, vulnerabilities: 1 },
      inFlight: [],
      backlog: [
        scoredVulnerability('RHAI-CVE-1', { rank: 1 }),
        scoredBug('RHAI-BUG-1', { rank: 2, rankGroup: 'combined' })
      ]
    }))
    const wrapper = mount(TechDebtPrioritizationView)
    await flushPromises()
    await selectComponent(wrapper)

    const pane = wrapper.get('[data-testid="tech-debt-backlog-pane"]')
    const cards = pane.findAll('[data-testid="tech-debt-backlog-card"]')
    expect(cards.map(card => card.get('a').text())).toEqual(expect.arrayContaining(['RHAI-CVE-1 (opens in a new tab)', 'RHAI-BUG-1 (opens in a new tab)']))
    expect(cards[0].get('[aria-label="Tech debt backlog rank 1"]').text()).toBe('1')
    expect(cards[1].get('[aria-label="Tech debt backlog rank 2"]').text()).toBe('2')
    expect(cards[0].get('[data-testid="tech-debt-score"]').text()).toBe('P0 · 95')
    expect(cards[0].get('[data-testid="tech-debt-score-breakdown"]').text()).toContain('35 SLA + 30 CVSS + 15 Due + 10 Review + 5 Age + 0 Uncertainty = 95')
    expect(cards[0].get('[data-testid="tech-debt-triage-flags"]').text()).toContain('SLA breached')
    expect(wrapper.text()).toContain('Bugs and CVEs ranked together by effective priority score')
  })

  it('uses active Bug scores for ordering while preserving classification evidence and guardrails', async function () {
    mockSuccessfulApi(cockpitResponse({
      counts: { total: 2, inFlight: 0, backlog: 2, bugs: 2, vulnerabilities: 0 },
      inFlight: [],
      backlog: [
        scoredBug('RHAI-BUG-LOW', {
          rank: 1,
          jiraPriority: 'Low',
          priorityScore: 90,
          rawScore: 90,
          priorityBand: { level: 'P0', label: 'Immediate', expectedAction: 'Begin within 1–2 business days' },
          guardrail: { applied: false, reasons: [] }
        }),
        scoredBug('RHAI-BUG-HIGH', {
          rank: 2,
          jiraPriority: 'High',
          priorityScore: 60,
          rawScore: 60,
          priorityBand: { level: 'P2', label: 'Planned', expectedAction: 'Commit to the current or next sprint' },
          guardrail: { applied: false, reasons: [] }
        })
      ]
    }))
    const wrapper = mount(TechDebtPrioritizationView)
    await flushPromises()
    await selectComponent(wrapper)

    const cards = wrapper.findAll('[data-testid="tech-debt-backlog-card"]')
    expect(cards[0].text()).toContain('RHAI-BUG-LOW')
    expect(cards[1].text()).toContain('RHAI-BUG-HIGH')
    expect(cards[0].get('[data-testid="tech-debt-score"]').text()).toBe('P0 · 90')
    expect(cards[0].get('[data-testid="tech-debt-bug-classification"]').text()).toContain('Approved Release Blocker')
    expect(cards[1].get('[data-testid="tech-debt-score-breakdown"]').text()).toContain('0 Customer + 22 Delivery/security + 2 Detection + 16 Jira severity + 15 Due + 5 Age = 60')
    expect(cards[0].get('[data-testid="tech-debt-score-breakdown"]').text()).toContain('Release Blocker is Approved')
    expect(wrapper.text()).toContain('Bugs and CVEs ranked together by effective priority score')
  })

  it('shows summary counts and stale-data warnings', async function () {
    mockSuccessfulApi(cockpitResponse({ warning: 'Showing cached Jira data.', cacheStatus: 'stale' }))
    const wrapper = mount(TechDebtPrioritizationView)
    await flushPromises()
    await selectComponent(wrapper)

    const summary = wrapper.get('[data-testid="tech-debt-summary"]').text()
    expect(summary).toContain('Total')
    expect(summary).toContain('In flight')
    expect(summary).toContain('Vulnerabilities')
    expect(wrapper.get('[data-testid="tech-debt-stale-warning"]').text()).toContain('cached Jira data')
    expect(wrapper.get('[data-testid="tech-debt-fetched-at"]').text()).toContain('stale Jira data')
  })

  it('shows 25 cards initially and makes every issue accessible with Show more', async function () {
    const backlog = Array.from({ length: 26 }, function (_, index) {
      return issue('RHAI-' + (index + 1), { rank: index + 1 })
    })
    mockSuccessfulApi(cockpitResponse({
      counts: { total: 26, inFlight: 0, backlog: 26, bugs: 26, vulnerabilities: 0 },
      inFlight: [],
      backlog
    }))
    const wrapper = mount(TechDebtPrioritizationView)
    await flushPromises()
    await selectComponent(wrapper)

    expect(wrapper.findAll('[data-testid="tech-debt-backlog-card"]')).toHaveLength(25)
    await wrapper.get('[data-testid="tech-debt-backlog-more"]').trigger('click')
    expect(wrapper.findAll('[data-testid="tech-debt-backlog-card"]')).toHaveLength(26)
  })

  it('forces a refresh from the manual Refresh action', async function () {
    mockSuccessfulApi()
    const wrapper = mount(TechDebtPrioritizationView)
    await flushPromises()
    await selectComponent(wrapper)

    await wrapper.get('[data-testid="tech-debt-refresh"]').trigger('click')
    await flushPromises()

    expect(apiRequest).toHaveBeenLastCalledWith('/modules/releases/tech-debt/issues?component=AI+Gateway&refresh=true')
  })

  it('shows loading, retryable error, and empty-pane states', async function () {
    let rejectIssues
    apiRequest.mockImplementation(function (path) {
      if (path === '/modules/releases/tech-debt/components') return Promise.resolve(componentsResponse)
      return new Promise(function (resolve, reject) { rejectIssues = reject })
    })
    const wrapper = mount(TechDebtPrioritizationView)
    await flushPromises()
    await wrapper.get('[data-testid="tech-debt-component-filter"]').trigger('click')
    await wrapper.get('input[aria-label="AI Gateway"]').setValue(true)
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="tech-debt-loading"]').exists()).toBe(true)
    rejectIssues(new Error('Jira failed'))
    await flushPromises()
    expect(wrapper.get('[data-testid="tech-debt-error"]').text()).toContain('Jira failed')

    apiRequest.mockImplementation(function (path) {
      if (path === '/modules/releases/tech-debt/components') return Promise.resolve(componentsResponse)
      return Promise.resolve(cockpitResponse({
        counts: { total: 0, inFlight: 0, backlog: 0, bugs: 0, vulnerabilities: 0 },
        inFlight: [],
        backlog: []
      }))
    })
    await wrapper.get('[data-testid="tech-debt-error"] button').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="tech-debt-in-flight-pane"]').text()).toContain('No In Progress or Review issues')
    expect(wrapper.get('[data-testid="tech-debt-backlog-pane"]').text()).toContain('No unresolved backlog issues')
  })

  it('shows selected components and clearing filters closes the cockpit', async function () {
    mockSuccessfulApi()
    const wrapper = mount(TechDebtPrioritizationView)
    await flushPromises()
    await selectComponent(wrapper)

    expect(wrapper.get('[data-testid="tech-debt-selected-filters"]').text()).toContain('Component: AI Gateway')
    expect(wrapper.find('[data-testid="tech-debt-cockpit"]').exists()).toBe(true)

    await wrapper.get('[data-testid="tech-debt-clear-filters"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="tech-debt-selected-filters"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="tech-debt-cockpit"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="tech-debt-component-required"]').exists()).toBe(true)
  })

  it('keeps the release selector as an unwired All Releases dropdown', async function () {
    mockSuccessfulApi()
    const wrapper = mount(TechDebtPrioritizationView)
    await flushPromises()

    const options = wrapper.get('[data-testid="tech-debt-release-filter"]').findAll('option')
    expect(options).toHaveLength(1)
    expect(options[0].text()).toBe('All Releases')
  })
})
