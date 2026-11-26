import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import RepositoryAccessCard from '../../client/components/RepositoryAccessCard.vue'

const access = {
  write: 8,
  triage: 6,
  total: 45,
  updatedAt: '2026-11-24',
  members: {
    write: ['A one', 'B two', 'C three', 'D four', 'E five', 'F six', 'G seven', 'H eight'],
    triage: ['T one', 'T two', 'T three', 'T four', 'T five', 'T six'],
  },
}

describe('RepositoryAccessCard', () => {
  it('renders counts and the update date', () => {
    const wrapper = mount(RepositoryAccessCard, { props: { access } })

    expect(wrapper.text()).toContain('Repository Access')
    expect(wrapper.text()).toContain('8')
    expect(wrapper.text()).toContain('6')
    expect(wrapper.text()).toContain('/ 45')
    expect(wrapper.text()).toContain('As of')
    expect(wrapper.text()).toContain('2026')
  })

  it('renders grouped members and limits each group to five', () => {
    const wrapper = mount(RepositoryAccessCard, { props: { access } })

    expect(wrapper.text()).toContain('Write access (owners)')
    expect(wrapper.text()).toContain('Triage access')
    expect(wrapper.text()).toContain('A one')
    expect(wrapper.text()).toContain('T one')
    expect(wrapper.text()).not.toContain('F six')
    expect(wrapper.text()).not.toContain('T six')
    expect(wrapper.text()).toContain('Show all 8')
    expect(wrapper.text()).toContain('Show all 6')
  })

  it('expands and collapses a group', async () => {
    const wrapper = mount(RepositoryAccessCard, { props: { access } })
    const buttons = wrapper.findAll('button')

    await buttons[0].trigger('click')
    expect(wrapper.text()).toContain('F six')
    expect(wrapper.text()).toContain('Show less')

    await buttons[0].trigger('click')
    expect(wrapper.text()).not.toContain('F six')
  })

  it('falls back to counts-only when members are absent', () => {
    const wrapper = mount(RepositoryAccessCard, {
      props: { access: { write: 1, triage: 0, total: 2 } },
    })

    expect(wrapper.text()).toContain('Write')
    expect(wrapper.text()).toContain('Triage')
    expect(wrapper.text()).not.toContain('Write access (owners)')
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('falls back to usernames when a display name is absent', () => {
    const wrapper = mount(RepositoryAccessCard, {
      props: {
        access: {
          write: 1,
          triage: 0,
          total: 2,
          members: { write: [{ githubUsername: 'akim' }], triage: [] },
        },
      },
    })

    expect(wrapper.text()).toContain('akim')
  })
})
