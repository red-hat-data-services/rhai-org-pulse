import { describe, it, expect } from 'vitest'

const { DOR_ITEMS, evaluateDor } = require('../../server/health/dor-checker')

describe('DOR_ITEMS', function() {
  it('has 13 items', function() {
    expect(DOR_ITEMS).toHaveLength(13)
  })

  it('has 8 automated items', function() {
    var automated = DOR_ITEMS.filter(function(i) { return i.type === 'automated' })
    expect(automated).toHaveLength(8)
  })

  it('has 5 manual items', function() {
    var manual = DOR_ITEMS.filter(function(i) { return i.type === 'manual' })
    expect(manual).toHaveLength(5)
  })

  it('has unique ids', function() {
    var ids = DOR_ITEMS.map(function(i) { return i.id })
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('evaluateDor', function() {
  it('returns all 13 items', function() {
    var result = evaluateDor({}, null, null)
    expect(result.items).toHaveLength(13)
    expect(result.totalCount).toBe(13)
  })

  it('F-1 passes when summary exists and enrichment has description', function() {
    var feature = { summary: 'A feature' }
    var enrichment = { hasDescription: true }
    var result = evaluateDor(feature, enrichment, null)
    var f1 = result.items.find(function(i) { return i.id === 'F-1' })
    expect(f1.checked).toBe(true)
  })

  it('F-1 fails when enrichment has no description', function() {
    var feature = { summary: 'A feature' }
    var enrichment = { hasDescription: false }
    var result = evaluateDor(feature, enrichment, null)
    var f1 = result.items.find(function(i) { return i.id === 'F-1' })
    expect(f1.checked).toBe(false)
  })

  it('F-1 fails when summary is empty', function() {
    var result = evaluateDor({ summary: '' }, { hasDescription: true }, null)
    var f1 = result.items.find(function(i) { return i.id === 'F-1' })
    expect(f1.checked).toBe(false)
  })

  it('F-2 passes when targetVersions is non-empty', function() {
    var result = evaluateDor({ targetVersions: ['3.5'] }, null, null)
    var f2 = result.items.find(function(i) { return i.id === 'F-2' })
    expect(f2.checked).toBe(true)
  })

  it('F-2 fails when targetVersions is empty', function() {
    var result = evaluateDor({ targetVersions: [] }, null, null)
    var f2 = result.items.find(function(i) { return i.id === 'F-2' })
    expect(f2.checked).toBe(false)
  })

  it('F-4 passes when pm is a non-empty string', function() {
    var result = evaluateDor({ pm: 'Jane Doe' }, null, null)
    var f4 = result.items.find(function(i) { return i.id === 'F-4' })
    expect(f4.checked).toBe(true)
  })

  it('F-4 passes when pm is an object with displayName', function() {
    var result = evaluateDor({ pm: { displayName: 'Jane Doe' } }, null, null)
    var f4 = result.items.find(function(i) { return i.id === 'F-4' })
    expect(f4.checked).toBe(true)
  })

  it('F-4 fails when pm is null', function() {
    var result = evaluateDor({ pm: null }, null, null)
    var f4 = result.items.find(function(i) { return i.id === 'F-4' })
    expect(f4.checked).toBe(false)
  })

  it('F-5 passes when assignee is a non-empty string', function() {
    var result = evaluateDor({ assignee: 'John Smith' }, null, null)
    var f5 = result.items.find(function(i) { return i.id === 'F-5' })
    expect(f5.checked).toBe(true)
  })

  it('F-5 passes when assignee has displayName', function() {
    var result = evaluateDor({ assignee: { displayName: 'John' } }, null, null)
    var f5 = result.items.find(function(i) { return i.id === 'F-5' })
    expect(f5.checked).toBe(true)
  })

  it('F-5 fails when assignee is null', function() {
    var result = evaluateDor({ assignee: null }, null, null)
    var f5 = result.items.find(function(i) { return i.id === 'F-5' })
    expect(f5.checked).toBe(false)
  })

  it('F-6 passes when components is a non-empty array', function() {
    var result = evaluateDor({ components: ['Model Serving'] }, null, null)
    var f6 = result.items.find(function(i) { return i.id === 'F-6' })
    expect(f6.checked).toBe(true)
  })

  it('F-6 fails when components is empty', function() {
    var result = evaluateDor({ components: [] }, null, null)
    var f6 = result.items.find(function(i) { return i.id === 'F-6' })
    expect(f6.checked).toBe(false)
  })

  it('F-7 passes when enrichment has storyPoints > 0', function() {
    var result = evaluateDor({}, { storyPoints: 5 }, null)
    var f7 = result.items.find(function(i) { return i.id === 'F-7' })
    expect(f7.checked).toBe(true)
  })

  it('F-7 fails when storyPoints is null', function() {
    var result = evaluateDor({}, { storyPoints: null }, null)
    var f7 = result.items.find(function(i) { return i.id === 'F-7' })
    expect(f7.checked).toBe(false)
  })

  it('F-8 passes by default when no dependency links', function() {
    var result = evaluateDor({}, null, null)
    var f8 = result.items.find(function(i) { return i.id === 'F-8' })
    expect(f8.checked).toBe(true)
  })

  it('F-8 fails when unresolved inward Blocks link exists', function() {
    var enrichment = {
      dependencyLinks: [
        { type: 'Blocks', direction: 'inward', linkedKey: 'X-1', linkedStatus: 'In Progress' }
      ]
    }
    var result = evaluateDor({}, enrichment, null)
    var f8 = result.items.find(function(i) { return i.id === 'F-8' })
    expect(f8.checked).toBe(false)
  })

  it('F-8 passes when Blocks link is Closed', function() {
    var enrichment = {
      dependencyLinks: [
        { type: 'Blocks', direction: 'inward', linkedKey: 'X-1', linkedStatus: 'Closed' }
      ]
    }
    var result = evaluateDor({}, enrichment, null)
    var f8 = result.items.find(function(i) { return i.id === 'F-8' })
    expect(f8.checked).toBe(true)
  })

  it('F-10 passes when releaseType is set', function() {
    var result = evaluateDor({ releaseType: 'General Availability' }, null, null)
    var f10 = result.items.find(function(i) { return i.id === 'F-10' })
    expect(f10.checked).toBe(true)
  })

  it('F-10 fails when releaseType is falsy', function() {
    var result = evaluateDor({ releaseType: '' }, null, null)
    var f10 = result.items.find(function(i) { return i.id === 'F-10' })
    expect(f10.checked).toBe(false)
  })

  it('reads manual checks from manualChecks parameter', function() {
    var manualChecks = { 'F-3': { checked: true }, 'F-9': { checked: false } }
    var result = evaluateDor({}, null, manualChecks)
    var f3 = result.items.find(function(i) { return i.id === 'F-3' })
    var f9 = result.items.find(function(i) { return i.id === 'F-9' })
    expect(f3.checked).toBe(true)
    expect(f9.checked).toBe(false)
  })

  it('calculates completionPct correctly', function() {
    var feature = {
      summary: 'Test',
      targetVersions: ['3.5'],
      pm: 'PM',
      assignee: 'Owner',
      components: ['Comp'],
      releaseType: 'GA'
    }
    var enrichment = { hasDescription: true, storyPoints: 5, dependencyLinks: [] }
    var manualChecks = {
      'F-3': { checked: true },
      'F-9': { checked: true },
      'F-11': { checked: true },
      'F-12': { checked: true },
      'F-13': { checked: true }
    }
    var result = evaluateDor(feature, enrichment, manualChecks)
    expect(result.checkedCount).toBe(13)
    expect(result.completionPct).toBe(100)
  })

  it('returns ~8% for empty feature with no enrichment or manual checks', function() {
    var result = evaluateDor({}, null, null)
    // Only F-8 passes by default
    expect(result.checkedCount).toBe(1)
    expect(result.completionPct).toBe(Math.round((1 / 13) * 100))
  })

  it('items have correct structure', function() {
    var result = evaluateDor({}, null, null)
    for (var i = 0; i < result.items.length; i++) {
      var item = result.items[i]
      expect(item).toHaveProperty('id')
      expect(item).toHaveProperty('label')
      expect(item).toHaveProperty('type')
      expect(item).toHaveProperty('checked')
      expect(item).toHaveProperty('source')
      expect(typeof item.checked).toBe('boolean')
    }
  })
})
