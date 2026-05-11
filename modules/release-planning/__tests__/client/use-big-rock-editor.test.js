import { describe, it, expect, beforeEach } from 'vitest'
import { useBigRockEditor } from '../../client/composables/useBigRockEditor'

var editor

beforeEach(function() {
  editor = useBigRockEditor()
  editor.reset()
})

var sampleRock = {
  name: 'MaaS',
  fullName: 'Model as a Service',
  pillar: 'Inference',
  owner: 'jsmith@redhat.com',
  architect: 'jdoe@redhat.com',
  outcomeKeys: ['RHAISTRAT-100', 'RHAISTRAT-200'],
  notes: 'Important rock'
}

describe('initial state', function() {
  it('starts closed', function() {
    expect(editor.isOpen.value).toBe(false)
  })

  it('has null editingRock', function() {
    expect(editor.editingRock.value).toBe(null)
  })

  it('is new rock when editingRock is null', function() {
    expect(editor.isNewRock.value).toBe(true)
  })

  it('has empty form data', function() {
    expect(editor.formData.value.name).toBe('')
    expect(editor.formData.value.outcomeKeys).toEqual([])
  })

  it('has no saving/error state', function() {
    expect(editor.saving.value).toBe(false)
    expect(editor.saveError.value).toBe(null)
    expect(editor.fieldErrors.value).toEqual({})
  })
})

describe('openForEdit', function() {
  it('opens the panel', function() {
    editor.openForEdit(sampleRock)
    expect(editor.isOpen.value).toBe(true)
  })

  it('sets editingRock to the provided rock', function() {
    editor.openForEdit(sampleRock)
    expect(editor.editingRock.value).toStrictEqual(sampleRock)
  })

  it('is not a new rock', function() {
    editor.openForEdit(sampleRock)
    expect(editor.isNewRock.value).toBe(false)
  })

  it('populates form data from rock', function() {
    editor.openForEdit(sampleRock)
    expect(editor.formData.value.name).toBe('MaaS')
    expect(editor.formData.value.fullName).toBe('Model as a Service')
    expect(editor.formData.value.pillar).toBe('Inference')
    expect(editor.formData.value.owner).toBe('jsmith@redhat.com')
    expect(editor.formData.value.architect).toBe('jdoe@redhat.com')
    expect(editor.formData.value.outcomeKeys).toEqual(['RHAISTRAT-100', 'RHAISTRAT-200'])
    expect(editor.formData.value.notes).toBe('Important rock')
  })

  it('clones outcomeKeys array (no shared reference)', function() {
    editor.openForEdit(sampleRock)
    editor.formData.value.outcomeKeys.push('NEW-KEY')
    expect(sampleRock.outcomeKeys).toEqual(['RHAISTRAT-100', 'RHAISTRAT-200'])
  })

  it('resets saving state', function() {
    editor.setSaving(true)
    editor.setSaveError('previous error')
    editor.setFieldErrors({ name: 'required' })
    editor.openForEdit(sampleRock)
    expect(editor.saving.value).toBe(false)
    expect(editor.saveError.value).toBe(null)
    expect(editor.fieldErrors.value).toEqual({})
  })

  it('handles rock with missing optional fields', function() {
    var minimalRock = { name: 'Minimal' }
    editor.openForEdit(minimalRock)
    expect(editor.formData.value.name).toBe('Minimal')
    expect(editor.formData.value.fullName).toBe('')
    expect(editor.formData.value.pillar).toBe('')
    expect(editor.formData.value.owner).toBe('')
    expect(editor.formData.value.architect).toBe('')
    expect(editor.formData.value.outcomeKeys).toEqual([])
    expect(editor.formData.value.notes).toBe('')
  })
})

describe('openForNew', function() {
  it('opens the panel', function() {
    editor.openForNew()
    expect(editor.isOpen.value).toBe(true)
  })

  it('sets editingRock to null', function() {
    editor.openForNew()
    expect(editor.editingRock.value).toBe(null)
  })

  it('is a new rock', function() {
    editor.openForNew()
    expect(editor.isNewRock.value).toBe(true)
  })

  it('has empty form data', function() {
    editor.openForNew()
    expect(editor.formData.value.name).toBe('')
    expect(editor.formData.value.outcomeKeys).toEqual([])
  })

  it('resets saving state', function() {
    editor.setSaving(true)
    editor.openForNew()
    expect(editor.saving.value).toBe(false)
  })
})

describe('close', function() {
  it('closes the panel', function() {
    editor.openForEdit(sampleRock)
    editor.close()
    expect(editor.isOpen.value).toBe(false)
  })

  it('resets editingRock to null', function() {
    editor.openForEdit(sampleRock)
    editor.close()
    expect(editor.editingRock.value).toBe(null)
  })

  it('resets form data', function() {
    editor.openForEdit(sampleRock)
    editor.close()
    expect(editor.formData.value.name).toBe('')
    expect(editor.formData.value.outcomeKeys).toEqual([])
  })

  it('resets saving and error state', function() {
    editor.setSaving(true)
    editor.setSaveError('error')
    editor.setFieldErrors({ name: 'bad' })
    editor.close()
    expect(editor.saving.value).toBe(false)
    expect(editor.saveError.value).toBe(null)
    expect(editor.fieldErrors.value).toEqual({})
  })
})

describe('isDirty', function() {
  describe('when editing existing rock', function() {
    it('is not dirty when no changes made', function() {
      editor.openForEdit(sampleRock)
      expect(editor.isDirty.value).toBe(false)
    })

    it('is dirty when owner changes', function() {
      editor.openForEdit(sampleRock)
      editor.formData.value.owner = 'new-owner@redhat.com'
      expect(editor.isDirty.value).toBe(true)
    })

    it('is dirty when architect changes', function() {
      editor.openForEdit(sampleRock)
      editor.formData.value.architect = 'new-arch@redhat.com'
      expect(editor.isDirty.value).toBe(true)
    })

    it('is dirty when notes change', function() {
      editor.openForEdit(sampleRock)
      editor.formData.value.notes = 'Updated notes'
      expect(editor.isDirty.value).toBe(true)
    })

    it('is dirty when outcomeKeys change', function() {
      editor.openForEdit(sampleRock)
      editor.formData.value.outcomeKeys.push('NEW-KEY')
      expect(editor.isDirty.value).toBe(true)
    })

    it('is dirty when outcomeKey removed', function() {
      editor.openForEdit(sampleRock)
      editor.formData.value.outcomeKeys.splice(0, 1)
      expect(editor.isDirty.value).toBe(true)
    })
  })

  describe('when adding new rock', function() {
    it('is not dirty when all fields empty', function() {
      editor.openForNew()
      expect(editor.isDirty.value).toBe(false)
    })

    it('is dirty when name has content', function() {
      editor.openForNew()
      editor.formData.value.name = 'New Rock'
      expect(editor.isDirty.value).toBe(true)
    })

    it('is dirty when owner has content', function() {
      editor.openForNew()
      editor.formData.value.owner = 'owner@redhat.com'
      expect(editor.isDirty.value).toBe(true)
    })

    it('is dirty when outcomeKeys has content', function() {
      editor.openForNew()
      editor.formData.value.outcomeKeys.push('KEY-1')
      expect(editor.isDirty.value).toBe(true)
    })

    it('is not dirty when fields are only whitespace', function() {
      editor.openForNew()
      editor.formData.value.name = '  '
      expect(editor.isDirty.value).toBe(false)
    })
  })
})

describe('state setters', function() {
  it('setSaving updates saving ref', function() {
    editor.setSaving(true)
    expect(editor.saving.value).toBe(true)
    editor.setSaving(false)
    expect(editor.saving.value).toBe(false)
  })

  it('setSaveError updates saveError ref', function() {
    editor.setSaveError('Network error')
    expect(editor.saveError.value).toBe('Network error')
    editor.setSaveError(null)
    expect(editor.saveError.value).toBe(null)
  })

  it('setFieldErrors updates fieldErrors ref', function() {
    editor.setFieldErrors({ name: 'Required', owner: 'Invalid' })
    expect(editor.fieldErrors.value).toEqual({ name: 'Required', owner: 'Invalid' })
  })

  it('setFieldErrors defaults to empty object for null', function() {
    editor.setFieldErrors(null)
    expect(editor.fieldErrors.value).toEqual({})
  })
})

describe('reset', function() {
  it('fully resets all state', function() {
    editor.openForEdit(sampleRock)
    editor.setSaving(true)
    editor.setSaveError('error')
    editor.setFieldErrors({ name: 'bad' })
    editor.reset()

    expect(editor.isOpen.value).toBe(false)
    expect(editor.editingRock.value).toBe(null)
    expect(editor.formData.value.name).toBe('')
    expect(editor.saving.value).toBe(false)
    expect(editor.saveError.value).toBe(null)
    expect(editor.fieldErrors.value).toEqual({})
  })
})
