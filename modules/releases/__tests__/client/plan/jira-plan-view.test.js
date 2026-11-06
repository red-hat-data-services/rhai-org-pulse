import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import JiraPlanView from '../../../client/plan/views/JiraPlanView.vue'

vi.mock('@shared/client/services/api', function() {
  return { apiRequest: vi.fn() }
})

import { apiRequest } from '@shared/client/services/api'

var planPayload = {
  plan: { name: 'RHAI Outcome to Feature Prioritization' },
  sentinelKey: 'RHAISTRAT-2921',
  generatedAt: '2026-11-04T15:00:00.000Z',
  outcomes: [
    {
      key: 'RHAISTRAT-3004',
      rank: 1,
      summary: 'First ranked outcome',
      issueType: 'Outcome',
      status: 'New',
      statusCategory: 'To Do',
      priority: 'Blocker',
      assignee: 'Christopher Ferreira',
      productManager: 'Christopher Ferreira',
      components: ['AI Gateway'],
      targetVersions: ['3.7 GA RHOAI RELEASE'],
      fixVersions: ['3.6 GA RHOAI RELEASE'],
      url: 'https://redhat.atlassian.net/browse/RHAISTRAT-3004'
    },
    {
      key: 'RHAISTRAT-1981',
      rank: 2,
      summary: 'Second ranked outcome',
      issueType: 'Outcome',
      status: 'In Progress',
      statusCategory: 'In Progress',
      priority: 'Critical',
      assignee: 'Naina Singh',
      productManager: 'Naina Singh',
      components: [],
      targetVersions: [],
      fixVersions: [],
      url: 'https://redhat.atlassian.net/browse/RHAISTRAT-1981'
    }
  ]
}

describe('JiraPlanView', function() {
  beforeEach(function() {
    vi.clearAllMocks()
  })

  it('loads the ranked plan and labels the page as read-only', async function() {
    apiRequest.mockResolvedValue(planPayload)
    var wrapper = mount(JiraPlanView)
    await flushPromises()

    expect(wrapper.get('[data-testid="jira-plan-view"]').text()).toContain('Read-only')
    expect(wrapper.get('[data-testid="jira-plan-view"]').text()).toContain('RHAISTRAT-2921')
    expect(wrapper.findAll('[data-testid="jira-plan-outcome-row"]')).toHaveLength(2)
    expect(wrapper.text()).toContain('First ranked outcome')
    expect(wrapper.text()).toContain('Second ranked outcome')
    expect(wrapper.text()).toContain('Releases')
    expect(wrapper.text()).toContain('3.6 GA RHOAI RELEASE')
    expect(apiRequest).toHaveBeenCalledWith('/modules/releases/planning/jira-plan')
  })

  it('expands an Outcome and lazily loads its child work items', async function() {
    apiRequest
      .mockResolvedValueOnce(planPayload)
      .mockResolvedValueOnce({
        outcomeKey: 'RHAISTRAT-3004',
        children: [{
          key: 'RHAISTRAT-1935',
          summary: 'Child feature',
          issueType: 'Feature',
          status: 'New',
          statusCategory: 'To Do',
          priority: 'Major',
          assignee: 'Nick Gagan',
          targetVersions: ['3.7 GA RHOAI RELEASE'],
          fixVersions: ['3.7 GA RHOAI RELEASE'],
          url: 'https://redhat.atlassian.net/browse/RHAISTRAT-1935'
        }]
      })

    var wrapper = mount(JiraPlanView)
    await flushPromises()

    await wrapper.get('[data-testid="jira-plan-toggle-RHAISTRAT-3004"]').trigger('click')
    await flushPromises()

    expect(apiRequest).toHaveBeenCalledWith('/modules/releases/planning/jira-plan/outcomes/RHAISTRAT-3004/children')
    expect(wrapper.findAll('[data-testid="jira-plan-child-row"]')).toHaveLength(1)
    expect(wrapper.text()).toContain('Child feature')
    expect(wrapper.text()).toContain('Releases')
    expect(wrapper.text()).toContain('3.7 GA RHOAI RELEASE')
  })

  it('shows a clear error when the Plan cannot be loaded', async function() {
    apiRequest.mockRejectedValue(new Error('Jira credentials unavailable'))
    var wrapper = mount(JiraPlanView)
    await flushPromises()

    expect(wrapper.text()).toContain('Could not load the Jira Plan.')
    expect(wrapper.text()).toContain('Jira credentials unavailable')
  })
})
