import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import TeamBacklogTab from '../../client/components/TeamBacklogTab.vue'

vi.mock('@shared/client/services/api.js', () => ({
  apiRequest: vi.fn().mockResolvedValue({ assessments: {} })
}))

const sampleIssues = [
  { key: 'RFE-1', summary: 'Feature A', components: ['KServe', 'ModelMesh'], status: 'New', statusCategory: 'To Do', priority: 'Major', created: '2025-06-01' },
  { key: 'RFE-2', summary: 'Feature B', components: ['KServe'], status: 'New', statusCategory: 'To Do', priority: 'Minor', created: '2025-07-01' },
  { key: 'RFE-3', summary: 'Feature C', components: ['Caikit'], status: 'In Progress', statusCategory: 'In Progress', priority: 'Critical', created: '2025-05-01' },
]

const rfeConfig = { jiraHost: 'https://redhat.atlassian.net' }

describe('TeamBacklogTab', () => {
  it('renders ComponentList and RfeBacklogTable', () => {
    const wrapper = mount(TeamBacklogTab, {
      props: {
        components: ['KServe', 'ModelMesh', 'Caikit'],
        rfeIssues: sampleIssues,
        rfeConfig
      }
    })
    expect(wrapper.text()).toContain('Components')
    expect(wrapper.text()).toContain('Open RFEs')
    expect(wrapper.text()).toContain('3 issues')
  })

  it('computes rfeCounts correctly from issues', () => {
    const wrapper = mount(TeamBacklogTab, {
      props: {
        components: ['KServe', 'ModelMesh', 'Caikit'],
        rfeIssues: sampleIssues,
        rfeConfig
      }
    })
    // KServe appears in RFE-1 and RFE-2 = 2 RFEs
    expect(wrapper.text()).toContain('2 RFEs')
    // Caikit appears in RFE-3 = 1 RFE
    expect(wrapper.text()).toContain('1 RFEs')
  })

  it('hides Components section when components array is empty', () => {
    const wrapper = mount(TeamBacklogTab, {
      props: {
        components: [],
        rfeIssues: sampleIssues,
        rfeConfig
      }
    })
    // The "Components" h3 section header should not be present,
    // but "Components" will appear as a table column header in RfeBacklogTable
    const headings = wrapper.findAll('h3')
    const headingTexts = headings.map(h => h.text())
    expect(headingTexts).not.toContain('Components')
    expect(wrapper.text()).toContain('Open RFEs')
  })

  it('shows empty state in RfeBacklogTable when no issues', () => {
    const wrapper = mount(TeamBacklogTab, {
      props: {
        components: ['KServe'],
        rfeIssues: [],
        rfeConfig
      }
    })
    expect(wrapper.text()).toContain('No open RFEs for this team')
  })
})
