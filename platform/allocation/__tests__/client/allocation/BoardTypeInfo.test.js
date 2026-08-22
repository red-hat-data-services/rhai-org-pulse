import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BoardTypeInfo from '../../../client/allocation/BoardTypeInfo.vue'

describe('BoardTypeInfo', () => {
  it('labels the board as Scrum by default', () => {
    const wrapper = mount(BoardTypeInfo)
    expect(wrapper.get('[data-testid="board-type-label"]').text()).toBe('Scrum board')
    expect(wrapper.text()).toContain('the issues in the selected sprint')
  })

  it('labels the board as Kanban when boardType is kanban', () => {
    const wrapper = mount(BoardTypeInfo, { props: { boardType: 'kanban' } })
    expect(wrapper.get('[data-testid="board-type-label"]').text()).toBe('Kanban board')
    expect(wrapper.text()).toContain('last 2 weeks')
  })

  it('hides the detailed explanation until toggled', async () => {
    const wrapper = mount(BoardTypeInfo)
    expect(wrapper.find('[data-testid="board-type-info-detail"]').exists()).toBe(false)

    await wrapper.get('[data-testid="board-type-info-toggle"]').trigger('click')
    expect(wrapper.find('[data-testid="board-type-info-detail"]').exists()).toBe(true)
  })

  it('explains the rolling 14-day window for kanban boards', async () => {
    const wrapper = mount(BoardTypeInfo, { props: { boardType: 'kanban' } })
    await wrapper.get('[data-testid="board-type-info-toggle"]').trigger('click')
    expect(wrapper.get('[data-testid="board-type-info-detail"]').text()).toContain('resolved in the past 14 days')
  })

  it('explains sprint-based measurement for scrum boards', async () => {
    const wrapper = mount(BoardTypeInfo, { props: { boardType: 'scrum' } })
    await wrapper.get('[data-testid="board-type-info-toggle"]').trigger('click')
    expect(wrapper.get('[data-testid="board-type-info-detail"]').text()).toContain('the sprint selected above')
  })

  it('reflects expanded state via aria-expanded', async () => {
    const wrapper = mount(BoardTypeInfo)
    const toggle = wrapper.get('[data-testid="board-type-info-toggle"]')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('true')
  })
})
