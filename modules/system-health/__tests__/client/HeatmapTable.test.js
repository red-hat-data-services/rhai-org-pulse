import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import HeatmapTable from '../../client/components/HeatmapTable.vue'

const heatmapPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../fixtures/system-health/test-execution/heatmap.json'
)

describe('HeatmapTable', () => {
  it('renders pass-rate cells for components with day data', () => {
    const heatmap = JSON.parse(readFileSync(heatmapPath, 'utf8'))
    const components = heatmap.components.filter((c) => c.component === 'AI Hub')

    const wrapper = mount(HeatmapTable, {
      props: { components }
    })

    expect(wrapper.find('.cell-pct').exists()).toBe(true)
    expect(wrapper.text()).toMatch(/%/)
    expect(wrapper.text()).not.toContain('RHOAI Deployment')
  })
})
