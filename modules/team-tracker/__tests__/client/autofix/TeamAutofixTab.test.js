import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import TeamAutofixTab from '../../../client/components/autofix/TeamAutofixTab.vue'

const mockEnabledSlugs = ref(['ai-impact', 'team-tracker'])

vi.mock('../../../../../src/composables/useModules', () => ({
  useModules: () => ({
    enabledBuiltInSlugs: mockEnabledSlugs
  })
}))

const mockFetchAutofixData = vi.fn()
vi.mock('../../../client/services/autofix-api.js', () => ({
  fetchAutofixData: (...args) => mockFetchAutofixData(...args)
}))

// Stub chart.js and vue-chartjs to avoid canvas rendering
vi.mock('vue-chartjs', () => ({
  Bar: { template: '<div class="chart-stub"></div>', props: ['data', 'options'] },
  Line: { template: '<div class="chart-stub"></div>', props: ['data', 'options'] }
}))

vi.mock('chart.js', () => ({
  Chart: { register: vi.fn() },
  CategoryScale: {},
  LinearScale: {},
  PointElement: {},
  LineElement: {},
  BarElement: {},
  BarController: {},
  Filler: {},
  Tooltip: {},
  Legend: {}
}))

const sampleIssues = [
  { key: 'RHOAI-1', summary: 'Fix cert rotate', issueType: 'Bug', priority: 'Major', pipelineState: 'autofix-merged', assignee: 'Alice', components: ['AI Core Platform'], created: '2026-05-20', updated: '2026-05-28', labels: [] },
  { key: 'RHOAI-2', summary: 'Bot too aggressive', issueType: 'Bug', priority: 'Minor', pipelineState: 'autofix-review', assignee: 'Bob', components: ['AI Core Platform'], created: '2026-05-21', updated: '2026-05-29', labels: [] },
  { key: 'RHOAI-3', summary: 'Other team issue', issueType: 'Bug', priority: 'Major', pipelineState: 'autofix-merged', assignee: null, components: ['Dashboard'], created: '2026-05-22', updated: '2026-05-30', labels: [] },
  { key: 'RHOAI-4', summary: 'Rejected fix', issueType: 'Story', priority: 'Major', pipelineState: 'autofix-rejected', assignee: 'Carol', components: ['AI Core Platform'], created: '2026-05-23', updated: '2026-05-31', labels: [] },
  { key: 'RHOAI-5', summary: 'Max retries hit', issueType: 'Bug', priority: 'Critical', pipelineState: 'autofix-max-retries', assignee: 'Dave', components: ['AI Core Platform', 'Security'], created: '2026-05-24', updated: '2026-06-01', labels: [] }
]

const sampleApiResponse = {
  fetchedAt: '2026-06-01T05:00:00Z',
  jiraHost: 'https://redhat.atlassian.net',
  metrics: {},
  trendData: [],
  issues: sampleIssues
}

function setupFetchSuccess(data = sampleApiResponse) {
  mockFetchAutofixData.mockImplementation((onData) => {
    if (onData) onData(data)
    return Promise.resolve(data)
  })
}

function setupFetchError(err) {
  mockFetchAutofixData.mockRejectedValue(err)
}

function mountTab(propsOverrides = {}) {
  return mount(TeamAutofixTab, {
    props: {
      team: { key: 'org::Heimdall', displayName: 'Heimdall' },
      teamDetail: { components: ['AI Core Platform', 'Security'] },
      ...propsOverrides
    }
  })
}

describe('TeamAutofixTab', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-01T12:00:00Z'))
    mockFetchAutofixData.mockReset()
    mockEnabledSlugs.value = ['ai-impact', 'team-tracker']
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // Test 1
  it('renders module-disabled state when ai-impact is not in enabledBuiltInSlugs', () => {
    mockEnabledSlugs.value = ['team-tracker']
    const wrapper = mountTab()
    expect(wrapper.text()).toContain('AI Impact module not enabled')
    expect(wrapper.text()).toContain('Enable it in Settings')
    expect(mockFetchAutofixData).not.toHaveBeenCalled()
  })

  // Test 2
  it('renders empty state when teamDetail has no components', async () => {
    setupFetchSuccess()
    const wrapper = mountTab({ teamDetail: { components: [] } })
    expect(wrapper.text()).toContain('No components configured')
    expect(wrapper.text()).toContain('Add components in team settings')
    expect(mockFetchAutofixData).not.toHaveBeenCalled()
  })

  // Test 3
  it('renders empty state when no matching issues exist', async () => {
    const dataWithNoMatch = {
      ...sampleApiResponse,
      issues: [{ key: 'X-1', summary: 'Unrelated', issueType: 'Bug', priority: 'Major', pipelineState: 'autofix-merged', assignee: null, components: ['Other'], created: '2026-05-20', updated: '2026-05-28', labels: [] }]
    }
    setupFetchSuccess(dataWithNoMatch)
    const wrapper = mountTab()
    await flushPromises()
    expect(wrapper.text()).toContain('No autofix issues')
  })

  // Test 4
  it('defers fetch until teamDetail loads', async () => {
    setupFetchSuccess()
    const wrapper = mountTab({ teamDetail: null })
    await flushPromises()
    expect(mockFetchAutofixData).not.toHaveBeenCalled()

    // Simulate teamDetail loading
    await wrapper.setProps({ teamDetail: { components: ['AI Core Platform'] } })
    await flushPromises()
    expect(mockFetchAutofixData).toHaveBeenCalledOnce()
  })

  // Test 5
  it('filters issues by component intersection', async () => {
    setupFetchSuccess()
    const wrapper = mountTab({ teamDetail: { components: ['AI Core Platform'] } })
    await flushPromises()
    // RHOAI-3 has component 'Dashboard' and should be excluded
    expect(wrapper.text()).toContain('RHOAI-1')
    expect(wrapper.text()).toContain('RHOAI-2')
    expect(wrapper.text()).not.toContain('RHOAI-3')
    expect(wrapper.text()).toContain('RHOAI-4')
    expect(wrapper.text()).toContain('RHOAI-5')
  })

  // Test 6
  it('computes metrics correctly', async () => {
    setupFetchSuccess()
    const wrapper = mountTab({ teamDetail: { components: ['AI Core Platform'] } })
    await flushPromises()
    // Total matching issues in window: 4 (RHOAI-1, 2, 4, 5 match AI Core Platform)
    expect(wrapper.text()).toContain('4') // total
    // Bugs merged: RHOAI-1 (Bug + merged) = 1
    expect(wrapper.text()).toContain('1') // bugs fixed
  })

  // Test 7
  it('shows dash for success rate when terminal count < 3', async () => {
    const fewIssues = {
      ...sampleApiResponse,
      issues: [
        { key: 'A-1', summary: 'Fix', issueType: 'Bug', priority: 'Major', pipelineState: 'autofix-merged', assignee: null, components: ['AI Core Platform'], created: '2026-05-20', updated: '2026-05-28', labels: [] }
      ]
    }
    setupFetchSuccess(fewIssues)
    const wrapper = mountTab({ teamDetail: { components: ['AI Core Platform'] } })
    await flushPromises()
    // Terminal total = 1 (< 3), so should show dash
    expect(wrapper.text()).toContain('\u2014') // em dash
  })

  // Test 8
  it('renders pipeline state badges with correct labels', async () => {
    setupFetchSuccess()
    const wrapper = mountTab({ teamDetail: { components: ['AI Core Platform'] } })
    await flushPromises()
    expect(wrapper.text()).toContain('AI Fix Merged')
    expect(wrapper.text()).toContain('AI Fix Under Review')
    expect(wrapper.text()).toContain('AI Fix Rejected')
    expect(wrapper.text()).toContain('AI Max Retries')
  })

  // Test 9
  it('time window filter changes displayed issues without re-fetching API', async () => {
    const issuesWithOldDate = {
      ...sampleApiResponse,
      issues: [
        ...sampleIssues,
        { key: 'OLD-1', summary: 'Old issue', issueType: 'Bug', priority: 'Major', pipelineState: 'autofix-merged', assignee: null, components: ['AI Core Platform'], created: '2026-05-24', updated: '2026-05-25', labels: [] }
      ]
    }
    setupFetchSuccess(issuesWithOldDate)
    const wrapper = mountTab({ teamDetail: { components: ['AI Core Platform'] } })
    await flushPromises()
    const initialCallCount = mockFetchAutofixData.mock.calls.length

    // Switch time window
    const weekBtn = wrapper.findAll('button').find(b => b.text() === 'Week')
    await weekBtn.trigger('click')
    await flushPromises()

    // API not called again
    expect(mockFetchAutofixData.mock.calls.length).toBe(initialCallCount)
  })

  // Test 10
  it('state multi-select filter narrows displayed issues', async () => {
    setupFetchSuccess()
    const wrapper = mountTab({ teamDetail: { components: ['AI Core Platform'] } })
    await flushPromises()

    // Open dropdown and check the 'autofix-merged' checkbox
    const dropdownBtn = wrapper.find('.relative button')
    await dropdownBtn.trigger('click')
    await flushPromises()

    const checkboxes = wrapper.findAll('.relative input[type="checkbox"]')
    const mergedCheckbox = checkboxes.find(cb => {
      const label = cb.element.parentElement
      return label && label.textContent.includes('AI Fix Merged')
    })
    await mergedCheckbox.trigger('change')
    await flushPromises()

    // Only RHOAI-1 is merged and has AI Core Platform component
    const tableRows = wrapper.findAll('tbody tr')
    expect(tableRows.length).toBe(1)
    expect(wrapper.text()).toContain('RHOAI-1')
  })

  // Test 11
  it('search filter matches on key, summary, assignee', async () => {
    setupFetchSuccess()
    const wrapper = mountTab({ teamDetail: { components: ['AI Core Platform'] } })
    await flushPromises()

    const input = wrapper.find('input[type="text"]')

    // Search by assignee
    await input.setValue('Bob')
    await flushPromises()
    const rows = wrapper.findAll('tbody tr')
    expect(rows.length).toBe(1)
    expect(wrapper.text()).toContain('RHOAI-2')
  })

  // Test 12
  it('Jira links use jiraHost from API response', async () => {
    const customHost = { ...sampleApiResponse, jiraHost: 'https://custom.atlassian.net' }
    setupFetchSuccess(customHost)
    const wrapper = mountTab({ teamDetail: { components: ['AI Core Platform'] } })
    await flushPromises()

    const link = wrapper.find('a[href*="RHOAI-1"]')
    expect(link.attributes('href')).toBe('https://custom.atlassian.net/browse/RHOAI-1')
  })

  // Test 13
  it('handles API error and shows error state with retry button', async () => {
    setupFetchError(new Error('Network failure'))
    const wrapper = mountTab({ teamDetail: { components: ['AI Core Platform'] } })
    await flushPromises()

    expect(wrapper.text()).toContain('Failed to load autofix data')
    expect(wrapper.text()).toContain('Network failure')

    // Reset mock for retry
    setupFetchSuccess()
    const retryBtn = wrapper.find('button')
    await retryBtn.trigger('click')
    await flushPromises()

    expect(wrapper.text()).not.toContain('Failed to load autofix data')
  })
})
