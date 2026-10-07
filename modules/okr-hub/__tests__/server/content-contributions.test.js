import { describe, expect, it } from 'vitest'
import okrHubRoutes from '../../server/index.js'

describe('content contributions fallback', function() {
  it('returns the updated Q3 2026 completion snapshot', function() {
    var data = okrHubRoutes.getSampleContentData()
    var q3 = data.quarters.find(function(quarter) { return quarter.label === 'Q3 2026' })

    expect(data.quarters.map(function(quarter) { return quarter.targetDate })).toEqual([
      '12/31/2026',
      '12/31/2026',
      '12/31/2026'
    ])
    expect(q3.total).toEqual({ associates: 531, completed: 154, pct: 29, performance: 'Behind (21% to go)', endQPct: 29 })
    expect(data.overall).toEqual({ associates: 531, completed: 154, pct: 29 })
    expect(q3.teams.map(function(team) {
      return {
        name: team.name,
        associates: team.associates,
        completed: team.completed,
        pct: team.pct,
        performance: team.performance
      }
    })).toEqual([
      { name: "Steven's Directs", associates: 14, completed: 1, pct: 7, performance: 'Behind (43% to go)' },
      { name: 'Cat Agentics & AI Eng Tooling', associates: 58, completed: 30, pct: 52, performance: 'On Track' },
      { name: 'Sherard AI Platform', associates: 192, completed: 40, pct: 21, performance: 'Behind (29% to go)' },
      { name: 'Taneem Inf Engineering', associates: 59, completed: 27, pct: 45, performance: 'Behind (5% to go)' },
      { name: 'Kai AI Innovation', associates: 13, completed: 2, pct: 15, performance: 'Behind (35% to go)' },
      { name: 'Tom AIPCC', associates: 147, completed: 32, pct: 22, performance: 'Behind (28% to go)' },
      { name: 'Monica watsonx', associates: 48, completed: 22, pct: 46, performance: 'Behind (4% to go)' }
    ])
  })
})

describe('technical visibility fallback', function() {
  it('includes the September 25 Q3 entry', function() {
    var data = okrHubRoutes.getSampleTechVisData()
    var q3 = data.quarters.find(function(quarter) { return quarter.label === 'Q3 2026' })

    expect(q3.weeks.at(-1)).toEqual({ weekOf: '2026-09-25', count: 0, met: false })
    expect(q3).toMatchObject({ weeksMet: 2, totalWeeks: 12, pct: 17 })
    expect(data.overall).toEqual({ weeksMet: 9, totalWeeks: 37, pct: 24 })
  })
})
