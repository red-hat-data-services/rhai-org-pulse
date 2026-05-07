import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  exportHealthMarkdown,
  exportHealthCsv,
  computePhaseSummary,
  normalizeComponents,
  riskLabel
} from '../health-export'

// ─── Mock DOM APIs ───

var capturedContent = null
var capturedFilename = null

beforeEach(function() {
  capturedContent = null
  capturedFilename = null

  // Mock Blob
  globalThis.Blob = vi.fn(function(parts, options) {
    this.content = parts.join('')
    this.type = options ? options.type : ''
  })

  // Mock URL
  globalThis.URL.createObjectURL = vi.fn(function() { return 'blob:mock-url' })
  globalThis.URL.revokeObjectURL = vi.fn()

  // Mock document.createElement
  vi.spyOn(document, 'createElement').mockImplementation(function(tag) {
    if (tag === 'a') {
      return {
        href: '',
        download: '',
        click: vi.fn(function() {
          capturedFilename = this.download
          // Extract content from the most recent Blob call
          var blobCalls = globalThis.Blob.mock.calls
          if (blobCalls.length > 0) {
            capturedContent = blobCalls[blobCalls.length - 1][0].join('')
          }
        })
      }
    }
    return document.createElement.call(document, tag)
  })
})

// ─── Test fixtures ───

function makeFeature(overrides) {
  return Object.assign({
    key: 'RHOAIENG-1001',
    summary: 'Test feature',
    status: 'In Progress',
    priority: 'Major',
    phase: 'GA',
    bigRock: 'Test Rock',
    tier: 1,
    pm: 'Test PM',
    deliveryOwner: 'Test Owner',
    components: 'Model Serving',
    completionPct: 75,
    epicCount: 4,
    issueCount: 28,
    blockerCount: 0,
    fixVersions: '3.5-GA',
    targetRelease: 'RHOAI 3.5',
    priorityScore: 85,
    risk: {
      level: 'green',
      score: 0,
      flags: [],
      override: null
    },
    dor: {
      checkedCount: 12,
      totalCount: 13,
      completionPct: 92
    },
    rice: { score: 675 }
  }, overrides)
}

function makeRedFeature() {
  return makeFeature({
    key: 'RHOAIENG-1003',
    summary: 'Red feature with flags',
    status: 'New',
    blockerCount: 2,
    priorityScore: 30,
    risk: {
      level: 'red',
      score: 3,
      flags: [
        { category: 'BLOCKED', severity: 'high', message: '2 active blockers on this feature' },
        { category: 'UNESTIMATED', severity: 'medium', message: 'No story points or t-shirt size assigned' }
      ],
      override: null
    },
    dor: {
      checkedCount: 4,
      totalCount: 13,
      completionPct: 31
    },
    rice: null
  })
}

function makeOverriddenFeature() {
  return makeFeature({
    key: 'RHOAIENG-1008',
    summary: 'Overridden feature',
    risk: {
      level: 'red',
      score: 2,
      flags: [
        { category: 'DOR_INCOMPLETE', severity: 'high', message: 'DoR at 38%' }
      ],
      override: { riskOverride: 'yellow', reason: 'Team confirmed design is complete', updatedBy: 'admin@redhat.com', updatedAt: '2026-04-24T09:15:00.000Z' }
    },
    dor: {
      checkedCount: 5,
      totalCount: 13,
      completionPct: 38
    },
    rice: { score: 270 }
  })
}

// ─── normalizeComponents ───

describe('normalizeComponents', function() {
  it('joins array input into comma-separated string', function() {
    expect(normalizeComponents(['Model Serving', 'Dashboard'])).toBe('Model Serving, Dashboard')
  })

  it('returns single-element array as string', function() {
    expect(normalizeComponents(['Model Serving'])).toBe('Model Serving')
  })

  it('returns string input as-is', function() {
    expect(normalizeComponents('Model Serving')).toBe('Model Serving')
  })

  it('returns empty string for null', function() {
    expect(normalizeComponents(null)).toBe('')
  })

  it('returns empty string for undefined', function() {
    expect(normalizeComponents(undefined)).toBe('')
  })

  it('returns empty string for empty string', function() {
    expect(normalizeComponents('')).toBe('')
  })

  it('returns empty string for empty array', function() {
    expect(normalizeComponents([])).toBe('')
  })
})

// ─── riskLabel ───

describe('riskLabel', function() {
  it('returns override risk level when override exists', function() {
    var f = makeOverriddenFeature()
    expect(riskLabel(f)).toBe('yellow')
  })

  it('returns computed risk level when no override', function() {
    var f = makeFeature({ risk: { level: 'red', score: 2, flags: [], override: null } })
    expect(riskLabel(f)).toBe('red')
  })

  it('returns green when risk is null', function() {
    var f = makeFeature({ risk: null })
    expect(riskLabel(f)).toBe('green')
  })

  it('returns green when risk is undefined / missing', function() {
    var f = { key: 'TEST-1', summary: 'No risk' }
    expect(riskLabel(f)).toBe('green')
  })

  it('returns green when risk has no level', function() {
    var f = makeFeature({ risk: { flags: [], override: null } })
    expect(riskLabel(f)).toBe('green')
  })
})

// ─── computePhaseSummary ───

describe('computePhaseSummary', function() {
  it('computes correct stats from features array', function() {
    var features = [
      makeFeature(),
      makeRedFeature(),
      makeOverriddenFeature()
    ]
    var summary = computePhaseSummary(features)

    expect(summary.totalFeatures).toBe(3)
    expect(summary.byRisk.green).toBe(1)
    expect(summary.byRisk.yellow).toBe(1) // overridden from red to yellow
    expect(summary.byRisk.red).toBe(1)
    expect(summary.dorCompletionRate).toBe(54) // Math.round((92 + 31 + 38) / 3)
    expect(summary.averageRiceScore).toBe(473) // Math.round((675 + 270) / 2) -- rice null skipped
    expect(summary.blockedCount).toBe(1) // red feature has blockerCount: 2
    expect(summary.unestimatedCount).toBe(1) // only red feature has UNESTIMATED flag
  })

  it('returns zeros for empty features array', function() {
    var summary = computePhaseSummary([])
    expect(summary.totalFeatures).toBe(0)
    expect(summary.byRisk.green).toBe(0)
    expect(summary.byRisk.yellow).toBe(0)
    expect(summary.byRisk.red).toBe(0)
    expect(summary.dorCompletionRate).toBe(0)
    expect(summary.averageRiceScore).toBe(0)
    expect(summary.blockedCount).toBe(0)
    expect(summary.unestimatedCount).toBe(0)
  })

  it('handles feature with rice null', function() {
    var features = [makeFeature({ rice: null })]
    var summary = computePhaseSummary(features)
    expect(summary.averageRiceScore).toBe(0)
  })

  it('handles feature with risk null', function() {
    var features = [makeFeature({ risk: null })]
    var summary = computePhaseSummary(features)
    expect(summary.byRisk.green).toBe(1) // defaults to green
    expect(summary.unestimatedCount).toBe(0)
  })

  it('handles feature with dor null', function() {
    var features = [makeFeature({ dor: null })]
    var summary = computePhaseSummary(features)
    expect(summary.dorCompletionRate).toBe(0)
  })
})

// ─── exportHealthCsv ───

describe('exportHealthCsv', function() {
  it('produces correct header row and data rows', function() {
    var features = [makeFeature(), makeRedFeature()]
    exportHealthCsv({
      version: '3.5',
      phase: 'GA',
      features: features,
      cachedAt: '2026-04-25T14:30:00.000Z'
    })

    expect(capturedContent).toBeTruthy()
    var lines = capturedContent.trim().split('\n')

    // Header row
    expect(lines[0]).toContain('Feature')
    expect(lines[0]).toContain('Summary')
    expect(lines[0]).toContain('Risk')
    expect(lines[0]).toContain('RICE Score')
    expect(lines[0]).toContain('Risk Flags')

    // Summary row (second line)
    expect(lines[1]).toContain('SUMMARY')
    expect(lines[1]).toContain('Total: 2 features')

    // Data rows (third and fourth lines)
    expect(lines[2]).toContain('RHOAIENG-1001')
    expect(lines[2]).toContain('green')
    expect(lines[2]).toContain('675')

    expect(lines[3]).toContain('RHOAIENG-1003')
    expect(lines[3]).toContain('red')
  })

  it('handles rice null in CSV data rows', function() {
    var features = [makeRedFeature()] // rice: null
    exportHealthCsv({
      version: '3.5',
      phase: 'GA',
      features: features,
      cachedAt: '2026-04-25T14:30:00.000Z'
    })

    var lines = capturedContent.trim().split('\n')
    // The RICE Score column should be empty for null rice
    var dataRow = lines[2] // after header + summary
    // RICE is the 7th column (index 6)
    var cols = dataRow.split(',')
    expect(cols[6]).toBe('')
  })

  it('uses lowercased phase in filename', function() {
    exportHealthCsv({
      version: '3.5',
      phase: 'EA1',
      features: [makeFeature()],
      cachedAt: '2026-04-25T14:30:00.000Z'
    })

    expect(capturedFilename).toMatch(/^release-health-3\.5-ea1-\d{4}-\d{2}-\d{2}\.csv$/)
  })

  it('produces headers only for empty features', function() {
    exportHealthCsv({
      version: '3.5',
      phase: 'GA',
      features: [],
      cachedAt: '2026-04-25T14:30:00.000Z'
    })

    var lines = capturedContent.trim().split('\n')
    // Header + summary row only, no data rows
    expect(lines.length).toBe(2)
  })
})

// ─── exportHealthMarkdown ───

describe('exportHealthMarkdown', function() {
  it('produces correct header, summary, and table', function() {
    var features = [makeFeature(), makeRedFeature()]
    exportHealthMarkdown({
      version: '3.5',
      phase: 'GA',
      features: features,
      milestones: {
        ea1Freeze: '2026-05-01',
        ea1Target: '2026-05-15',
        ea2Freeze: '2026-06-15',
        ea2Target: '2026-07-01',
        gaFreeze: '2026-08-01',
        gaTarget: '2026-08-15'
      },
      planningFreezes: { ea1: '2026-04-15' },
      cachedAt: '2026-04-25T14:30:00.000Z'
    })

    expect(capturedContent).toBeTruthy()

    // Header
    expect(capturedContent).toContain('# Release Health Report: 3.5 -- GA')
    expect(capturedContent).toContain('**Generated:**')
    expect(capturedContent).toContain('**Data as of:** 2026-04-25T14:30:00.000Z')
    expect(capturedContent).toContain('**Phase status:** Committed')

    // Summary stats match feature count
    expect(capturedContent).toContain('| Total Features | 2 |')
    expect(capturedContent).toContain('| Red Risk | 1 |')
    expect(capturedContent).toContain('| Green Risk | 1 |')
  })

  it('includes milestones section when milestones provided', function() {
    exportHealthMarkdown({
      version: '3.5',
      phase: 'GA',
      features: [makeFeature()],
      milestones: {
        ea1Freeze: '2026-05-01',
        ea1Target: '2026-05-15',
        ea2Freeze: '2026-06-15',
        ea2Target: '2026-07-01',
        gaFreeze: '2026-08-01',
        gaTarget: '2026-08-15'
      },
      planningFreezes: null,
      cachedAt: '2026-04-25T14:30:00.000Z'
    })

    expect(capturedContent).toContain('## Milestones')
    expect(capturedContent).toContain('| EA1 Code Freeze | 2026-05-01 |')
    expect(capturedContent).toContain('| GA Target | 2026-08-15 |')
  })

  it('omits milestones section when milestones is null', function() {
    exportHealthMarkdown({
      version: '3.5',
      phase: 'GA',
      features: [makeFeature()],
      milestones: null,
      planningFreezes: null,
      cachedAt: '2026-04-25T14:30:00.000Z'
    })

    expect(capturedContent).not.toContain('## Milestones')
  })

  it('includes risk flag details section', function() {
    exportHealthMarkdown({
      version: '3.5',
      phase: 'GA',
      features: [makeRedFeature()],
      milestones: null,
      planningFreezes: null,
      cachedAt: '2026-04-25T14:30:00.000Z'
    })

    expect(capturedContent).toContain('### Risk Flag Details')
    expect(capturedContent).toContain('#### RHOAIENG-1003 (Red)')
    expect(capturedContent).toContain('- **BLOCKED**: 2 active blockers on this feature')
    expect(capturedContent).toContain('- **UNESTIMATED**: No story points or t-shirt size assigned')
  })

  it('handles rice null in feature table', function() {
    exportHealthMarkdown({
      version: '3.5',
      phase: 'GA',
      features: [makeRedFeature()], // rice: null
      milestones: null,
      planningFreezes: null,
      cachedAt: '2026-04-25T14:30:00.000Z'
    })

    // The RICE column should show '-' for null rice
    expect(capturedContent).toContain('| - |')
  })

  it('handles priorityScore null', function() {
    var f = makeFeature({ priorityScore: null })
    exportHealthMarkdown({
      version: '3.5',
      phase: 'GA',
      features: [f],
      milestones: null,
      planningFreezes: null,
      cachedAt: '2026-04-25T14:30:00.000Z'
    })

    // Should contain '-' for priority
    var lines = capturedContent.split('\n')
    var featureRow = lines.find(function(l) { return l.indexOf('RHOAIENG-1001') !== -1 })
    expect(featureRow).toContain('| - |')
  })

  it('summary stats match feature count in table (phase-specific)', function() {
    var features = [makeFeature(), makeRedFeature(), makeOverriddenFeature()]
    exportHealthMarkdown({
      version: '3.5',
      phase: 'GA',
      features: features,
      milestones: null,
      planningFreezes: null,
      cachedAt: '2026-04-25T14:30:00.000Z'
    })

    // Summary should show 3 features
    expect(capturedContent).toContain('| Total Features | 3 |')

    // Count feature rows in table (lines starting with | RHOAIENG-)
    var featureRowCount = capturedContent.split('\n').filter(function(l) {
      return l.match(/^\| RHOAIENG-/)
    }).length
    expect(featureRowCount).toBe(3)
  })

  it('uses lowercased phase in filename', function() {
    exportHealthMarkdown({
      version: '3.5',
      phase: 'EA2',
      features: [makeFeature()],
      milestones: null,
      planningFreezes: null,
      cachedAt: '2026-04-25T14:30:00.000Z'
    })

    expect(capturedFilename).toMatch(/^release-health-3\.5-ea2-\d{4}-\d{2}-\d{2}\.md$/)
  })

  it('produces report with empty features', function() {
    exportHealthMarkdown({
      version: '3.5',
      phase: 'GA',
      features: [],
      milestones: null,
      planningFreezes: null,
      cachedAt: '2026-04-25T14:30:00.000Z'
    })

    expect(capturedContent).toContain('| Total Features | 0 |')
    expect(capturedContent).toContain('## Features')
    // Should have table header but no data rows
    expect(capturedContent).toContain('| Feature | Summary |')
    expect(capturedContent).toContain('No risk flags.')
  })

  it('includes footer', function() {
    exportHealthMarkdown({
      version: '3.5',
      phase: 'GA',
      features: [makeFeature()],
      milestones: null,
      planningFreezes: null,
      cachedAt: '2026-04-25T14:30:00.000Z'
    })

    expect(capturedContent).toContain('*Report generated by RHOAI Org Pulse*')
  })

  it('shows overridden risk label in feature table', function() {
    exportHealthMarkdown({
      version: '3.5',
      phase: 'GA',
      features: [makeOverriddenFeature()],
      milestones: null,
      planningFreezes: null,
      cachedAt: '2026-04-25T14:30:00.000Z'
    })

    // Should show Yellow (overridden) not Red (computed)
    var lines = capturedContent.split('\n')
    var featureRow = lines.find(function(l) { return l.indexOf('RHOAIENG-1008') !== -1 })
    expect(featureRow).toContain('Yellow')
    expect(featureRow).not.toContain('Red')
  })

  it('handles normalizeComponents for array in features', function() {
    var f = makeFeature({ components: ['Model Serving', 'Dashboard'] })
    exportHealthMarkdown({
      version: '3.5',
      phase: 'GA',
      features: [f],
      milestones: null,
      planningFreezes: null,
      cachedAt: '2026-04-25T14:30:00.000Z'
    })

    var lines = capturedContent.split('\n')
    var featureRow = lines.find(function(l) { return l.indexOf('RHOAIENG-1001') !== -1 })
    expect(featureRow).toContain('Model Serving, Dashboard')
  })
})
