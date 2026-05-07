import { describe, it, expect, vi, beforeEach } from 'vitest'
import { exportMarkdown, exportCsv } from '../../client/utils/outcomes-export'

// ─── Mock DOM APIs ───

var capturedContent = null
var capturedFilename = null

beforeEach(function() {
  capturedContent = null
  capturedFilename = null

  globalThis.Blob = vi.fn(function(parts, options) {
    this.content = parts.join('')
    this.type = options ? options.type : ''
  })

  globalThis.URL.createObjectURL = vi.fn(function() { return 'blob:mock-url' })
  globalThis.URL.revokeObjectURL = vi.fn()

  vi.spyOn(document, 'createElement').mockImplementation(function(tag) {
    if (tag === 'a') {
      return {
        href: '',
        download: '',
        click: vi.fn(function() {
          capturedFilename = this.download
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

var sampleBigRocks = [
  { priority: 1, name: 'MaaS', pillar: 'Inference', owner: 'jsmith', architect: 'jdoe', featureCount: 5, rfeCount: 2, notes: 'Important' },
  { priority: 2, name: 'Training', pillar: 'Platform', owner: '', architect: '', featureCount: 1, rfeCount: 0, notes: '' }
]

var sampleFeatures = [
  { bigRock: 'MaaS', issueKey: 'RHOAIENG-1001', status: 'In Progress', priority: 'Major', phase: 'GA', summary: 'Test feature', components: 'Model Serving', targetRelease: 'RHOAI 3.5', pm: 'Test PM', deliveryOwner: 'Test Owner', rfe: 'RHOAIENG-500', fixVersion: '3.5-GA' }
]

var sampleRfes = [
  { bigRock: 'MaaS', issueKey: 'RHOAIENG-500', status: 'New', priority: 'Normal', summary: 'Test RFE', components: 'Model Serving', pm: 'PM Name', labels: 'customer-request' }
]

// ─── exportMarkdown ───

describe('exportMarkdown', function() {
  it('exports big rocks as markdown table', function() {
    exportMarkdown({
      activeTab: 'big-rocks',
      selectedVersion: '3.5',
      bigRocks: sampleBigRocks,
      filteredFeatures: [],
      filteredRfes: []
    })

    expect(capturedContent).toContain('# Big Rocks - 3.5')
    expect(capturedContent).toContain('MaaS')
    expect(capturedContent).toContain('Training')
    expect(capturedFilename).toBe('big-rocks-3.5.md')
  })

  it('exports features as markdown table', function() {
    exportMarkdown({
      activeTab: 'features',
      selectedVersion: '3.5',
      bigRocks: [],
      filteredFeatures: sampleFeatures,
      filteredRfes: []
    })

    expect(capturedContent).toContain('# Features - 3.5')
    expect(capturedContent).toContain('RHOAIENG-1001')
    expect(capturedContent).toContain('Test feature')
    expect(capturedFilename).toBe('features-3.5.md')
  })

  it('exports RFEs as markdown table', function() {
    exportMarkdown({
      activeTab: 'rfes',
      selectedVersion: '3.5',
      bigRocks: [],
      filteredFeatures: [],
      filteredRfes: sampleRfes
    })

    expect(capturedContent).toContain('# RFEs - 3.5')
    expect(capturedContent).toContain('RHOAIENG-500')
    expect(capturedContent).toContain('Test RFE')
    expect(capturedFilename).toBe('rfes-3.5.md')
  })

  it('escapes pipe characters in markdown cells', function() {
    var rocksWithPipe = [
      { priority: 1, name: 'Rock|Name', pillar: 'P', owner: '', architect: '', featureCount: 0, rfeCount: 0, notes: '' }
    ]
    exportMarkdown({
      activeTab: 'big-rocks',
      selectedVersion: '3.5',
      bigRocks: rocksWithPipe,
      filteredFeatures: [],
      filteredRfes: []
    })

    expect(capturedContent).toContain('Rock\\|Name')
  })

  it('escapes backslash characters in markdown cells', function() {
    var rocksWithBackslash = [
      { priority: 1, name: 'Rock\\Path', pillar: '', owner: '', architect: '', featureCount: 0, rfeCount: 0, notes: '' }
    ]
    exportMarkdown({
      activeTab: 'big-rocks',
      selectedVersion: '3.5',
      bigRocks: rocksWithBackslash,
      filteredFeatures: [],
      filteredRfes: []
    })

    expect(capturedContent).toContain('Rock\\\\Path')
  })
})

// ─── exportCsv ───

describe('exportCsv', function() {
  it('exports big rocks as CSV', function() {
    exportCsv({
      activeTab: 'big-rocks',
      selectedVersion: '3.5',
      bigRocks: sampleBigRocks,
      filteredFeatures: [],
      filteredRfes: []
    })

    expect(capturedContent).toContain('Priority,Pillar,Big Rock')
    expect(capturedContent).toContain('MaaS')
    expect(capturedFilename).toBe('big-rocks-3.5.csv')
  })

  it('exports features as CSV', function() {
    exportCsv({
      activeTab: 'features',
      selectedVersion: '3.5',
      bigRocks: [],
      filteredFeatures: sampleFeatures,
      filteredRfes: []
    })

    expect(capturedContent).toContain('Big Rock,Feature,Status')
    expect(capturedContent).toContain('RHOAIENG-1001')
    expect(capturedFilename).toBe('features-3.5.csv')
  })

  it('exports RFEs as CSV', function() {
    exportCsv({
      activeTab: 'rfes',
      selectedVersion: '3.5',
      bigRocks: [],
      filteredFeatures: [],
      filteredRfes: sampleRfes
    })

    expect(capturedContent).toContain('Big Rock,RFE,Status')
    expect(capturedContent).toContain('RHOAIENG-500')
    expect(capturedFilename).toBe('rfes-3.5.csv')
  })

  it('quotes CSV values containing commas', function() {
    var featuresWithComma = [
      { bigRock: '', issueKey: 'KEY-1', status: '', priority: '', phase: '', summary: 'Feature with, comma', components: '', targetRelease: '', pm: '', deliveryOwner: '', rfe: '', fixVersion: '' }
    ]
    exportCsv({
      activeTab: 'features',
      selectedVersion: '3.5',
      bigRocks: [],
      filteredFeatures: featuresWithComma,
      filteredRfes: []
    })

    expect(capturedContent).toContain('"Feature with, comma"')
  })

  // ─── CSV injection guard tests ───

  it('prefixes values starting with = to guard against CSV injection', function() {
    var rocksWithFormula = [
      { priority: 1, name: '=SUM(A1:A2)', pillar: '', owner: '', architect: '', featureCount: 0, rfeCount: 0, notes: '' }
    ]
    exportCsv({
      activeTab: 'big-rocks',
      selectedVersion: '3.5',
      bigRocks: rocksWithFormula,
      filteredFeatures: [],
      filteredRfes: []
    })

    // The = should be prefixed with ' to prevent formula execution
    expect(capturedContent).toContain("'=SUM(A1:A2)")
  })

  it('prefixes values starting with + to guard against CSV injection', function() {
    var rocksWithPlus = [
      { priority: 1, name: '+cmd', pillar: '', owner: '', architect: '', featureCount: 0, rfeCount: 0, notes: '' }
    ]
    exportCsv({
      activeTab: 'big-rocks',
      selectedVersion: '3.5',
      bigRocks: rocksWithPlus,
      filteredFeatures: [],
      filteredRfes: []
    })

    expect(capturedContent).toContain("'+cmd")
  })

  it('prefixes values starting with - to guard against CSV injection', function() {
    var rocksWithDash = [
      { priority: 1, name: '-cmd', pillar: '', owner: '', architect: '', featureCount: 0, rfeCount: 0, notes: '' }
    ]
    exportCsv({
      activeTab: 'big-rocks',
      selectedVersion: '3.5',
      bigRocks: rocksWithDash,
      filteredFeatures: [],
      filteredRfes: []
    })

    expect(capturedContent).toContain("'-cmd")
  })

  it('prefixes values starting with @ to guard against CSV injection', function() {
    var rocksWithAt = [
      { priority: 1, name: '@external', pillar: '', owner: '', architect: '', featureCount: 0, rfeCount: 0, notes: '' }
    ]
    exportCsv({
      activeTab: 'big-rocks',
      selectedVersion: '3.5',
      bigRocks: rocksWithAt,
      filteredFeatures: [],
      filteredRfes: []
    })

    expect(capturedContent).toContain("'@external")
  })

  it('prefixes values starting with tab to guard against CSV injection', function() {
    var rocksWithTab = [
      { priority: 1, name: '\tcmd', pillar: '', owner: '', architect: '', featureCount: 0, rfeCount: 0, notes: '' }
    ]
    exportCsv({
      activeTab: 'big-rocks',
      selectedVersion: '3.5',
      bigRocks: rocksWithTab,
      filteredFeatures: [],
      filteredRfes: []
    })

    expect(capturedContent).toContain("'\tcmd")
  })

  it('prefixes values starting with CR to guard against CSV injection', function() {
    var rocksWithCR = [
      { priority: 1, name: '\rcmd', pillar: '', owner: '', architect: '', featureCount: 0, rfeCount: 0, notes: '' }
    ]
    exportCsv({
      activeTab: 'big-rocks',
      selectedVersion: '3.5',
      bigRocks: rocksWithCR,
      filteredFeatures: [],
      filteredRfes: []
    })

    // CR triggers both the injection guard prefix AND the quoting for \r
    expect(capturedContent).toContain("'")
  })

  it('does not prefix safe values', function() {
    var safeRocks = [
      { priority: 1, name: 'SafeRock', pillar: 'Platform', owner: '', architect: '', featureCount: 0, rfeCount: 0, notes: '' }
    ]
    exportCsv({
      activeTab: 'big-rocks',
      selectedVersion: '3.5',
      bigRocks: safeRocks,
      filteredFeatures: [],
      filteredRfes: []
    })

    // Should not have a leading single quote before SafeRock
    var lines = capturedContent.trim().split('\n')
    var dataRow = lines[1]
    expect(dataRow).toContain('SafeRock')
    expect(dataRow).not.toContain("'SafeRock")
  })
})
