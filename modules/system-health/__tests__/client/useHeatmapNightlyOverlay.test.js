import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import {
  normalizeHeatmapComponentToNightlyId,
  resolveHeatmapComponentToRowId,
  lookupNightlyCell,
  isBlockedReadiness,
  useHeatmapNightlyOverlay
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
    const days = nightly.days
    expect(resolveHeatmapComponentToRowId('Dashboard', days)).toBe('dashboard')
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

  it('resolves Training and Training Kubeflow to the selected-run trainer cell (MR !5 labels)', () => {
    const payload = {
      schema_version: 1,
      days: [
        {
          date: '2026-11-03',
          latest_run_id: 'pg:99',
          runs: [
            {
              run_id: 'pg:98',
              components: [
                {
                  id: 'trainer',
                  name: 'Training',
                  jira_component: 'Training Kubeflow',
                  source_status: 'passed',
                  state: 'ready'
                }
              ]
            },
            {
              run_id: 'pg:99',
              components: [
                {
                  id: 'trainer',
                  name: 'Training',
                  jira_component: 'Training Kubeflow',
                  source_status: 'failed',
                  state: 'failed',
                  reason_code: 'tests_failed'
                }
              ]
            }
          ]
        }
      ]
    }
    const fromCanonical = lookupNightlyCell(payload, '2026-11-03', 'Training')
    const fromJira = lookupNightlyCell(payload, '2026-11-03', 'Training Kubeflow')
    expect(fromCanonical?.run.run_id).toBe('pg:99')
    expect(fromJira?.run.run_id).toBe('pg:99')
    expect(fromCanonical?.cell.id).toBe('trainer')
    expect(fromJira?.cell.id).toBe('trainer')
    expect(fromCanonical?.cell.source_status).toBe('failed')
    expect(isBlockedReadiness(fromCanonical?.cell)).toBe(false)

    const { overlayFor } = useHeatmapNightlyOverlay(payload)
    expect(overlayFor('Training', '2026-11-03')?.cell.source_status).toBe('failed')
    expect(overlayFor('Training Kubeflow', '2026-11-03')?.cell.id).toBe('trainer')
  })

  it('uses selected-run id when canonical name moved from trainer to trainingoperator', () => {
    const payload = {
      schema_version: 1,
      days: [
        {
          date: '2026-11-01',
          latest_run_id: 'pg:1',
          runs: [
            {
              run_id: 'pg:1',
              components: [
                {
                  id: 'trainer',
                  name: 'Training',
                  jira_component: 'Training Kubeflow',
                  source_status: 'passed',
                  state: 'ready'
                }
              ]
            }
          ]
        },
        {
          date: '2026-11-02',
          latest_run_id: 'pg:2',
          runs: [
            {
              run_id: 'pg:2',
              components: [
                {
                  id: 'trainingoperator',
                  name: 'Training',
                  jira_component: 'Training Kubeflow',
                  source_status: 'passed',
                  state: 'ready'
                }
              ]
            }
          ]
        }
      ]
    }
    expect(lookupNightlyCell(payload, '2026-11-01', 'Training Kubeflow')?.cell.id).toBe('trainer')
    expect(lookupNightlyCell(payload, '2026-11-02', 'Training')?.cell.id).toBe('trainingoperator')
  })
})
