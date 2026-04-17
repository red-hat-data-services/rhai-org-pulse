import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TeamCard from '../../client/components/TeamCard.vue'

const baseTeam = {
  name: 'Model Serving',
  org: 'AI Platform',
  memberCount: 12,
  productManagers: ['Jane Doe'],
  engLeads: ['Alice B.'],
  components: ['KServe', 'ModelMesh', 'TrustyAI', 'Caikit'],
  boardUrls: ['https://redhat.atlassian.net/jira/software/c/projects/RHOAIENG/boards/123'],
  rfeCount: 5,
  headcount: {
    byRole: { 'Software Engineer': 8, 'QE': 3, 'Manager': 1 }
  }
}

describe('TeamCard', () => {
  it('renders team name and member count', () => {
    const wrapper = mount(TeamCard, { props: { team: baseTeam } })
    expect(wrapper.text()).toContain('Model Serving')
    expect(wrapper.text()).toContain('12')
  })

  it('renders org name', () => {
    const wrapper = mount(TeamCard, { props: { team: baseTeam } })
    expect(wrapper.text()).toContain('AI Platform')
  })

  it('renders PM and Eng Lead', () => {
    const wrapper = mount(TeamCard, { props: { team: baseTeam } })
    expect(wrapper.text()).toContain('PM:')
    expect(wrapper.text()).toContain('Jane Doe')
    expect(wrapper.text()).toContain('Eng Lead:')
    expect(wrapper.text()).toContain('Alice B.')
  })

  it('does NOT render role breakdown badges', () => {
    const wrapper = mount(TeamCard, { props: { team: baseTeam } })
    // Should not show role counts like "8 Software Engineer"
    expect(wrapper.text()).not.toContain('8 Software Engineer')
    expect(wrapper.text()).not.toContain('3 QE')
    expect(wrapper.text()).not.toContain('1 Manager')
  })

  it('renders component chips (up to 3 + overflow)', () => {
    const wrapper = mount(TeamCard, { props: { team: baseTeam } })
    expect(wrapper.text()).toContain('KServe')
    expect(wrapper.text()).toContain('ModelMesh')
    expect(wrapper.text()).toContain('TrustyAI')
    expect(wrapper.text()).toContain('+1 more')
    expect(wrapper.text()).not.toContain('Caikit')
  })

  it('renders RFE count badge', () => {
    const wrapper = mount(TeamCard, { props: { team: baseTeam } })
    expect(wrapper.text()).toContain('5 open RFEs')
  })

  it('renders board link icon', () => {
    const wrapper = mount(TeamCard, { props: { team: baseTeam } })
    const link = wrapper.find('a[target="_blank"]')
    expect(link.exists()).toBe(true)
    expect(link.attributes('href')).toContain('boards/123')
  })

  it('emits select event on click', async () => {
    const wrapper = mount(TeamCard, { props: { team: baseTeam } })
    await wrapper.trigger('click')
    expect(wrapper.emitted('select')).toHaveLength(1)
    expect(wrapper.emitted('select')[0]).toEqual([baseTeam])
  })

  it('hides PM when not provided', () => {
    const wrapper = mount(TeamCard, { props: { team: { ...baseTeam, productManagers: [] } } })
    expect(wrapper.text()).not.toContain('PM:')
  })

  it('hides RFE badge when count is 0', () => {
    const wrapper = mount(TeamCard, { props: { team: { ...baseTeam, rfeCount: 0 } } })
    expect(wrapper.text()).not.toContain('open RFEs')
  })
})
