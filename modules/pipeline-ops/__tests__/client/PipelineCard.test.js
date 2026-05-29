import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PipelineCard from '../../client/components/PipelineCard.vue'

const PIPELINE = {
  slug: 'rfe-autofixer',
  name: 'RFE Review Pipeline',
  owner: 'jforrester',
  repo: { url: 'https://gitlab.com/example/repo', platform: 'gitlab' },
  schedule: { expectedIntervalMinutes: 720 },
  skillRepos: [{ repo: 'https://github.com/org/skill-repo', branch: 'main', purpose: 'Skills' }],
  health: { healthStatus: 'grey', successRate: null }
}

describe('PipelineCard', () => {
  it('renders pipeline name and owner', () => {
    const wrapper = mount(PipelineCard, { props: { pipeline: PIPELINE } })
    expect(wrapper.text()).toContain('RFE Review Pipeline')
    expect(wrapper.text()).toContain('jforrester')
  })

  it('renders schedule label', () => {
    const wrapper = mount(PipelineCard, { props: { pipeline: PIPELINE } })
    expect(wrapper.text()).toContain('every 12h')
  })

  it('renders platform label', () => {
    const wrapper = mount(PipelineCard, { props: { pipeline: PIPELINE } })
    expect(wrapper.text()).toContain('GitLab')
  })

  it('shows grey status dot when no data', () => {
    const wrapper = mount(PipelineCard, { props: { pipeline: PIPELINE } })
    const dot = wrapper.find('span.rounded-full')
    expect(dot.classes()).toContain('bg-gray-400')
  })

  it('shows green status dot when healthy', () => {
    const p = { ...PIPELINE, health: { healthStatus: 'green', successRate: 95 } }
    const wrapper = mount(PipelineCard, { props: { pipeline: p } })
    const dot = wrapper.find('span.rounded-full')
    expect(dot.classes()).toContain('bg-emerald-400')
  })

  it('emits click event', async () => {
    const wrapper = mount(PipelineCard, { props: { pipeline: PIPELINE } })
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('click')).toBeTruthy()
    expect(wrapper.emitted('click')[0][0]).toEqual(PIPELINE)
  })
})
