import { describe, it, expect } from 'vitest'
import {
  hasDocumentationComponent,
  docsRequiredState,
  docsRequiredLabel,
  docsRequiredTitle,
  docsRequiredChipClass
} from '../../../client/plan/utils/docs-required-display.js'

describe('docsRequiredDisplay', function() {
  it('detects Documentation and Docs components', function() {
    expect(hasDocumentationComponent({ components: ['Platform', 'Documentation'] })).toBe(true)
    expect(hasDocumentationComponent({ components: ['Docs'] })).toBe(true)
    expect(hasDocumentationComponent({ components: ['Platform', 'UXD'] })).toBe(false)
  })

  it('marks Yes + Documentation as yes', function() {
    var f = { docsRequired: 'Yes', components: ['Platform', 'Documentation'] }
    expect(docsRequiredState(f)).toBe('yes')
    expect(docsRequiredLabel(f)).toBe('Yes')
    expect(docsRequiredChipClass(f)).toContain('emerald')
  })

  it('warns when Yes without Documentation component', function() {
    var f = { docsRequired: 'Yes', components: ['Platform', 'Serving'] }
    expect(docsRequiredState(f)).toBe('yes-missing-component')
    expect(docsRequiredLabel(f)).toBe('Yes')
    expect(docsRequiredChipClass(f)).toContain('amber')
    expect(docsRequiredTitle(f)).toContain('Documentation component is missing')
  })

  it('treats No as no without requiring Documentation', function() {
    var f = { docsRequired: 'No', components: ['Platform'] }
    expect(docsRequiredState(f)).toBe('no')
    expect(docsRequiredLabel(f)).toBe('No')
    expect(docsRequiredTitle(f)).toContain('Docs Required = No')
  })

  it('treats unset as unset', function() {
    expect(docsRequiredState({ docsRequired: null, components: [] })).toBe('unset')
    expect(docsRequiredLabel({ docsRequired: null })).toBe('—')
    expect(docsRequiredTitle({ docsRequired: null })).toContain('not set')
  })
})
