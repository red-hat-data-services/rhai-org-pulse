import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import {
  normalizeHeatmapComponentToNightlyId,
  lookupNightlyCell,
  isBlockedReadiness
} from '../../client/composables/useHeatmapNightlyOverlay'

const nightlyPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../fixtures/system-health/test-execution/nightly_health.json'
)

describe('useHeatmapNightlyOverlay', () => {
  const nightly = JSON.parse(readFileSync(nightlyPath, 'utf8'))

  it('normalizes heatmap component names to nightly ids', () => {
    expect(normalizeHeatmapComponentToNightlyId('Dashboard')).toBe('dashboard')
    expect(normalizeHeatmapComponentToNightlyId('AI Gateway')).toBe('aigateway')
    expect(normalizeHeatmapComponentToNightlyId('RHOAI Deployment')).toBe('operator-health')
  })

  it('resolves producer-selected run cell for date', () => {
    const hit = lookupNightlyCell(nightly, '2026-11-01', 'Dashboard')
    expect(hit?.run.run_id).toBe('example-job:102')
    expect(isBlockedReadiness(hit?.cell)).toBe(true)
  })

  it('returns deployment gate for RHOAI Deployment row', () => {
    const hit = lookupNightlyCell(nightly, '2026-11-01', 'RHOAI Deployment')
    expect(hit?.cell.id).toBe('operator-health')
    expect(hit?.cell.source_status).toBe('passed')
  })
})
