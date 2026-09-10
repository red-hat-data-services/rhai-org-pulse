import { describe, expect, it } from 'vitest'
import {
  getRequiredOpenTasks,
  releaseDisplayStatus
} from '../../client/reports/release-readiness-status'

function releaseData(status, tasks) {
  return {
    release_schedule: { status },
    breakdowns: {
      initiative: {
        test_execution: {
          phases: [{ epic_key: 'phase-1', tasks }]
        }
      }
    }
  }
}

describe('release readiness display status', () => {
  it('flags released releases with unfinished tasks', () => {
    const data = releaseData('Released', [
      { key: 'RHOAIENG-1', status_category: 'Done', resolution: 'Done' },
      { key: 'RHOAIENG-2', status_category: 'In Progress', resolution: null }
    ])

    expect(getRequiredOpenTasks(data)).toHaveLength(1)
    expect(releaseDisplayStatus(data)).toBe('Released with Open Tasks')
  })

  it('treats no-work resolutions as unfinished work', () => {
    const data = releaseData('GA', [
      { key: 'RHOAIENG-1', status_category: 'Done', resolution: "Won't Do" }
    ])

    expect(releaseDisplayStatus(data)).toBe('Released with Open Tasks')
  })

  it('keeps normal released status when all tasks are complete', () => {
    const data = releaseData('Released', [
      { key: 'RHOAIENG-1', status_category: 'Done', resolution: 'Done' }
    ])

    expect(releaseDisplayStatus(data)).toBe('Released')
  })

  it('does not flag unfinished tasks before release', () => {
    const data = releaseData('Planning', [
      { key: 'RHOAIENG-1', status_category: 'In Progress', resolution: null }
    ])

    expect(releaseDisplayStatus(data)).toBe('Planning')
  })

  it('deduplicates tasks repeated across breakdowns', () => {
    const data = releaseData('Released', [
      { key: 'RHOAIENG-1', status_category: 'Open', resolution: null }
    ])
    data.breakdowns.other = data.breakdowns.initiative

    expect(getRequiredOpenTasks(data)).toHaveLength(1)
  })
})
