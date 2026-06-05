import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ForYouCard from '../../client/components/ForYouCard.vue'

function makeItem(overrides = {}) {
  return {
    type: 'rfe',
    key: 'RHAIRFE-100',
    summary: 'Test item summary',
    components: ['Platform Core'],
    priority: 'High',
    labels: [],
    created: '2026-03-01T00:00:00Z',
    state: { id: 'needs-revision', label: 'Needs Revision', color: 'red', order: 0 },
    waitDays: 5,
    scores: null,
    ...overrides
  }
}

describe('ForYouCard', () => {
  it('renders key and truncated summary', () => {
    const wrapper = mount(ForYouCard, {
      props: { item: makeItem() }
    })
    expect(wrapper.text()).toContain('RHAIRFE-100')
    expect(wrapper.text()).toContain('Test item summary')
  })

  it('applies red accent for red state', () => {
    const wrapper = mount(ForYouCard, {
      props: { item: makeItem({ state: { id: 'needs-revision', label: 'Needs Revision', color: 'red', order: 0 } }) }
    })
    const card = wrapper.find('div')
    expect(card.classes().some(c => c.includes('border-l-red'))).toBe(true)
  })

  it('applies green accent for green state', () => {
    const wrapper = mount(ForYouCard, {
      props: { item: makeItem({ state: { id: 'signed-off', label: 'Signed Off', color: 'green', order: 3 }, type: 'feature' }) }
    })
    const card = wrapper.find('div')
    expect(card.classes().some(c => c.includes('border-l-green'))).toBe(true)
  })

  it('shows component badges', () => {
    const wrapper = mount(ForYouCard, {
      props: { item: makeItem({ components: ['Platform Core', 'ML Models'] }) }
    })
    expect(wrapper.text()).toContain('Platform Core')
    expect(wrapper.text()).toContain('ML Models')
  })

  it('shows wait days badge', () => {
    const wrapper = mount(ForYouCard, {
      props: { item: makeItem({ waitDays: 10 }) }
    })
    expect(wrapper.text()).toContain('10d')
  })

  it('does not show wait badge when waitDays is 0', () => {
    const wrapper = mount(ForYouCard, {
      props: { item: makeItem({ waitDays: 0 }) }
    })
    expect(wrapper.text()).not.toMatch(/\dd\b/)
  })

  it('shows inline feature scores', () => {
    const wrapper = mount(ForYouCard, {
      props: {
        item: makeItem({
          type: 'feature',
          scores: { feasibility: 2, testability: 1, scope: 2, architecture: 1, total: 6 }
        })
      }
    })
    expect(wrapper.text()).toContain('Feasibility')
    expect(wrapper.text()).toContain('6/8')
  })

  it('shows action guidance text', () => {
    const wrapper = mount(ForYouCard, {
      props: { item: makeItem() }
    })
    expect(wrapper.text()).toContain('failed the quality rubric')
  })

  it('emits navigate on click', async () => {
    const item = makeItem()
    const wrapper = mount(ForYouCard, {
      props: { item }
    })
    const navBtn = wrapper.findAll('button').find(b => b.text().includes(item.key))
    await navBtn.trigger('click')
    expect(wrapper.emitted('navigate')).toBeTruthy()
    expect(wrapper.emitted('navigate')[0][0]).toStrictEqual(item)
  })

  it('renders Jira link when jiraHost is provided', () => {
    const wrapper = mount(ForYouCard, {
      props: { item: makeItem(), jiraHost: 'https://jira.example.com' }
    })
    const link = wrapper.find('a')
    expect(link.exists()).toBe(true)
    expect(link.attributes('href')).toBe('https://jira.example.com/browse/RHAIRFE-100')
  })

  it('shows stage hover popup with info icon', () => {
    const wrapper = mount(ForYouCard, {
      props: { item: makeItem() }
    })
    const popupContainer = wrapper.find('.group')
    expect(popupContainer.exists()).toBe(true)
    // info icon SVG is present in the badge
    expect(popupContainer.find('svg').exists()).toBe(true)
    // hover popup text
    expect(popupContainer.text()).toContain('failed the quality rubric')
  })

  it('shows passed-with-caveats hover popup', () => {
    const wrapper = mount(ForYouCard, {
      props: { item: makeItem({ state: { id: 'passed-with-caveats', label: 'Passed with Caveats', color: 'amber', order: 1 } }) }
    })
    const popupContainer = wrapper.find('.group')
    expect(popupContainer.text()).toContain('BOTH rubric-pass AND needs-attention')
  })

  it('truncates long summary', () => {
    const longSummary = 'A'.repeat(130)
    const wrapper = mount(ForYouCard, {
      props: { item: makeItem({ summary: longSummary }) }
    })
    expect(wrapper.text()).toContain('...')
  })
})
