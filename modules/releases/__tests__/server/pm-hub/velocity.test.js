import { describe, it, expect } from 'vitest'

const { computeVelocity } = require('../../../server/pm-hub/routes')

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

function makeRawIssue(key, fixVersionNames, componentNames, status, resolutiondate) {
  return {
    key: key,
    fields: {
      summary: 'Feature ' + key,
      status: { name: status || 'Closed', statusCategory: { name: 'Done' } },
      components: (componentNames || ['Dashboard']).map(function (c) { return { name: c } }),
      fixVersions: fixVersionNames.map(function (v) { return { name: v } }),
      resolutiondate: resolutiondate || '2025-06-01T00:00:00.000+0000'
    }
  }
}

// Fixed "now" for deterministic age calculations (1 year after default resolution date)
var NOW = '2026-06-01T00:00:00.000Z'

// ---------------------------------------------------------------------------
// computeVelocity
// ---------------------------------------------------------------------------

describe('computeVelocity', function () {
  it('returns dash when no issues are provided', function () {
    var result = computeVelocity([], '', NOW)
    expect(result.avgPerRelease).toBe('—')
    expect(result.totalResolved).toBe(0)
    expect(result.components).toHaveLength(0)
    expect(result.hasPartialYear).toBe(false)
  })

  it('computes velocity for a single component', function () {
    var issues = [
      makeRawIssue('RHAISTRAT-1', ['rhoai-3.4'], ['Dashboard']),
      makeRawIssue('RHAISTRAT-2', ['rhoai-3.4'], ['Dashboard']),
      makeRawIssue('RHAISTRAT-3', ['rhoai-3.5'], ['Dashboard'])
    ]
    var result = computeVelocity(issues, '', NOW)
    // 3 features across 2 releases = 1.5
    expect(result.avgPerRelease).toBe('1.5')
    expect(result.totalResolved).toBe(3)
    expect(result.components).toHaveLength(1)
    expect(result.components[0].component).toBe('Dashboard')
    expect(result.components[0].resolved).toBe(3)
    expect(result.components[0].releases).toBe(2)
    expect(result.components[0].avgPerRelease).toBe('1.5')
    expect(result.components[0].isPartialYear).toBe(false)
  })

  it('computes weighted average across multiple components', function () {
    // Component A: 6 features across 2 releases = 3.0 per release
    // Component B: 2 features across 2 releases = 1.0 per release
    // Both full-year, so weighted avg = (3.0*6 + 1.0*2) / (6+2) = 20/8 = 2.5
    var issues = [
      makeRawIssue('RHAISTRAT-1', ['rhoai-3.4'], ['CompA']),
      makeRawIssue('RHAISTRAT-2', ['rhoai-3.4'], ['CompA']),
      makeRawIssue('RHAISTRAT-3', ['rhoai-3.4'], ['CompA']),
      makeRawIssue('RHAISTRAT-4', ['rhoai-3.5'], ['CompA']),
      makeRawIssue('RHAISTRAT-5', ['rhoai-3.5'], ['CompA']),
      makeRawIssue('RHAISTRAT-6', ['rhoai-3.5'], ['CompA']),
      makeRawIssue('RHAISTRAT-7', ['rhoai-3.4'], ['CompB']),
      makeRawIssue('RHAISTRAT-8', ['rhoai-3.5'], ['CompB'])
    ]
    var result = computeVelocity(issues, '', NOW)
    expect(result.avgPerRelease).toBe('2.5')
    expect(result.totalResolved).toBe(8)
    expect(result.components).toHaveLength(2)
    expect(result.hasPartialYear).toBe(false)
  })

  it('weights busier components more heavily', function () {
    // CompA: 10 features / 1 release = 10.0 per release
    // CompB: 1 feature / 1 release = 1.0 per release
    // Weighted avg = (10*10 + 1*1) / (10+1) = 101/11 ≈ 9.2
    var issues = []
    for (var i = 1; i <= 10; i++) {
      issues.push(makeRawIssue('A-' + i, ['rhoai-3.5'], ['CompA']))
    }
    issues.push(makeRawIssue('B-1', ['rhoai-3.5'], ['CompB']))
    var result = computeVelocity(issues, '', NOW)
    expect(result.avgPerRelease).toBe('9.2')
  })

  it('returns whole number when evenly divisible', function () {
    var issues = [
      makeRawIssue('RHAISTRAT-1', ['rhoai-3.4'], ['Dash']),
      makeRawIssue('RHAISTRAT-2', ['rhoai-3.4'], ['Dash']),
      makeRawIssue('RHAISTRAT-3', ['rhoai-3.5'], ['Dash']),
      makeRawIssue('RHAISTRAT-4', ['rhoai-3.5'], ['Dash'])
    ]
    var result = computeVelocity(issues, '', NOW)
    expect(result.avgPerRelease).toBe('2')
  })

  it('deduplicates issues by key within a component', function () {
    var issues = [
      makeRawIssue('RHAISTRAT-1', ['rhoai-3.4'], ['Dash']),
      makeRawIssue('RHAISTRAT-1', ['rhoai-3.4'], ['Dash']),
      makeRawIssue('RHAISTRAT-2', ['rhoai-3.4'], ['Dash'])
    ]
    var result = computeVelocity(issues, '', NOW)
    expect(result.totalResolved).toBe(2)
    expect(result.components[0].resolved).toBe(2)
  })

  it('assigns issue to multiple components when it belongs to several', function () {
    var issues = [
      makeRawIssue('RHAISTRAT-1', ['rhoai-3.5'], ['CompA', 'CompB'])
    ]
    var result = computeVelocity(issues, '', NOW)
    // Issue counted in both components
    expect(result.components).toHaveLength(2)
    expect(result.components.find(function (c) { return c.component === 'CompA' }).resolved).toBe(1)
    expect(result.components.find(function (c) { return c.component === 'CompB' }).resolved).toBe(1)
  })

  it('includes a JQL verification URL', function () {
    var result = computeVelocity([], 'component IN ("Dashboard")', NOW)
    expect(result.jql).toContain('issues/?jql=')
    expect(result.jql).toContain(encodeURIComponent('statusCategory = Done'))
    expect(result.jql).toContain(encodeURIComponent('component IN ("Dashboard")'))
  })

  it('builds JQL without component clause when empty', function () {
    var result = computeVelocity([], '', NOW)
    expect(result.jql).not.toContain(encodeURIComponent('component'))
  })

  it('skips issues with missing fixVersions field', function () {
    var issues = [
      { key: 'RHAISTRAT-1', fields: { summary: 'Test', components: [{ name: 'Dash' }], fixVersions: null } },
      makeRawIssue('RHAISTRAT-2', ['rhoai-3.5'], ['Dash'])
    ]
    var result = computeVelocity(issues, '', NOW)
    // Issue 1 skipped (no fixVersions), issue 2 counted
    expect(result.components).toHaveLength(1)
    expect(result.components[0].resolved).toBe(1)
  })

  it('returns per-component breakdown with avgPerRelease', function () {
    var issues = [
      makeRawIssue('S-1', ['v1'], ['Serving']),
      makeRawIssue('S-2', ['v1'], ['Serving']),
      makeRawIssue('S-3', ['v2'], ['Serving']),
      makeRawIssue('T-1', ['v1'], ['Training']),
      makeRawIssue('T-2', ['v2'], ['Training']),
      makeRawIssue('T-3', ['v3'], ['Training'])
    ]
    var result = computeVelocity(issues, '', NOW)
    var serving = result.components.find(function (c) { return c.component === 'Serving' })
    var training = result.components.find(function (c) { return c.component === 'Training' })

    // Serving: 3 features / 2 releases = 1.5
    expect(serving.avgPerRelease).toBe('1.5')
    // Training: 3 features / 3 releases = 1.0
    expect(training.avgPerRelease).toBe('1')
    // Weighted: (1.5*3 + 1.0*3) / (3+3) = 7.5/6 = 1.3
    expect(result.avgPerRelease).toBe('1.3')
  })

  // --- Team age / partial-year tests ---

  it('marks partial-year components with isPartialYear flag', function () {
    // NOW=2026-06-01, resolved 2025-12-01 → 182 days = 26 weeks
    var issues = [
      makeRawIssue('NEW-1', ['v1'], ['NewTeam'], null, '2025-12-01T00:00:00.000Z')
    ]
    var result = computeVelocity(issues, '', NOW)
    expect(result.components[0].isPartialYear).toBe(true)
    expect(result.components[0].activeWeeks).toBe(26)
    expect(result.hasPartialYear).toBe(true)
  })

  it('does not mark full-year components as partial', function () {
    // Default resolution date is 2025-06-01 → 52 weeks before NOW
    var issues = [
      makeRawIssue('OLD-1', ['v1'], ['MatureTeam'])
    ]
    var result = computeVelocity(issues, '', NOW)
    expect(result.components[0].isPartialYear).toBe(false)
    expect(result.hasPartialYear).toBe(false)
  })

  it('reduces partial-year component weight in aggregate average', function () {
    // MatureTeam: 4 features / 2 releases = 2.0/rel, full year (ageFactor=1)
    // NewTeam: 2 features / 1 release = 2.0/rel, 26 weeks (ageFactor=26/52=0.5)
    //
    // Without age scaling: (2.0*4 + 2.0*2) / (4+2) = 12/6 = 2.0
    // With age scaling:    (2.0*4*1 + 2.0*2*0.5) / (4*1 + 2*0.5) = (8+2)/(4+1) = 10/5 = 2.0
    // Same in this case because velocities are equal — but the weight changed
    var issues = [
      makeRawIssue('M-1', ['v1'], ['MatureTeam']),
      makeRawIssue('M-2', ['v1'], ['MatureTeam']),
      makeRawIssue('M-3', ['v2'], ['MatureTeam']),
      makeRawIssue('M-4', ['v2'], ['MatureTeam']),
      makeRawIssue('N-1', ['v1'], ['NewTeam'], null, '2025-12-01T00:00:00.000Z'),
      makeRawIssue('N-2', ['v1'], ['NewTeam'], null, '2025-12-01T00:00:00.000Z')
    ]
    var result = computeVelocity(issues, '', NOW)
    expect(result.hasPartialYear).toBe(true)
    // Both have 2.0 velocity, so aggregate is still 2.0 regardless of weighting
    expect(result.avgPerRelease).toBe('2')
  })

  it('partial-year team with different velocity shifts aggregate', function () {
    // MatureTeam: 2 features / 2 releases = 1.0/rel, full year (ageFactor=1)
    // NewTeam: 10 features / 1 release = 10.0/rel, 13 weeks (ageFactor=13/52=0.25)
    // NOW=2026-06-01, 13 weeks back = 2026-03-02 (91 days)
    //
    // Without age scaling: (1.0*2 + 10.0*10) / (2+10) = 102/12 = 8.5
    // With age scaling:    (1.0*2*1 + 10.0*10*0.25) / (2*1 + 10*0.25) = (2+25)/(2+2.5) = 27/4.5 = 6.0
    var issues = [
      makeRawIssue('M-1', ['v1'], ['MatureTeam']),
      makeRawIssue('M-2', ['v2'], ['MatureTeam'])
    ]
    for (var i = 1; i <= 10; i++) {
      issues.push(makeRawIssue('N-' + i, ['v1'], ['NewTeam'], null, '2026-03-02T00:00:00.000Z'))
    }
    var result = computeVelocity(issues, '', NOW)
    expect(result.hasPartialYear).toBe(true)
    expect(result.avgPerRelease).toBe('6')
  })

  it('uses earliest resolution date to determine team age', function () {
    // NOW=2026-06-01, early=2025-08-25 (280 days=40 weeks), late=2026-03-23 (70 days=10 weeks)
    var issues = [
      makeRawIssue('T-1', ['v1'], ['Team'], null, '2026-03-23T00:00:00.000Z'),
      makeRawIssue('T-2', ['v1'], ['Team'], null, '2025-08-25T00:00:00.000Z')
    ]
    var result = computeVelocity(issues, '', NOW)
    expect(result.components[0].activeWeeks).toBe(40)
    expect(result.components[0].isPartialYear).toBe(true)
  })

  // --- Edge cases ---

  it('falls back to "No Component" when components array is empty', function () {
    var issues = [
      { key: 'X-1', fields: { summary: 'Test', components: [], fixVersions: [{ name: 'v1' }], resolutiondate: '2025-06-01T00:00:00.000Z' } }
    ]
    var result = computeVelocity(issues, '', NOW)
    expect(result.components).toHaveLength(1)
    expect(result.components[0].component).toBe('No Component')
    expect(result.components[0].resolved).toBe(1)
  })

  it('defaults to full-year activeWeeks when resolutiondate is missing', function () {
    var issues = [
      { key: 'X-1', fields: { summary: 'Test', components: [{ name: 'Team' }], fixVersions: [{ name: 'v1' }] } }
    ]
    var result = computeVelocity(issues, '', NOW)
    expect(result.components[0].activeWeeks).toBe(52)
    expect(result.components[0].isPartialYear).toBe(false)
    expect(result.hasPartialYear).toBe(false)
  })

  it('treats invalid resolutiondate as missing (defaults to full year)', function () {
    var issues = [
      { key: 'X-1', fields: { summary: 'Test', components: [{ name: 'Team' }], fixVersions: [{ name: 'v1' }], resolutiondate: 'not-a-date' } }
    ]
    var result = computeVelocity(issues, '', NOW)
    expect(result.components[0].activeWeeks).toBe(52)
    expect(result.components[0].isPartialYear).toBe(false)
  })

  it('skips components with null name in array', function () {
    var issues = [
      { key: 'X-1', fields: { summary: 'Test', components: [{ name: null }, { name: 'Real' }], fixVersions: [{ name: 'v1' }], resolutiondate: '2025-06-01T00:00:00.000Z' } }
    ]
    var result = computeVelocity(issues, '', NOW)
    expect(result.components).toHaveLength(1)
    expect(result.components[0].component).toBe('Real')
  })

  it('skips fixVersions entries with null name', function () {
    var issues = [
      makeRawIssue('X-1', ['v1'], ['Team']),
      { key: 'X-2', fields: { summary: 'Test', components: [{ name: 'Team' }], fixVersions: [{ name: null }, { name: 'v1' }], resolutiondate: '2025-06-01T00:00:00.000Z' } }
    ]
    var result = computeVelocity(issues, '', NOW)
    // Both issues land in v1 for Team, null version name is ignored
    expect(result.components[0].releases).toBe(1)
    expect(result.components[0].resolved).toBe(2)
  })

  it('handles empty fixVersions array (valid array, zero entries)', function () {
    var issues = [
      { key: 'X-1', fields: { summary: 'Test', components: [{ name: 'Team' }], fixVersions: [], resolutiondate: '2025-06-01T00:00:00.000Z' } },
      makeRawIssue('X-2', ['v1'], ['Team'])
    ]
    var result = computeVelocity(issues, '', NOW)
    // X-1 has fixVersions=[] — it passes the Array.isArray check but adds no versions
    // X-1 is still counted as resolved (seen), just with 0 version entries
    expect(result.components[0].resolved).toBe(2)
    expect(result.components[0].releases).toBe(1)
  })

  it('handles all components being partial-year', function () {
    // CompA: 3 features / 1 release = 3.0/rel, 26 weeks (ageFactor=0.5)
    // CompB: 1 feature / 1 release = 1.0/rel, 26 weeks (ageFactor=0.5)
    // Both partial → weighted avg = (3.0*3*0.5 + 1.0*1*0.5) / (3*0.5 + 1*0.5) = (4.5+0.5)/2 = 5/2 = 2.5
    var issues = [
      makeRawIssue('A-1', ['v1'], ['CompA'], null, '2025-12-01T00:00:00.000Z'),
      makeRawIssue('A-2', ['v1'], ['CompA'], null, '2025-12-01T00:00:00.000Z'),
      makeRawIssue('A-3', ['v1'], ['CompA'], null, '2025-12-01T00:00:00.000Z'),
      makeRawIssue('B-1', ['v1'], ['CompB'], null, '2025-12-01T00:00:00.000Z')
    ]
    var result = computeVelocity(issues, '', NOW)
    expect(result.hasPartialYear).toBe(true)
    expect(result.avgPerRelease).toBe('2.5')
    expect(result.components[0].isPartialYear).toBe(true)
    expect(result.components[1].isPartialYear).toBe(true)
  })

  it('rounds formatAvg to one decimal place', function () {
    // 1 feature / 3 releases = 0.333... → '0.3'
    var issues = [
      makeRawIssue('X-1', ['v1', 'v2', 'v3'], ['Team'])
    ]
    var result = computeVelocity(issues, '', NOW)
    expect(result.components[0].avgPerRelease).toBe('0.3')
    expect(result.avgPerRelease).toBe('0.3')
  })

  // --- selectedComponents filtering ---

  it('filters to only selected components, ignoring phantom components', function () {
    // Issue belongs to CompA + CompB + CompC, but only CompA and CompB are selected
    var issues = [
      makeRawIssue('X-1', ['v1'], ['CompA', 'CompB', 'CompC']),
      makeRawIssue('X-2', ['v1'], ['CompA']),
      makeRawIssue('X-3', ['v1'], ['CompC'])
    ]
    var result = computeVelocity(issues, '', NOW, ['CompA', 'CompB'])
    // CompC should be excluded entirely
    expect(result.components).toHaveLength(2)
    var names = result.components.map(function (c) { return c.component })
    expect(names).toContain('CompA')
    expect(names).toContain('CompB')
    expect(names).not.toContain('CompC')
  })

  it('includes all components when selectedComponents is not provided', function () {
    var issues = [
      makeRawIssue('X-1', ['v1'], ['CompA', 'CompB'])
    ]
    var result = computeVelocity(issues, '', NOW)
    expect(result.components).toHaveLength(2)
  })

  it('weighted average is bounded by component velocities when filtered', function () {
    // CompA: 3 features / 1 release = 3.0
    // CompB: 1 feature / 1 release = 1.0
    // CompC (phantom): 5 features / 1 release — should be excluded
    var issues = [
      makeRawIssue('A-1', ['v1'], ['CompA']),
      makeRawIssue('A-2', ['v1'], ['CompA']),
      makeRawIssue('A-3', ['v1'], ['CompA']),
      makeRawIssue('B-1', ['v1'], ['CompB']),
      makeRawIssue('C-1', ['v1'], ['CompA', 'CompC']),
      makeRawIssue('C-2', ['v1'], ['CompC']),
      makeRawIssue('C-3', ['v1'], ['CompC']),
      makeRawIssue('C-4', ['v1'], ['CompC']),
      makeRawIssue('C-5', ['v1'], ['CompC'])
    ]
    // Without filter: CompC would inflate the average
    var unfiltered = computeVelocity(issues, '', NOW)
    expect(unfiltered.components).toHaveLength(3)

    // With filter: only CompA (4 features incl C-1) and CompB
    var filtered = computeVelocity(issues, '', NOW, ['CompA', 'CompB'])
    expect(filtered.components).toHaveLength(2)
    var compA = filtered.components.find(function (c) { return c.component === 'CompA' })
    var compB = filtered.components.find(function (c) { return c.component === 'CompB' })
    // CompA gets C-1 (has CompA component), so 4 features / 1 release = 4.0
    expect(compA.resolved).toBe(4)
    expect(compB.resolved).toBe(1)
    // Weighted avg = (4.0*4 + 1.0*1) / (4+1) = 17/5 = 3.4
    expect(filtered.avgPerRelease).toBe('3.4')
  })
})
