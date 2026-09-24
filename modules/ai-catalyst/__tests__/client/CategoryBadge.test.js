import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import CategoryBadge from '../../client/components/CategoryBadge.vue'
import PillBadge from '../../client/components/PillBadge.vue'

describe('pillar badge styles', () => {
  it('uses a tinted pillar background with neutral CategoryBadge text', () => {
    const wrapper = mount(CategoryBadge, {
      props: {
        category: 'data-science-engineering',
        pillar: { pillarKey: 'data-science-engineering', shortTitle: 'Data Science', color: '#06b6d4' }
      }
    })
    const badge = wrapper.find('span')

    expect(badge.classes()).toContain('text-gray-700')
    expect(badge.attributes('style')).toContain('background-color: rgba(6, 182, 212, 0.12)')
    expect(badge.attributes('style')).not.toMatch(/(?:^|;)\s*color:/)
  })

  it('uses colorWithAlpha instead of appending an alpha suffix in PillBadge', () => {
    const wrapper = mount(PillBadge, {
      props: { label: 'Data Science', color: '#06b6d4', variant: 'strategy' }
    })
    const badge = wrapper.find('span')

    expect(badge.classes()).toContain('text-gray-700')
    expect(badge.attributes('style')).toContain('background-color: rgba(6, 182, 212, 0.12)')
    expect(badge.attributes('style')).toContain('border-color: rgba(6, 182, 212, 0.45)')
    expect(badge.attributes('style')).not.toMatch(/(?:^|;)\s*color:/)
    expect(badge.attributes('style')).not.toContain('#06b6d41f')
  })
})
