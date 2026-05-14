import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import GapAnalysisText from '../../client/components/GapAnalysisText.vue'

describe('GapAnalysisText', () => {
  it('renders collapsible sections with count badges', () => {
    const gapText = `## Scope & Endpoints

- **API specification** — Missing endpoint details. Would be resolved by: API spec.
- **Schema definition** — No schema provided. Would be resolved by: Design doc.

## Test Strategy & Risks

- **Performance targets** — No SLOs defined. Would be resolved by: NFR specification.`

    const wrapper = mount(GapAnalysisText, {
      props: { text: gapText }
    })

    // Section headers should be styled uppercase
    const headers = wrapper.findAll('h5')
    expect(headers).toHaveLength(2)
    expect(headers[0].text()).toBe('Scope & Endpoints')
    expect(headers[1].text()).toBe('Test Strategy & Risks')
    expect(headers[0].classes()).toContain('uppercase')

    // Count badges should show correct numbers
    const badges = wrapper.findAll('span.px-1\\.5')
    expect(badges).toHaveLength(2)
    expect(badges[0].text()).toBe('2')
    expect(badges[1].text()).toBe('1')

    // Sections should be collapsed by default
    expect(wrapper.findAll('span.mr-2')).toHaveLength(0)

    // Click to expand first section
    const buttons = wrapper.findAll('button')
    expect(buttons).toHaveLength(2)
  })

  it('expands section on click', async () => {
    const gapText = `## Scope & Endpoints

- **API specification** — Missing endpoint details. Would be resolved by: API spec.
- **Schema definition** — No schema provided. Would be resolved by: Design doc.`

    const wrapper = mount(GapAnalysisText, {
      props: { text: gapText }
    })

    // Should be collapsed initially
    expect(wrapper.findAll('span.mr-2')).toHaveLength(0)

    // Click section header to expand
    const button = wrapper.find('button')
    await button.trigger('click')

    // Should now show bullets
    expect(wrapper.findAll('span.mr-2')).toHaveLength(2)

    // Bold text should be strong tags
    const strongTags = wrapper.findAll('strong')
    expect(strongTags.length).toBe(2)
    expect(strongTags[0].text()).toBe('API specification')
  })

  it('handles empty text', () => {
    const wrapper = mount(GapAnalysisText, {
      props: { text: '' }
    })
    expect(wrapper.findAll('h5')).toHaveLength(0)
  })

  it('parses inline bold correctly when expanded', async () => {
    const gapText = `## Environment

- **GPU types** — Test requires A100 or V100 but **none specified**. Would be resolved by: ADR.`

    const wrapper = mount(GapAnalysisText, {
      props: { text: gapText }
    })

    // Expand section
    await wrapper.find('button').trigger('click')

    const strongTags = wrapper.findAll('strong')
    expect(strongTags.length).toBe(2)
    expect(strongTags[0].text()).toBe('GPU types')
    expect(strongTags[1].text()).toBe('none specified')
  })

  it('toggles chevron rotation on expand/collapse', async () => {
    const gapText = `## Scope & Endpoints

- **API specification** — Missing endpoint details.`

    const wrapper = mount(GapAnalysisText, {
      props: { text: gapText }
    })

    const chevron = wrapper.find('svg')

    // Should not be rotated initially (collapsed)
    expect(chevron.classes()).not.toContain('rotate-90')

    // Click to expand
    await wrapper.find('button').trigger('click')
    expect(chevron.classes()).toContain('rotate-90')

    // Click to collapse
    await wrapper.find('button').trigger('click')
    expect(chevron.classes()).not.toContain('rotate-90')
  })
})
