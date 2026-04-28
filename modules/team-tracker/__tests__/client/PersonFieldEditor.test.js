import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { mount } from '@vue/test-utils'
import PersonFieldEditor from '../../client/components/PersonFieldEditor.vue'

// Mock the composable
vi.mock('@shared/client/composables/useFieldDefinitions', () => ({
  useFieldDefinitions: () => ({
    demoToast: ref(null),
    updatePersonFields: vi.fn().mockResolvedValue({})
  })
}))

const freeTextField = {
  id: 'field_ft1', label: 'Focus Area', type: 'free-text', multiValue: false,
  required: false, visible: true, deleted: false, allowedValues: null
}

const constrainedField = {
  id: 'field_c1', label: 'Component', type: 'constrained', multiValue: false,
  required: false, visible: true, deleted: false, allowedValues: ['Platform', 'UI', 'Backend']
}

const multiValueField = {
  id: 'field_mv1', label: 'Skills', type: 'constrained', multiValue: true,
  required: false, visible: true, deleted: false, allowedValues: ['Go', 'Rust', 'Python', 'Java', 'JS']
}

const multiValueLargeField = {
  id: 'field_mv2', label: 'Tags', type: 'constrained', multiValue: true,
  required: false, visible: true, deleted: false,
  allowedValues: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']
}

const requiredField = {
  id: 'field_req1', label: 'Role', type: 'constrained', multiValue: false,
  required: true, visible: true, deleted: false, allowedValues: ['BE', 'FE']
}

const deletedField = {
  id: 'field_del', label: 'Deleted', type: 'free-text', multiValue: false,
  required: false, visible: true, deleted: true, allowedValues: null
}

const hiddenField = {
  id: 'field_hid', label: 'Hidden', type: 'free-text', multiValue: false,
  required: false, visible: false, deleted: false, allowedValues: null
}

describe('PersonFieldEditor', () => {
  it('renders visible fields', () => {
    const wrapper = mount(PersonFieldEditor, {
      props: {
        uid: 'achen',
        customFields: { field_ft1: 'backend' },
        fieldDefinitions: [freeTextField, constrainedField],
        canEdit: false
      }
    })
    expect(wrapper.text()).toContain('Focus Area')
    expect(wrapper.text()).toContain('Component')
    expect(wrapper.text()).toContain('backend')
  })

  it('hides deleted fields', () => {
    const wrapper = mount(PersonFieldEditor, {
      props: {
        uid: 'achen',
        customFields: {},
        fieldDefinitions: [freeTextField, deletedField],
        canEdit: false
      }
    })
    expect(wrapper.text()).toContain('Focus Area')
    expect(wrapper.text()).not.toContain('Deleted')
  })

  it('hides invisible fields', () => {
    const wrapper = mount(PersonFieldEditor, {
      props: {
        uid: 'achen',
        customFields: {},
        fieldDefinitions: [freeTextField, hiddenField],
        canEdit: false
      }
    })
    expect(wrapper.text()).not.toContain('Hidden')
  })

  it('renders select dropdown for single-value constrained', async () => {
    const wrapper = mount(PersonFieldEditor, {
      props: {
        uid: 'achen',
        customFields: { field_c1: 'Platform' },
        fieldDefinitions: [constrainedField],
        canEdit: true
      }
    })
    await wrapper.find('button').trigger('click') // Edit button
    expect(wrapper.find('select').exists()).toBe(true)
    expect(wrapper.findAll('option').length).toBe(4) // 3 values + empty option
  })

  it('renders checkbox group for multi-value constrained with <=8 options', async () => {
    const wrapper = mount(PersonFieldEditor, {
      props: {
        uid: 'achen',
        customFields: { field_mv1: ['Go', 'Rust'] },
        fieldDefinitions: [multiValueField],
        canEdit: true
      }
    })
    await wrapper.find('button').trigger('click') // Edit button
    const checkboxes = wrapper.findAll('input[type="checkbox"]')
    expect(checkboxes.length).toBe(5) // 5 options
  })

  it('renders combobox for multi-value constrained with 9+ options', async () => {
    const wrapper = mount(PersonFieldEditor, {
      props: {
        uid: 'achen',
        customFields: { field_mv2: ['A', 'B'] },
        fieldDefinitions: [multiValueLargeField],
        canEdit: true
      }
    })
    await wrapper.find('button').trigger('click') // Edit button
    // Should render a select dropdown for adding values (not checkboxes)
    expect(wrapper.find('select').exists()).toBe(true)
  })

  it('shows required field asterisk', () => {
    const wrapper = mount(PersonFieldEditor, {
      props: {
        uid: 'achen',
        customFields: {},
        fieldDefinitions: [requiredField],
        canEdit: false
      }
    })
    expect(wrapper.text()).toContain('*')
  })

  it('displays multi-value as pill badges', () => {
    const wrapper = mount(PersonFieldEditor, {
      props: {
        uid: 'achen',
        customFields: { field_mv1: ['Go', 'Rust', 'Python'] },
        fieldDefinitions: [multiValueField],
        canEdit: false
      }
    })
    expect(wrapper.text()).toContain('Go')
    expect(wrapper.text()).toContain('Rust')
    expect(wrapper.text()).toContain('Python')
  })

  it('truncates multi-value display with +N more', () => {
    const wrapper = mount(PersonFieldEditor, {
      props: {
        uid: 'achen',
        customFields: { field_mv1: ['Go', 'Rust', 'Python', 'Java', 'JS'] },
        fieldDefinitions: [multiValueField],
        canEdit: false
      }
    })
    expect(wrapper.text()).toContain('+2')
  })

  it('coerces legacy string value for multi-value field display', () => {
    const wrapper = mount(PersonFieldEditor, {
      props: {
        uid: 'achen',
        customFields: { field_mv1: 'Go' }, // string instead of array
        fieldDefinitions: [multiValueField],
        canEdit: false
      }
    })
    expect(wrapper.text()).toContain('Go')
  })

  it('coerces legacy array value for single-value field display', () => {
    const wrapper = mount(PersonFieldEditor, {
      props: {
        uid: 'achen',
        customFields: { field_c1: ['Platform', 'UI'] }, // array instead of string
        fieldDefinitions: [constrainedField],
        canEdit: false
      }
    })
    expect(wrapper.text()).toContain('Platform')
  })

  it('renders nothing when no fields defined', () => {
    const wrapper = mount(PersonFieldEditor, {
      props: {
        uid: 'achen',
        customFields: {},
        fieldDefinitions: [],
        canEdit: false
      }
    })
    expect(wrapper.text()).toBe('')
  })
})
