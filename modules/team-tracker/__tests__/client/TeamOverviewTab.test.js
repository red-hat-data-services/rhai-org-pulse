import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import TeamOverviewTab from '../../client/components/TeamOverviewTab.vue'

// Mock the chart component to avoid canvas issues in tests
vi.mock('vue-chartjs', () => ({
  Doughnut: { template: '<div class="mock-doughnut"></div>', props: ['data', 'options'] }
}))
vi.mock('chart.js', () => ({
  Chart: { register: vi.fn() },
  ArcElement: {},
  Tooltip: {},
  Legend: {}
}))

// Mock useModuleLink for TeamMembersTable
vi.mock('@shared/client/composables/useModuleLink', () => ({
  useModuleLink: () => ({
    linkTo: (_mod, _view, _params) => '#'
  })
}))

const sampleMembers = [
  { name: 'Alice Smith', jiraDisplayName: 'Alice Smith', engineeringSpeciality: 'Software Engineer', geo: 'US-Raleigh' },
  { name: 'Bob Jones', jiraDisplayName: 'Bob Jones', engineeringSpeciality: 'QE', geo: 'CZ-Brno' },
]

const sampleHeadcount = {
  totalHeadcount: 10,
  totalFte: 9.5,
  byRole: { 'Software Engineer': 7, 'QE': 3 },
  byRoleFte: { 'Software Engineer': 6.5, 'QE': 3.0 }
}

describe('TeamOverviewTab', () => {
  it('renders headcount chart when headcount is provided', () => {
    const wrapper = mount(TeamOverviewTab, {
      props: { headcount: sampleHeadcount, members: sampleMembers }
    })
    expect(wrapper.text()).toContain('Headcount by Role')
    expect(wrapper.find('.mock-doughnut').exists()).toBe(true)
  })

  it('hides headcount chart when headcount is null', () => {
    const wrapper = mount(TeamOverviewTab, {
      props: { headcount: null, members: sampleMembers }
    })
    expect(wrapper.text()).not.toContain('Headcount by Role')
    expect(wrapper.find('.mock-doughnut').exists()).toBe(false)
  })

  it('renders members table with correct member count', () => {
    const wrapper = mount(TeamOverviewTab, {
      props: { headcount: null, members: sampleMembers }
    })
    expect(wrapper.text()).toContain('Team Members')
    expect(wrapper.text()).toContain('2 members')
    expect(wrapper.text()).toContain('Alice Smith')
    expect(wrapper.text()).toContain('Bob Jones')
  })

  it('shows singular "member" for single member', () => {
    const wrapper = mount(TeamOverviewTab, {
      props: { headcount: null, members: [sampleMembers[0]] }
    })
    expect(wrapper.text()).toContain('1 member')
    expect(wrapper.text()).not.toContain('1 members')
  })
})
