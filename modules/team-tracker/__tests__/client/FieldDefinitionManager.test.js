import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { mount } from '@vue/test-utils'
import FieldDefinitionManager from '../../client/components/FieldDefinitionManager.vue'

vi.mock('@shared/client/composables/useFieldDefinitions', () => ({
  useFieldDefinitions: () => ({
    definitions: ref({
      personFields: [
        {
          id: 'field_c1', label: 'Component', type: 'constrained', multiValue: false,
          required: false, visible: true, deleted: false, allowedValues: ['Platform', 'UI'],
          order: 0
        },
        {
          id: 'field_mv1', label: 'Skills', type: 'constrained', multiValue: true,
          required: false, visible: true, deleted: false, allowedValues: ['Go', 'Rust'],
          order: 1
        }
      ],
      teamFields: []
    }),
    loading: ref(false),
    demoToast: ref(null),
    fetchDefinitions: vi.fn(),
    createField: vi.fn().mockResolvedValue({}),
    updateField: vi.fn().mockResolvedValue({}),
    deleteField: vi.fn().mockResolvedValue({})
  })
}))

describe('FieldDefinitionManager', () => {
  it('renders field list', () => {
    const wrapper = mount(FieldDefinitionManager)
    expect(wrapper.text()).toContain('Component')
    expect(wrapper.text()).toContain('Skills')
  })

  it('shows (multi) badge for multiValue fields', () => {
    const wrapper = mount(FieldDefinitionManager)
    expect(wrapper.text()).toContain('(multi)')
  })

  it('shows option count for constrained fields', () => {
    const wrapper = mount(FieldDefinitionManager)
    expect(wrapper.text()).toContain('2 options')
  })

  it('opens create modal on Add Field click', async () => {
    const wrapper = mount(FieldDefinitionManager)
    await wrapper.find('button').trigger('click') // "Add Field" button
    expect(wrapper.text()).toContain('Add Person Field')
  })

  it('shows multiValue checkbox when type is constrained in create modal', async () => {
    const wrapper = mount(FieldDefinitionManager)
    // Open create modal
    const addBtn = wrapper.findAll('button').find(b => b.text().includes('Add Field'))
    await addBtn.trigger('click')

    // Change type to constrained
    const select = wrapper.find('select')
    await select.setValue('constrained')

    // Check for "Allow multiple values" checkbox
    expect(wrapper.text()).toContain('Allow multiple values')
  })

  it('does not show multiValue checkbox for non-constrained types', async () => {
    const wrapper = mount(FieldDefinitionManager)
    const addBtn = wrapper.findAll('button').find(b => b.text().includes('Add Field'))
    await addBtn.trigger('click')

    // free-text is the default
    expect(wrapper.text()).not.toContain('Allow multiple values')
  })
})
