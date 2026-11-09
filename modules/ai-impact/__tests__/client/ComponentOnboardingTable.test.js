import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ComponentOnboardingTable from '../../client/components/ComponentOnboardingTable.vue'

describe('ComponentOnboardingTable', () => {
  it('renders RHAI issue keys as Jira links', () => {
    const jiraKey = 'RHAI-21891'
    const wrapper = mount(ComponentOnboardingTable, {
      props: {
        components: {
          [jiraKey]: {
            key: jiraKey,
            summary: 'RHOAI component onboarding test',
            componentName: 'odh-rhai-project-test',
            completionStatus: 'in-progress',
            productContext: 'RHOAI',
            targetVersion: '3.6 GA RHOAI RELEASE',
            onboardingSteps: {},
            linkedFeatures: [],
            created: '2026-01-01T00:00:00.000Z',
            onboardingMethod: 'automated'
          }
        }
      }
    })

    const jiraLink = wrapper.findAll('a').find(link => link.attributes('href') === `https://redhat.atlassian.net/browse/${jiraKey}`)
    expect(jiraLink).toBeDefined()
    expect(jiraLink.text()).toBe(jiraKey)
  })
})
