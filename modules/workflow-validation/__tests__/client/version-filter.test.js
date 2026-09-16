import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import FilterBar from '../../client/components/FilterBar.vue'
import {
  compareVersionNumbers,
  defaultDateRange,
  displayedOutcomeCounts,
  displayedTestOutcome,
  filters,
  formatBuildId,
  formatSuiteName,
  highestNumberedVersion,
  resetFilters,
  useWorkflowValidation
} from '../../client/composables/useWorkflowValidation'
import { apiRequest } from '@shared/client/services/api'

vi.mock('@shared/client/services/api', () => ({
  apiRequest: vi.fn((path) => {
    if (path.endsWith('/filters')) return Promise.resolve({
      versions: [
        { value: 'release-3.9.20', count: 1 },
        { value: 'RHOAI_3-10', count: 2 },
        { value: 'version 3.10.1-rc2', count: 1 },
        { value: 'unknown', count: 1 }
      ],
      providers: [], models: [], workflows: []
    })
    return Promise.resolve({})
  })
}))

describe('workflow-validation default version filter', () => {
  beforeEach(() => {
    resetFilters()
    apiRequest.mockClear()
  })

  it('compares every numeric run without assuming a version format', () => {
    expect(compareVersionNumbers('release-3.10', 'v3_9_99')).toBeGreaterThan(0)
    expect(compareVersionNumbers('3.10.1-rc2', '3.10.1')).toBeGreaterThan(0)
    expect(compareVersionNumbers('build-0003.010', '3.9.999')).toBeGreaterThan(0)
    expect(highestNumberedVersion(['unknown', '3.9.20', '3-10', '3.10.1-rc2']))
      .toBe('3.10.1-rc2')
  })

  it('creates inclusive calendar-day defaults without relying on UTC conversion', () => {
    expect(defaultDateRange(7, new Date(2026, 8, 14, 23, 30))).toEqual({
      dateFrom: '2026-09-08', dateTo: '2026-09-14'
    })
  })

  it('presents suite and RHODS build identifiers without exposing implementation labels', () => {
    expect(formatSuiteName('gitlab_mr-validation')).toBe('Gitlab Mr Validation')
    expect(formatBuildId('sha256:abcdef0123456789')).toBe('abcdef01')
    expect(formatBuildId('unknown')).toBe('Unknown')
    expect(formatBuildId(null)).toBe('Unknown')
  })

  it('distinguishes product failures from environment-aborted tests', () => {
    expect(displayedTestOutcome({ verdict: 'PASS' })).toBe('PASS')
    expect(displayedTestOutcome({ verdict: 'FAIL', productBugs: [{ category: 'PRODUCT_BUG' }] })).toBe('FAIL')
    expect(displayedTestOutcome({ verdict: 'ERROR', productBugs: [{ category: 'ENVIRONMENT' }] })).toBe('ABORT')
    expect(displayedOutcomeCounts([
      { verdict: 'PASS' },
      { verdict: 'FAIL', productBugs: [{ category: 'PRODUCT_BUG' }] },
      { verdict: 'FAIL', productBugs: [] }
    ])).toEqual({ pass: 1, fail: 1, aborted: 1 })
  })

  it('selects the highest numbered version before filtered data is requested', async () => {
    const wrapper = mount(FilterBar)
    await vi.waitFor(() => expect(filters.version).toBe('version 3.10.1-rc2'))

    await useWorkflowValidation().getOverview()

    expect(apiRequest).toHaveBeenCalledWith(expect.stringContaining('version=version+3.10.1-rc2'))
    wrapper.unmount()
  })
})
