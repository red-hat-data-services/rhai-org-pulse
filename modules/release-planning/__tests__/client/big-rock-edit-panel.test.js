import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import BigRockEditPanel from '../../client/components/BigRockEditPanel.vue'
import { useBigRockEditor } from '../../client/composables/useBigRockEditor'

// Mock useFocusTrap to avoid DOM focus manipulation in tests
vi.mock('../../client/composables/useFocusTrap', function() {
  return {
    useFocusTrap: function() {
      return {
        handleKeydown: vi.fn()
      }
    }
  }
})

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
  outcomeKeys: ['RHAISTRAT-100'],
  notes: 'Some notes'
}

function mountPanel() {
  return mount(BigRockEditPanel, {
    attachTo: document.body
  })
}

describe('BigRockEditPanel', function() {
  describe('when closed', function() {
    it('does not render the panel', function() {
      var wrapper = mountPanel()
      expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
      wrapper.unmount()
    })
  })

  describe('when open for editing', function() {
    beforeEach(function() {
      editor.openForEdit(sampleRock)
    })

    it('renders the panel dialog', function() {
      var wrapper = mountPanel()
      expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
      wrapper.unmount()
    })

    it('shows "Edit Big Rock" title', function() {
      var wrapper = mountPanel()
      expect(wrapper.text()).toContain('Edit Big Rock')
      wrapper.unmount()
    })

    it('shows rock name as read-only', function() {
      var wrapper = mountPanel()
      expect(wrapper.text()).toContain('MaaS')
      // Name should not be an input when editing
      var nameInput = wrapper.find('#rock-name')
      expect(nameInput.exists()).toBe(false)
      wrapper.unmount()
    })

    it('shows pillar as read-only when present', function() {
      var wrapper = mountPanel()
      expect(wrapper.text()).toContain('Inference')
      wrapper.unmount()
    })

    it('populates owner input', function() {
      var wrapper = mountPanel()
      var ownerInput = wrapper.find('#rock-owner')
      expect(ownerInput.element.value).toBe('jsmith@redhat.com')
      wrapper.unmount()
    })

    it('populates architect input', function() {
      var wrapper = mountPanel()
      var architectInput = wrapper.find('#rock-architect')
      expect(architectInput.element.value).toBe('jdoe@redhat.com')
      wrapper.unmount()
    })

    it('populates notes textarea', function() {
      var wrapper = mountPanel()
      var notesInput = wrapper.find('#rock-notes')
      expect(notesInput.element.value).toBe('Some notes')
      wrapper.unmount()
    })

    it('shows existing outcome key tags', function() {
      var wrapper = mountPanel()
      expect(wrapper.text()).toContain('RHAISTRAT-100')
      wrapper.unmount()
    })

    it('shows Save and Cancel buttons', function() {
      var wrapper = mountPanel()
      expect(wrapper.text()).toContain('Save')
      expect(wrapper.text()).toContain('Cancel')
      wrapper.unmount()
    })
  })

  describe('when open for new', function() {
    beforeEach(function() {
      editor.openForNew()
    })

    it('shows "Add Big Rock" title', function() {
      var wrapper = mountPanel()
      expect(wrapper.text()).toContain('Add Big Rock')
      wrapper.unmount()
    })

    it('shows name as editable input', function() {
      var wrapper = mountPanel()
      var nameInput = wrapper.find('#rock-name')
      expect(nameInput.exists()).toBe(true)
      wrapper.unmount()
    })

    it('has empty form fields', function() {
      var wrapper = mountPanel()
      var ownerInput = wrapper.find('#rock-owner')
      expect(ownerInput.element.value).toBe('')
      wrapper.unmount()
    })
  })

  describe('outcome key tag input', function() {
    beforeEach(function() {
      editor.openForNew()
    })

    it('adds outcome key on Enter', async function() {
      var wrapper = mountPanel()
      var input = wrapper.find('#rock-outcome-key')
      await input.setValue('rhaistrat-500')
      await input.trigger('keydown', { key: 'Enter' })
      await nextTick()

      // Should be uppercased and added
      expect(editor.formData.value.outcomeKeys).toContain('RHAISTRAT-500')
      // Input should be cleared
      expect(input.element.value).toBe('')
      wrapper.unmount()
    })

    it('adds outcome key on Add button click', async function() {
      var wrapper = mountPanel()
      var input = wrapper.find('#rock-outcome-key')
      await input.setValue('KEY-123')
      var addBtn = wrapper.findAll('button').find(function(b) { return b.text() === 'Add' })
      await addBtn.trigger('click')
      await nextTick()

      expect(editor.formData.value.outcomeKeys).toContain('KEY-123')
      wrapper.unmount()
    })

    it('does not add empty key', async function() {
      var wrapper = mountPanel()
      var input = wrapper.find('#rock-outcome-key')
      await input.setValue('  ')
      await input.trigger('keydown', { key: 'Enter' })
      await nextTick()

      expect(editor.formData.value.outcomeKeys).toEqual([])
      wrapper.unmount()
    })

    it('does not add duplicate key', async function() {
      var wrapper = mountPanel()
      var input = wrapper.find('#rock-outcome-key')

      // Add first key
      await input.setValue('KEY-1')
      await input.trigger('keydown', { key: 'Enter' })
      await nextTick()

      // Try adding same key again (case-insensitive via toUpperCase)
      await input.setValue('key-1')
      await input.trigger('keydown', { key: 'Enter' })
      await nextTick()

      expect(editor.formData.value.outcomeKeys).toEqual(['KEY-1'])
      wrapper.unmount()
    })

    it('removes outcome key when remove button is clicked', async function() {
      editor.formData.value.outcomeKeys = ['KEY-1', 'KEY-2']
      await nextTick()

      var wrapper = mountPanel()
      await nextTick()

      // Find remove button for KEY-1
      var removeBtn = wrapper.find('[aria-label="Remove KEY-1"]')
      expect(removeBtn.exists()).toBe(true)
      await removeBtn.trigger('click')
      await nextTick()

      expect(editor.formData.value.outcomeKeys).toEqual(['KEY-2'])
      wrapper.unmount()
    })
  })

  describe('field error display', function() {
    beforeEach(function() {
      editor.openForNew()
    })

    it('shows name field error', async function() {
      editor.setFieldErrors({ name: 'Name is required' })
      await nextTick()

      var wrapper = mountPanel()
      expect(wrapper.text()).toContain('Name is required')
      wrapper.unmount()
    })

    it('shows owner field error', async function() {
      editor.setFieldErrors({ owner: 'Invalid email' })
      await nextTick()

      var wrapper = mountPanel()
      expect(wrapper.text()).toContain('Invalid email')
      wrapper.unmount()
    })

    it('shows architect field error', async function() {
      editor.setFieldErrors({ architect: 'Invalid email' })
      await nextTick()

      var wrapper = mountPanel()
      expect(wrapper.text()).toContain('Invalid email')
      wrapper.unmount()
    })

    it('shows outcome keys field error', async function() {
      editor.setFieldErrors({ outcomeKeys: 'At least one required' })
      await nextTick()

      var wrapper = mountPanel()
      expect(wrapper.text()).toContain('At least one required')
      wrapper.unmount()
    })

    it('shows notes field error', async function() {
      editor.setFieldErrors({ notes: 'Too long' })
      await nextTick()

      var wrapper = mountPanel()
      expect(wrapper.text()).toContain('Too long')
      wrapper.unmount()
    })

    it('applies error styling to name input', async function() {
      editor.setFieldErrors({ name: 'Required' })
      await nextTick()

      var wrapper = mountPanel()
      var nameInput = wrapper.find('#rock-name')
      expect(nameInput.classes()).toEqual(expect.arrayContaining([expect.stringContaining('red')]))
      wrapper.unmount()
    })
  })

  describe('save and retry flow', function() {
    beforeEach(function() {
      editor.openForNew()
    })

    it('emits save when Save button is clicked', async function() {
      var wrapper = mountPanel()
      var saveBtn = wrapper.findAll('button').find(function(b) { return b.text() === 'Save' })
      await saveBtn.trigger('click')

      expect(wrapper.emitted('save')).toBeTruthy()
      wrapper.unmount()
    })

    it('shows saving state', async function() {
      editor.setSaving(true)
      await nextTick()

      var wrapper = mountPanel()
      expect(wrapper.text()).toContain('Saving...')
      // Save button should be disabled
      var saveBtn = wrapper.findAll('button').find(function(b) { return b.text().includes('Saving') })
      expect(saveBtn.attributes('disabled')).toBeDefined()
      wrapper.unmount()
    })

    it('shows save error message', async function() {
      editor.setSaveError('Network error occurred')
      await nextTick()

      var wrapper = mountPanel()
      expect(wrapper.text()).toContain('Save failed')
      expect(wrapper.text()).toContain('Network error occurred')
      wrapper.unmount()
    })

    it('shows Retry button when save error exists', async function() {
      editor.setSaveError('Something went wrong')
      await nextTick()

      var wrapper = mountPanel()
      var retryBtn = wrapper.findAll('button').find(function(b) { return b.text() === 'Retry' })
      expect(retryBtn).toBeTruthy()
      wrapper.unmount()
    })

    it('emits save when Retry button is clicked', async function() {
      editor.setSaveError('Something went wrong')
      await nextTick()

      var wrapper = mountPanel()
      var retryBtn = wrapper.findAll('button').find(function(b) { return b.text() === 'Retry' })
      await retryBtn.trigger('click')

      expect(wrapper.emitted('save')).toBeTruthy()
      wrapper.unmount()
    })

    it('disables Save and Cancel buttons when saving', async function() {
      editor.setSaving(true)
      await nextTick()

      var wrapper = mountPanel()
      var cancelBtn = wrapper.findAll('button').find(function(b) { return b.text() === 'Cancel' })
      expect(cancelBtn.attributes('disabled')).toBeDefined()
      wrapper.unmount()
    })
  })

  describe('cancel flow', function() {
    beforeEach(function() {
      editor.openForEdit(sampleRock)
    })

    it('emits cancel when Cancel button is clicked', async function() {
      var wrapper = mountPanel()
      var cancelBtn = wrapper.findAll('button').find(function(b) { return b.text() === 'Cancel' })
      await cancelBtn.trigger('click')

      expect(wrapper.emitted('cancel')).toBeTruthy()
      wrapper.unmount()
    })

    it('emits cancel when close button is clicked', async function() {
      var wrapper = mountPanel()
      var closeBtn = wrapper.find('[aria-label="Close panel"]')
      await closeBtn.trigger('click')

      expect(wrapper.emitted('cancel')).toBeTruthy()
      wrapper.unmount()
    })

    it('emits cancel when backdrop is clicked', async function() {
      var wrapper = mountPanel()
      // Backdrop is the first fixed inset-0 div
      var backdrop = wrapper.find('.fixed.inset-0.bg-black\\/30')
      await backdrop.trigger('click')

      expect(wrapper.emitted('cancel')).toBeTruthy()
      wrapper.unmount()
    })
  })

  describe('accessibility', function() {
    beforeEach(function() {
      editor.openForEdit(sampleRock)
    })

    it('has aria-modal="true" on dialog', function() {
      var wrapper = mountPanel()
      var dialog = wrapper.find('[role="dialog"]')
      expect(dialog.attributes('aria-modal')).toBe('true')
      wrapper.unmount()
    })

    it('has aria-labelledby pointing to title', function() {
      var wrapper = mountPanel()
      var dialog = wrapper.find('[role="dialog"]')
      expect(dialog.attributes('aria-labelledby')).toBe('edit-panel-title')
      var title = wrapper.find('#edit-panel-title')
      expect(title.exists()).toBe(true)
      wrapper.unmount()
    })

    it('has aria-busy on save button when saving', async function() {
      editor.setSaving(true)
      await nextTick()

      var wrapper = mountPanel()
      var saveBtn = wrapper.findAll('button').find(function(b) { return b.text().includes('Saving') })
      expect(saveBtn.attributes('aria-busy')).toBe('true')
      wrapper.unmount()
    })

    it('has role="alert" on save error', async function() {
      editor.setSaveError('Error')
      await nextTick()

      var wrapper = mountPanel()
      var alert = wrapper.find('[role="alert"]')
      expect(alert.exists()).toBe(true)
      wrapper.unmount()
    })
  })
})
