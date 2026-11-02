import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

vi.mock('@shared/client/services/api', () => ({
  apiRequest: vi.fn()
}))

import { apiRequest } from '@shared/client/services/api'
import { useTestDashboard } from '../../client/composables/useTestDashboard.js'

const fixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../fixtures/system-health/test-execution/nightly_health.json'
)

describe('useTestDashboard', () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockReset()
  })

  it('loadData exposes nightly-only dashboard data without heatmap', async () => {
    const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'))
    vi.mocked(apiRequest).mockResolvedValue({
      heatmap: null,
      components: null,
      jira_config: null,
      meta: null,
      nightly_health: fixture,
      lastUpload: null
    })

    const dashboard = useTestDashboard()
    await dashboard.loadData()

    expect(dashboard.hasHeatmapData.value).toBe(false)
    expect(dashboard.hasNightlyData.value).toBe(true)
    expect(dashboard.nightlyHealth.value?.days).toHaveLength(fixture.days.length)
    expect(dashboard.heatmap.value).toEqual([])
    expect(apiRequest).toHaveBeenCalledWith('/modules/system-health/quality/test-execution/data')
  })

  it('loadData clears nightly when API returns invalid nightly_health shape', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      heatmap: [],
      nightly_health: { schema_version: 2, days: [{ date: '2026-11-01', runs: [] }] },
      jira_config: null,
      meta: null,
      lastUpload: null
    })

    const dashboard = useTestDashboard()
    await dashboard.loadData()

    expect(dashboard.nightlyHealth.value).toBeNull()
    expect(dashboard.hasNightlyData.value).toBe(false)
  })

  it('loadData records error and clears nightly on failure', async () => {
    vi.mocked(apiRequest).mockRejectedValue(new Error('network down'))

    const dashboard = useTestDashboard()
    await dashboard.loadData()

    expect(dashboard.error.value).toMatch(/network down/)
    expect(dashboard.nightlyHealth.value).toBeNull()
  })
})
