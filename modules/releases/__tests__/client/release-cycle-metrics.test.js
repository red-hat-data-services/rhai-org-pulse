import { describe, expect, it } from 'vitest'
import {
  missingMilestoneLabel,
  visibleReleaseCyclePhases
} from '../../client/reports/release-cycle-metrics.js'

describe('release cycle metrics presentation', () => {
  it('omits phases that have no recorded milestone', () => {
    const phases = [
      { phase: 'RC1', build_ready_date: '2026-09-29', test_started_date: '2026-09-30' },
      { phase: 'RC2', build_ready_date: null, test_started_date: null, test_finished_date: null },
      { phase: 'Nightly', build_ready_date: null, test_started_date: '2026-09-20' }
    ]

    expect(visibleReleaseCyclePhases(phases).map(phase => phase.phase)).toEqual([
      'RC1',
      'Nightly'
    ])
  })

  it('describes incomplete milestones instead of rendering empty values', () => {
    const activePhase = { test_started_date: '2026-09-30' }
    const futurePhase = { test_started_date: null }
    const context = { tfaDone: 1, tfaTotal: 50, blockersOpen: 1 }

    expect(missingMilestoneLabel('build_received', activePhase, context)).toBe('Not recorded')
    expect(missingMilestoneLabel('test_started', futurePhase, context)).toBe('Not started')
    expect(missingMilestoneLabel('test_finished', activePhase, context)).toBe('In progress')
    expect(missingMilestoneLabel('tfas_passed', activePhase, context)).toBe('Pending')
    expect(missingMilestoneLabel('tfas_triaged', activePhase, context)).toBe('1 / 50 done')
    expect(missingMilestoneLabel('blockers_resolved', activePhase, context)).toBe('1 open')
    expect(missingMilestoneLabel('blockers_resolved', activePhase, { blockersOpen: 0 })).toBe('No open blockers')
  })
})
