import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { mount } from '@vue/test-utils'
import TeamFieldEditor from '../../client/components/TeamFieldEditor.vue'

vi.mock('@shared/client/composables/useTeams', () => ({
  useTeams: () => ({
    demoToast: ref(null),
    updateTeamFields: vi.fn().mockResolvedValue({})
  })
}))

const constrainedField = {
  id: 'field_c1', label: 'Status', type: 'constrained', multiValue: false,
  required: false, visible: true, deleted: false, allowedValues: ['Active', 'Forming', 'Sunset']
}

const multiValueField = {
  id: 'field_mv1', label: 'Tags', type: 'constrained', multiValue: true,
  required: false, visible: true, deleted: false, allowedValues: ['Frontend', 'Backend', 'Infra']
}

const freeTextField = {
  id: 'field_ft1', label: 'Notes', type: 'free-text', multiValue: false,
  required: false, visible: true, deleted: false, allowedValues: null
}

const requiredField = {
  id: 'field_req1', label: 'Priority', type: 'constrained', multiValue: false,
  required: true, visible: true, deleted: false, allowedValues: ['High', 'Low']
}

describe('TeamFieldEditor', () => {
  it('renders visible fields', () => {
    const wrapper = mount(TeamFieldEditor, {
      props: {
        teamId: 'team_abc',
        metadata: { field_c1: 'Active' },
        fieldDefinitions: [constrainedField, freeTextField],
        canEdit: false
      }
    })
    expect(wrapper.text()).toContain('Status')
    expect(wrapper.text()).toContain('Active')
    expect(wrapper.text()).toContain('Notes')
  })

  it('renders select dropdown for single-value constrained', async () => {
    const wrapper = mount(TeamFieldEditor, {
      props: {
        teamId: 'team_abc',
        metadata: { field_c1: 'Active' },
        fieldDefinitions: [constrainedField],
        canEdit: true
      }
    })
    await wrapper.find('button').trigger('click')
    expect(wrapper.find('select').exists()).toBe(true)
  })

  it('renders checkbox group for multi-value constrained', async () => {
    const wrapper = mount(TeamFieldEditor, {
      props: {
        teamId: 'team_abc',
        metadata: { field_mv1: ['Frontend', 'Backend'] },
        fieldDefinitions: [multiValueField],
        canEdit: true
      }
    })
    await wrapper.find('button').trigger('click')
    const checkboxes = wrapper.findAll('input[type="checkbox"]')
    expect(checkboxes.length).toBe(3)
  })

  it('shows required field asterisk', () => {
    const wrapper = mount(TeamFieldEditor, {
      props: {
        teamId: 'team_abc',
        metadata: {},
        fieldDefinitions: [requiredField],
        canEdit: false
      }
    })
    expect(wrapper.text()).toContain('*')
  })

  it('displays multi-value as pill badges', () => {
    const wrapper = mount(TeamFieldEditor, {
      props: {
        teamId: 'team_abc',
        metadata: { field_mv1: ['Frontend', 'Backend'] },
        fieldDefinitions: [multiValueField],
        canEdit: false
      }
    })
    expect(wrapper.text()).toContain('Frontend')
    expect(wrapper.text()).toContain('Backend')
  })

  it('coerces legacy string value for multi-value field', () => {
    const wrapper = mount(TeamFieldEditor, {
      props: {
        teamId: 'team_abc',
        metadata: { field_mv1: 'Frontend' },
        fieldDefinitions: [multiValueField],
        canEdit: false
      }
    })
    expect(wrapper.text()).toContain('Frontend')
  })
})
