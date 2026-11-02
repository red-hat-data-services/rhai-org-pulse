import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import {
  resolveSelectedRun,
  collectMatrixRowIds,
  cellDisplayStatus,
  statusColorClass,
  NIGHTLY_PAGE_SIZE
} from '../../client/composables/useNightlyHealthMatrix'

const fixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../fixtures/system-health/test-execution/nightly_health.json'
)

describe('useNightlyHealthMatrix helpers', () => {
  it('fixture resolves latest run per day', () => {
    const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'))
    const nov1 = fixture.days.find((d) => d.date === '2026-11-01')
    const { run, error } = resolveSelectedRun(nov1)
    expect(error).toBeNull()
    expect(run.run_id).toBe('example-job:102')
  })

  it('collects gate rows before component ids', () => {
    const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'))
    const ids = collectMatrixRowIds(fixture.days)
    expect(ids[0]).toBe('cluster-health')
    expect(ids[1]).toBe('operator-health')
    expect(ids).toContain('dashboard')
  })

  it('ignores non-array gates when collecting row ids', () => {
    const days = [{
      date: '2026-11-01',
      runs: [{ run_id: 'r1', gates: {}, components: [{ id: 'dashboard' }] }]
    }]
    expect(() => collectMatrixRowIds(days)).not.toThrow()
    expect(collectMatrixRowIds(days)).toEqual(['dashboard'])
  })

  it('prefers source_status for display', () => {
    expect(cellDisplayStatus({ source_status: 'NotInstalled', state: 'not_applicable' })).toBe('NotInstalled')
    expect(cellDisplayStatus({ state: 'ready' })).toBe('passed')
    expect(statusColorClass('passed')).toBe('green')
    expect(statusColorClass('NotInstalled')).toBe('muted')
    expect(statusColorClass('NotReady')).toBe('red')
    expect(statusColorClass('Not Ready')).toBe('red')
  })

  it('shows Blocked for readiness state even when source_status is failed', () => {
    expect(
      cellDisplayStatus({
        state: 'blocked',
        source_status: 'failed',
        reason_code: 'deployment_failed'
      })
    ).toBe('Blocked')
    expect(statusColorClass('blocked')).toBe('blocked')
  })

  it('uses five-day page size constant', () => {
    expect(NIGHTLY_PAGE_SIZE).toBe(5)
  })
})
