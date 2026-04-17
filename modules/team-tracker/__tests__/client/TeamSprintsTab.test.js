import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import TeamSprintsTab from '../../client/components/TeamSprintsTab.vue'

// Mock chart.js and vue-chartjs to avoid canvas issues
vi.mock('vue-chartjs', () => ({
  Doughnut: { template: '<div class="mock-doughnut"></div>', props: ['data', 'options'] },
  Line: { template: '<div class="mock-line"></div>', props: ['data', 'options'] }
}))
vi.mock('chart.js', () => ({
  Chart: { register: vi.fn() },
  ArcElement: {},
  Tooltip: {},
  Legend: {},
  CategoryScale: {},
  LinearScale: {},
  PointElement: {},
  LineElement: {},
  Filler: {},
  Title: {}
}))

const mockApiRequest = vi.fn()
vi.mock('@shared/client/services/api', () => ({
  apiRequest: (...args) => mockApiRequest(...args)
}))

const boardsWithUrl = [
  { url: 'https://redhat.atlassian.net/jira/software/c/projects/RHOAIENG/boards/456', name: 'Model Serving Board' }
]

describe('TeamSprintsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('extracts board ID from URL and fetches sprint data', async () => {
    mockApiRequest.mockImplementation((path) => {
      if (path.includes('/sprints')) return Promise.resolve({ sprints: [{ id: 1, name: 'Sprint 1', state: 'closed' }] })
      if (path.includes('/trend')) return Promise.resolve({ sprints: [] })
      return Promise.resolve({})
    })

    mount(TeamSprintsTab, { props: { boards: boardsWithUrl } })
    await flushPromises()

    expect(mockApiRequest).toHaveBeenCalledWith('/modules/team-tracker/boards/456/sprints')
    expect(mockApiRequest).toHaveBeenCalledWith('/modules/team-tracker/boards/456/trend')
  })

  it('shows board selector for multiple boards', async () => {
    mockApiRequest.mockResolvedValue({ sprints: [] })
    const multipleBoards = [
      { url: 'https://jira.example.com/boards/100', name: 'Board A' },
      { url: 'https://jira.example.com/boards/200', name: 'Board B' }
    ]

    const wrapper = mount(TeamSprintsTab, { props: { boards: multipleBoards } })
    await flushPromises()

    const select = wrapper.find('select')
    expect(select.exists()).toBe(true)
    const options = wrapper.findAll('option')
    expect(options).toHaveLength(2)
    expect(options[0].text()).toBe('Board A')
    expect(options[1].text()).toBe('Board B')
  })

  it('does not show board selector for single board', async () => {
    mockApiRequest.mockResolvedValue({ sprints: [] })

    const wrapper = mount(TeamSprintsTab, { props: { boards: boardsWithUrl } })
    await flushPromises()

    expect(wrapper.find('select').exists()).toBe(false)
  })

  it('shows error when board ID cannot be extracted', async () => {
    const badBoards = [{ url: 'https://jira.example.com/invalid', name: 'Bad Board' }]

    const wrapper = mount(TeamSprintsTab, { props: { boards: badBoards } })
    await flushPromises()

    expect(wrapper.text()).toContain('Could not extract board ID')
  })

  it('shows no data message when sprints and trend are empty', async () => {
    mockApiRequest.mockResolvedValue({ sprints: [] })

    const wrapper = mount(TeamSprintsTab, { props: { boards: boardsWithUrl } })
    await flushPromises()

    expect(wrapper.text()).toContain('No sprint data available')
  })

  it('loads sprint detail on demand when sprint is selected', async () => {
    mockApiRequest.mockImplementation((path) => {
      if (path.includes('/boards/456/sprints')) return Promise.resolve({ sprints: [{ id: 42, name: 'Sprint 5', state: 'active' }] })
      if (path.includes('/boards/456/trend')) return Promise.resolve({ sprints: [{ sprintId: 42, sprintName: 'Sprint 5' }] })
      if (path.includes('/sprints/42')) return Promise.resolve({
        metrics: {},
        committed: { issues: [], count: 0, points: 0 },
        delivered: { issues: [], count: 0, points: 0 },
        addedMidSprint: { issues: [], count: 0 },
        removed: { issues: [], count: 0 },
        incomplete: { issues: [], count: 0 },
        byAssignee: {}
      })
      return Promise.resolve({})
    })

    const wrapper = mount(TeamSprintsTab, { props: { boards: boardsWithUrl } })
    await flushPromises()

    // Sprint detail should not be loaded initially (viewMode is 'overview')
    expect(mockApiRequest).not.toHaveBeenCalledWith('/modules/team-tracker/sprints/42')

    // Switch to sprint-detail mode
    const sprintDetailButton = wrapper.findAll('button').find(b => b.text() === 'Sprint Detail')
    await sprintDetailButton.trigger('click')
    await flushPromises()

    // Now sprint detail should be fetched
    expect(mockApiRequest).toHaveBeenCalledWith('/modules/team-tracker/sprints/42')
  })
})
