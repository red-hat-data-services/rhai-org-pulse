/**
 * Align legend popover — definitions for Hub tiles and component headers.
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import AlignmentLegendPopover from '../../../client/plan/components/AlignmentLegendPopover.vue'

describe('AlignmentLegendPopover', function() {
  it('opens the legend with Early or as requested and After requested', async function() {
    var wrapper = mount(AlignmentLegendPopover, {
      props: { variant: 'button' }
    })
    expect(wrapper.text()).toContain('Legend')
    await wrapper.find('[aria-label="Align legend"]').trigger('click')
    await nextTick()
    expect(wrapper.text()).toContain('TV/FV Align legend')
    expect(wrapper.text()).toContain('Early or as requested')
    expect(wrapper.text()).toContain('After requested')
    expect(wrapper.text()).toContain('Different products')
    expect(wrapper.text()).toMatch(/same milestone|earlier/i)
    expect(wrapper.text()).toMatch(/committed version freeze/i)
    expect(wrapper.text()).toContain('Hub tiles count each issue once')
  })
})
