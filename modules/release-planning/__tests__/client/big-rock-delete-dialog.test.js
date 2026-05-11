import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import BigRockDeleteDialog from '../../client/components/BigRockDeleteDialog.vue'

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

function mountDialog(props) {
  return mount(BigRockDeleteDialog, {
    props: Object.assign({ open: false, rockName: 'MaaS', deleting: false }, props),
    attachTo: document.body
  })
}

describe('BigRockDeleteDialog', function() {
  it('does not render dialog content when closed', function() {
    var wrapper = mountDialog({ open: false })
    expect(wrapper.find('[role="alertdialog"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('renders dialog when open', function() {
    var wrapper = mountDialog({ open: true })
    expect(wrapper.find('[role="alertdialog"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('displays the rock name in the confirmation message', function() {
    var wrapper = mountDialog({ open: true, rockName: 'Training Pipeline' })
    expect(wrapper.text()).toContain('Training Pipeline')
    wrapper.unmount()
  })

  it('displays the dialog title', function() {
    var wrapper = mountDialog({ open: true })
    expect(wrapper.text()).toContain('Delete Big Rock')
    wrapper.unmount()
  })

  it('displays the confirmation question', function() {
    var wrapper = mountDialog({ open: true })
    expect(wrapper.text()).toContain('Are you sure you want to delete')
    expect(wrapper.text()).toContain('This cannot be undone')
    wrapper.unmount()
  })

  it('emits confirm when Delete button is clicked', async function() {
    var wrapper = mountDialog({ open: true })
    var deleteBtn = wrapper.findAll('button').find(function(b) { return b.text().includes('Delete') })
    await deleteBtn.trigger('click')
    expect(wrapper.emitted('confirm')).toBeTruthy()
    expect(wrapper.emitted('confirm').length).toBe(1)
    wrapper.unmount()
  })

  it('emits cancel when Cancel button is clicked', async function() {
    var wrapper = mountDialog({ open: true })
    var cancelBtn = wrapper.findAll('button').find(function(b) { return b.text() === 'Cancel' })
    await cancelBtn.trigger('click')
    expect(wrapper.emitted('cancel')).toBeTruthy()
    expect(wrapper.emitted('cancel').length).toBe(1)
    wrapper.unmount()
  })

  it('emits cancel when backdrop is clicked', async function() {
    var wrapper = mountDialog({ open: true })
    // Backdrop is the first absolute div inside the container
    var backdrop = wrapper.find('.absolute.inset-0')
    await backdrop.trigger('click')
    expect(wrapper.emitted('cancel')).toBeTruthy()
    wrapper.unmount()
  })

  it('shows "Deleting..." text when deleting', function() {
    var wrapper = mountDialog({ open: true, deleting: true })
    expect(wrapper.text()).toContain('Deleting...')
    wrapper.unmount()
  })

  it('shows "Delete" text when not deleting', function() {
    var wrapper = mountDialog({ open: true, deleting: false })
    var deleteBtn = wrapper.findAll('button').find(function(b) { return b.text().includes('Delete') })
    expect(deleteBtn.text()).toBe('Delete')
    wrapper.unmount()
  })

  it('disables buttons when deleting', function() {
    var wrapper = mountDialog({ open: true, deleting: true })
    var buttons = wrapper.findAll('button')
    for (var i = 0; i < buttons.length; i++) {
      expect(buttons[i].attributes('disabled')).toBeDefined()
    }
    wrapper.unmount()
  })

  it('enables buttons when not deleting', function() {
    var wrapper = mountDialog({ open: true, deleting: false })
    var cancelBtn = wrapper.findAll('button').find(function(b) { return b.text() === 'Cancel' })
    expect(cancelBtn.attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })

  it('has aria-modal="true" on dialog', function() {
    var wrapper = mountDialog({ open: true })
    var dialog = wrapper.find('[role="alertdialog"]')
    expect(dialog.attributes('aria-modal')).toBe('true')
    wrapper.unmount()
  })

  it('has aria-labelledby pointing to the title', function() {
    var wrapper = mountDialog({ open: true })
    var dialog = wrapper.find('[role="alertdialog"]')
    expect(dialog.attributes('aria-labelledby')).toBe('delete-dialog-title')
    var title = wrapper.find('#delete-dialog-title')
    expect(title.exists()).toBe(true)
    wrapper.unmount()
  })
})
