import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import TriageReadinessTable from '../../../client/deliver/components/TriageReadinessTable.vue'

describe('TriageReadinessTable', () => {
  it('shows the organization-wide loading state', () => {
    const wrapper = mount(TriageReadinessTable, { props: { loading: true } })

    expect(wrapper.text()).toContain('Loading organization-wide Proposed release blockers')
    expect(wrapper.text()).toContain('Loading…')
  })

  it('shows an independent error state and emits retry', async () => {
    const wrapper = mount(TriageReadinessTable, { props: { error: 'Jira unavailable' } })

    expect(wrapper.text()).toContain('Organization-wide Triage Readiness is temporarily unavailable')
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })

  it('identifies an empty organization-wide Proposed cohort', () => {
    const wrapper = mount(TriageReadinessTable)

    expect(wrapper.text()).toContain('No Proposed release blockers were found for upcoming Jira Fix Versions')
    expect(wrapper.text()).toContain('0 of 0 ready')
  })
})
