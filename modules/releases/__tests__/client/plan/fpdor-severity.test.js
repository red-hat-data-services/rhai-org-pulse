import { describe, it, expect } from 'vitest'
import {
  fpdorItemSeverity,
  worstFailedSeverity,
  severityBadgeClass,
  severityChipClass,
  severityLabel,
  FPDOR_SEVERITY_BY_NAME,
  isAiFirstFeature,
  pathLabel
} from '../../../client/plan/utils/fpdor-severity.js'

describe('fpdor-severity', function() {
  it('maps Confluence item names to Critical–Soft', function() {
    expect(fpdorItemSeverity('Target Version')).toBe('critical')
    expect(fpdorItemSeverity('Delivery Owner')).toBe('critical')
    expect(fpdorItemSeverity('Child epics')).toBe('critical')
    expect(fpdorItemSeverity('Docs impact')).toBe('high')
    expect(fpdorItemSeverity('RICE')).toBe('high')
    expect(fpdorItemSeverity('Acceptance criteria')).toBe('medium')
    expect(fpdorItemSeverity('UXD')).toBe('soft')
    expect(fpdorItemSeverity('Source RFE / AI SDLC')).toBe('soft')
  })

  it('covers all Confluence checklist names', function() {
    var expected = [
      'Target Version', 'Release Type', 'Components', 'PM', 'Delivery Owner',
      'Priority', 'RICE', 'Docs impact',
      'Source RFE / AI SDLC', 'Requirements clarity', 'Acceptance criteria',
      'Risks & assumptions', 'Architectural alignment', 'UXD', 'Cross-team deps',
      'Feature human sign-off', 'Child epics'
    ]
    expected.forEach(function(name) {
      expect(FPDOR_SEVERITY_BY_NAME[name]).toBeTruthy()
    })
  })

  it('returns null when no applicable fails (Ready)', function() {
    expect(worstFailedSeverity({
      items: [
        { name: 'Target Version', pass: true },
        { name: 'UXD', pass: null }
      ]
    })).toBe(null)
  })

  it('picks worst failed severity', function() {
    expect(worstFailedSeverity({
      items: [
        { name: 'UXD', pass: false },
        { name: 'Acceptance criteria', pass: false },
        { name: 'Target Version', pass: false }
      ]
    })).toBe('critical')

    expect(worstFailedSeverity({
      items: [
        { name: 'UXD', pass: false },
        { name: 'Docs impact', pass: false }
      ]
    })).toBe('high')
  })

  it('accepts feature wrapper with fpdor', function() {
    expect(worstFailedSeverity({
      fpdor: { items: [{ name: 'Priority', pass: false }] }
    })).toBe('high')
  })

  it('maps severity to badge/chip classes and labels', function() {
    expect(severityBadgeClass(null)).toContain('bg-green-100')
    expect(severityBadgeClass('critical')).toContain('bg-red-100')
    expect(severityBadgeClass('high')).toContain('bg-orange-100')
    expect(severityBadgeClass('medium')).toContain('bg-amber-100')
    expect(severityBadgeClass('soft')).toContain('bg-yellow-50')
    expect(severityChipClass('critical')).toContain('border-red-200')
    expect(severityLabel(null)).toBe('Ready')
    expect(severityLabel('soft')).toBe('Soft')
  })

  describe('AI First / Legacy path', function() {
    it('treats strat-creator-* as AI First', function() {
      expect(isAiFirstFeature({ isAiFirst: true })).toBe(true)
      expect(isAiFirstFeature({ labels: ['strat-creator-auto-created'] })).toBe(true)
      expect(pathLabel({ labels: ['strat-creator-rubric-pass'] })).toBe('AI First')
    })

    it('does not treat rp-qg1-pass alone as AI First', function() {
      expect(isAiFirstFeature({ labels: ['rp-qg1-pass'] })).toBe(false)
      expect(pathLabel({ labels: ['rp-qg1-pass'] })).toBe('Legacy')
    })

    it('respects explicit isAiFirst false even with labels', function() {
      expect(isAiFirstFeature({ isAiFirst: false, labels: ['strat-creator-auto-created'] })).toBe(false)
    })
  })
})
