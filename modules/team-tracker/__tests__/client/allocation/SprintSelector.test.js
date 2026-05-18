import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SprintSelector from '../../../client/components/allocation/SprintSelector.vue'

describe('SprintSelector', () => {
  const mockSprints = [
    { id: 1, name: 'Sprint 10', state: 'active', startDate: '2026-02-03', endDate: '2026-02-14' },
    { id: 2, name: 'Sprint 11', state: 'future', startDate: '2026-02-17', endDate: '2026-02-28' },
    { id: 3, name: 'Sprint 9', state: 'closed', startDate: '2026-01-20', endDate: '2026-01-31' },
    { id: 4, name: 'Sprint 8', state: 'closed', startDate: '2026-01-06', endDate: '2026-01-17' }
  ]

  it('renders a select dropdown', () => {
    const wrapper = mount(SprintSelector, { props: { sprints: mockSprints } })
    expect(wrapper.find('select').exists()).toBe(true)
  })

  it('groups sprints into Active, Future, and Closed optgroups', () => {
    const wrapper = mount(SprintSelector, { props: { sprints: mockSprints } })
    const optgroups = wrapper.findAll('optgroup')
    const labels = optgroups.map(og => og.attributes('label'))
    expect(labels).toContain('Active')
    expect(labels).toContain('Future')
    expect(labels).toContain('Closed')
  })

  it('hides empty optgroups', () => {
    const activeSprints = [
      { id: 1, name: 'Sprint 10', state: 'active', startDate: '2026-02-03', endDate: '2026-02-14' }
    ]
    const wrapper = mount(SprintSelector, { props: { sprints: activeSprints } })
    const optgroups = wrapper.findAll('optgroup')
    const labels = optgroups.map(og => og.attributes('label'))
    expect(labels).toContain('Active')
    expect(labels).not.toContain('Future')
    expect(labels).not.toContain('Closed')
  })

  it('orders closed sprints most recent first', () => {
    const wrapper = mount(SprintSelector, { props: { sprints: mockSprints } })
    const closedGroup = wrapper.findAll('optgroup').find(og => og.attributes('label') === 'Closed')
    const options = closedGroup.findAll('option')
    expect(options[0].text()).toBe('Sprint 9')
    expect(options[1].text()).toBe('Sprint 8')
  })

  it('sets selected sprint via prop', () => {
    const wrapper = mount(SprintSelector, {
      props: { sprints: mockSprints, selectedSprintId: 3 }
    })
    const select = wrapper.find('select')
    expect(select.element.value).toBe('3')
  })

  it('emits select-sprint with Number value on change', async () => {
    const wrapper = mount(SprintSelector, {
      props: { sprints: mockSprints, selectedSprintId: 1 }
    })
    const select = wrapper.find('select')
    await select.setValue('3')
    expect(wrapper.emitted('select-sprint')).toBeTruthy()
    expect(wrapper.emitted('select-sprint')[0]).toEqual([3])
  })

  it('renders sprint names as option text', () => {
    const wrapper = mount(SprintSelector, { props: { sprints: mockSprints } })
    expect(wrapper.text()).toContain('Sprint 10')
    expect(wrapper.text()).toContain('Sprint 11')
    expect(wrapper.text()).toContain('Sprint 9')
    expect(wrapper.text()).toContain('Sprint 8')
  })
})
