import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ArchitecturePreview from '../../../client/plan/views/ArchitecturePreview.vue'

// This tab is static reference content (no composable, no pure logic) -- the
// test just confirms the port renders the two reference diagrams intact.
describe('ArchitecturePreview', () => {
  it('renders the AI-First Planning Pipeline diagram', () => {
    const wrapper = mount(ArchitecturePreview)
    expect(wrapper.text()).toContain('AI-First Planning Pipeline')
    expect(wrapper.text()).toContain('Human Approved Inputs')
    expect(wrapper.findAll('.pipeline-col')).toHaveLength(4)
  })

  it('renders the 8-step Draft Release Plans workflow', () => {
    const wrapper = mount(ArchitecturePreview)
    expect(wrapper.text()).toContain('Draft Release Plans')
    expect(wrapper.text()).toContain('Hard Freeze')
    expect(wrapper.text()).toContain('Approve')
    expect(wrapper.findAll('.wf-n')).toHaveLength(8)
  })
})
