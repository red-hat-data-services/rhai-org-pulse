import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RfeBacklogTable from '../../client/components/RfeBacklogTable.vue'

const sampleIssues = [
  {
    key: 'RHAIRFE-100',
    summary: 'Add GPU autoscaling support',
    components: ['KServe', 'ModelMesh'],
    status: 'New',
    statusCategory: 'To Do',
    priority: 'Major',
    created: '2025-06-15T10:00:00Z'
  },
  {
    key: 'RHAIRFE-200',
    summary: 'Improve inference latency',
    components: ['KServe'],
    status: 'In Progress',
    statusCategory: 'In Progress',
    priority: 'Critical',
    created: '2025-07-01T10:00:00Z'
  },
  {
    key: 'RHAIRFE-50',
    summary: 'Documentation updates',
    components: [],
    status: 'New',
    statusCategory: 'To Do',
    priority: 'Minor',
    created: '2025-05-01T10:00:00Z'
  }
]

const rfeConfig = {
  jiraHost: 'https://redhat.atlassian.net',
  jiraProject: 'RHAIRFE'
}

describe('RfeBacklogTable', () => {
  it('renders all issues', () => {
    const wrapper = mount(RfeBacklogTable, { props: { issues: sampleIssues, rfeConfig } })
    expect(wrapper.text()).toContain('RHAIRFE-100')
    expect(wrapper.text()).toContain('RHAIRFE-200')
    expect(wrapper.text()).toContain('RHAIRFE-50')
  })

  it('generates correct Jira links', () => {
    const wrapper = mount(RfeBacklogTable, { props: { issues: sampleIssues, rfeConfig } })
    const links = wrapper.findAll('a[target="_blank"]')
    const hrefs = links.map(l => l.attributes('href'))
    expect(hrefs.some(h => h.includes('redhat.atlassian.net/browse/RHAIRFE-100'))).toBe(true)
  })

  it('renders component chips', () => {
    const wrapper = mount(RfeBacklogTable, { props: { issues: sampleIssues, rfeConfig } })
    expect(wrapper.text()).toContain('KServe')
    expect(wrapper.text()).toContain('ModelMesh')
  })

  it('filters issues by search query', async () => {
    const wrapper = mount(RfeBacklogTable, { props: { issues: sampleIssues, rfeConfig } })
    const input = wrapper.find('input')
    await input.setValue('GPU')
    expect(wrapper.text()).toContain('RHAIRFE-100')
    expect(wrapper.text()).not.toContain('RHAIRFE-200')
    expect(wrapper.text()).not.toContain('RHAIRFE-50')
  })

  it('sorts by column when header clicked', async () => {
    const wrapper = mount(RfeBacklogTable, { props: { issues: sampleIssues, rfeConfig } })
    // Click "Key" header to sort ascending
    const keyHeader = wrapper.findAll('th').find(th => th.text().includes('Key'))
    await keyHeader.trigger('click')
    const rows = wrapper.findAll('tbody tr')
    expect(rows[0].text()).toContain('RHAIRFE-50')
  })

  it('shows empty state when no issues', () => {
    const wrapper = mount(RfeBacklogTable, { props: { issues: [], rfeConfig } })
    expect(wrapper.text()).toContain('No open RFEs for this team')
  })

  it('shows no-match message for empty search results', async () => {
    const wrapper = mount(RfeBacklogTable, { props: { issues: sampleIssues, rfeConfig } })
    const input = wrapper.find('input')
    await input.setValue('nonexistent-query-xyz')
    expect(wrapper.text()).toContain('No RFEs match')
  })

  it('renders status badges with appropriate classes', () => {
    const wrapper = mount(RfeBacklogTable, { props: { issues: sampleIssues, rfeConfig } })
    const badges = wrapper.findAll('.rounded-full')
    expect(badges.length).toBeGreaterThan(0)
  })
})
