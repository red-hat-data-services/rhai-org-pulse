import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import VersionSummaryPanel from '../../client/components/VersionSummaryPanel.vue'

const props = {
  modelValue: '3.6.0', versions: ['3.7.0-ea.1', '3.6.0'],
  summary: { suiteRuns: 1, workflows: 10, tasks: 29, passed: 19, failed: 4, skipped: 6, bugs: 3 }
}

describe('Version summary panel', () => {
  it('keeps suite runs, workflow executions, and task outcomes separate', () => {
    const wrapper = mount(VersionSummaryPanel, { props })
    expect(wrapper.findAll('dl > div').map(card => card.get('dd').text())).toEqual(['1', '10', '29', '19', '4', '6', '3'])
    expect(wrapper.get('[role="img"]').attributes('aria-label')).toBe('19 passed, 4 failed, 6 skipped tasks')
    expect(wrapper.text()).toContain('66% passed')
    wrapper.unmount()
  })

  it('emits version selection for the parent to update both summary and table', async () => {
    const wrapper = mount(VersionSummaryPanel, { props })
    await wrapper.get('select').setValue('3.7.0-ea.1')
    expect(wrapper.emitted('update:modelValue')).toEqual([['3.7.0-ea.1']])
    expect(props.summary.tasks).toBe(29)
    wrapper.unmount()
  })

  it('shows an empty summary without invalid percentages', () => {
    const wrapper = mount(VersionSummaryPanel, { props: { ...props,
      summary: { suiteRuns: 0, workflows: 0, tasks: 0, passed: 0, failed: 0, skipped: 0, bugs: 0 }
    } })
    expect(wrapper.text()).toContain('No tasks recorded')
    expect(wrapper.html()).not.toMatch(/NaN|Infinity/)
    expect(wrapper.get('[role="img"]').attributes('aria-label')).toBe('0 passed, 0 failed, 0 skipped tasks')
    wrapper.unmount()
  })

  it('shows missing counters and bug totals as unavailable without a partial outcome chart', () => {
    const wrapper = mount(VersionSummaryPanel, { props: { ...props,
      summary: { ...props.summary, skipped: null, bugs: null }
    } })
    expect(wrapper.get('[data-testid="summary-skipped"] dd').text()).toBe('—')
    expect(wrapper.get('[data-testid="summary-bugs"]').text()).toContain('Count unavailable')
    expect(wrapper.get('[role="img"]').attributes('aria-label')).toBe('Task outcomes unavailable')
    expect(wrapper.text()).not.toMatch(/NaN|Infinity|% passed/)
    wrapper.unmount()
  })
})
