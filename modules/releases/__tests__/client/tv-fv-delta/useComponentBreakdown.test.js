import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { useComponentBreakdown } from '../../../client/composables/useComponentBreakdown'

function setup(releaseData, metadata) {
  var data = ref({
    metadata: metadata || { all_components: [] },
    releases: {},
  })
  var rd = ref(releaseData)
  return useComponentBreakdown(data, rd).releaseComponentBreakdown
}

describe('useComponentBreakdown Jira links', function () {
  it('builds key-in JQL URLs for every non-zero category count', function () {
    var breakdown = setup({
      aligned_on_time: [
        { key: 'RHAISTRAT-1', component: 'Serving' },
        { key: 'RHAISTRAT-2', component: 'Serving' },
      ],
      aligned_late: [
        { key: 'RHAISTRAT-3', component: 'Serving' },
      ],
      tv_only: [
        { key: 'RHAISTRAT-4', component: 'Serving' },
      ],
      fv_only: [
        { key: 'RHAISTRAT-5', component: 'Serving' },
      ],
      misaligned: [
        { key: 'RHAISTRAT-6', component: 'Serving' },
      ],
    })

    var serving = breakdown.value.find(function (c) { return c.component === 'Serving' })
    expect(serving.total).toBe(6)
    expect(serving.aligned_on_time).toBe(2)
    expect(serving.total_jql).toMatch(/key%20in%20\(/)
    expect(serving.total_jql).toContain('RHAISTRAT-1')
    expect(serving.total_jql).toContain('RHAISTRAT-6')
    expect(serving.aligned_on_time_jql).toContain('RHAISTRAT-1')
    expect(serving.aligned_on_time_jql).toContain('RHAISTRAT-2')
    expect(serving.aligned_on_time_jql).not.toContain('RHAISTRAT-3')
    expect(serving.aligned_late_jql).toContain('RHAISTRAT-3')
    expect(serving.tv_only_jql).toContain('RHAISTRAT-4')
    expect(serving.fv_only_jql).toContain('RHAISTRAT-5')
    expect(serving.misaligned_jql).toContain('RHAISTRAT-6')
  })

  it('leaves JQL empty when a category count is zero', function () {
    var breakdown = setup({
      aligned_on_time: [{ key: 'RHAISTRAT-1', component: 'Training' }],
      aligned_late: [],
      tv_only: [],
      fv_only: [],
      misaligned: [],
    }, { all_components: ['Training', 'EmptyComp'] })

    var training = breakdown.value.find(function (c) { return c.component === 'Training' })
    expect(training.total_jql).toContain('RHAISTRAT-1')
    expect(training.aligned_late_jql).toBe('')
    expect(training.tv_only_jql).toBe('')

    var empty = breakdown.value.find(function (c) { return c.component === 'EmptyComp' })
    expect(empty.total).toBe(0)
    expect(empty.total_jql).toBe('')
  })

  it('dedupes multi-component features and still links total keys', function () {
    var breakdown = setup({
      aligned_on_time: [
        { key: 'RHAISTRAT-10', component: 'Serving, Training' },
      ],
      aligned_late: [],
      tv_only: [],
      fv_only: [],
      misaligned: [],
    })

    var serving = breakdown.value.find(function (c) { return c.component === 'Serving' })
    var training = breakdown.value.find(function (c) { return c.component === 'Training' })
    expect(serving.total).toBe(1)
    expect(training.total).toBe(1)
    expect(serving.total_jql).toContain('RHAISTRAT-10')
    expect(training.total_jql).toContain('RHAISTRAT-10')
  })
})
