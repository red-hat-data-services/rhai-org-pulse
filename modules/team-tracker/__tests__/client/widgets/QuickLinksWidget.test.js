import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import QuickLinksWidget from '../../../client/widgets/QuickLinksWidget.vue'

const mockNavigateTo = vi.fn()
const mockIsManager = ref(false)

vi.mock('@shared/client/composables/useModuleLink', () => ({
  useModuleLink: () => ({
    navigateTo: mockNavigateTo,
    linkTo: vi.fn()
  })
}))

vi.mock('@shared/client/composables/useAuth', () => ({
  useAuth: () => ({
    user: ref({ email: 'test@example.com' }),
    isManager: mockIsManager,
    isAdmin: ref(false)
  })
}))

beforeEach(() => {
  mockNavigateTo.mockClear()
  mockIsManager.value = false
})

describe('QuickLinksWidget', () => {
  it('mounts with size prop and renders header', () => {
    const wrapper = mount(QuickLinksWidget, { props: { size: 'half' } })
    expect(wrapper.text()).toContain('Quick Links')
  })

  it('accepts full size prop', () => {
    const wrapper = mount(QuickLinksWidget, { props: { size: 'full' } })
    expect(wrapper.text()).toContain('Quick Links')
  })

  it('renders only non-manager links for non-managers', () => {
    const wrapper = mount(QuickLinksWidget, { props: { size: 'half' } })
    expect(wrapper.text()).not.toContain('My Teams')
    expect(wrapper.text()).toContain('Team Directory')
    expect(wrapper.text()).toContain('People')
  })

  it('renders all links including My Teams for managers', () => {
    mockIsManager.value = true
    const wrapper = mount(QuickLinksWidget, { props: { size: 'half' } })
    expect(wrapper.text()).toContain('My Teams')
    expect(wrapper.text()).toContain('Team Directory')
    expect(wrapper.text()).toContain('People')
  })

  it('renders link descriptions (non-manager)', () => {
    const wrapper = mount(QuickLinksWidget, { props: { size: 'half' } })
    expect(wrapper.text()).not.toContain('View your full manager dashboard')
    expect(wrapper.text()).toContain('Browse all teams and people')
    expect(wrapper.text()).toContain('Search the people registry')
  })

  it('navigates to manager-dashboard on My Teams click (manager)', async () => {
    mockIsManager.value = true
    const wrapper = mount(QuickLinksWidget, { props: { size: 'half' } })
    const myTeamsBtn = wrapper.findAll('button').find(b => b.text().includes('My Teams'))
    await myTeamsBtn.trigger('click')
    expect(mockNavigateTo).toHaveBeenCalledWith('team-tracker', 'manager-dashboard', { from: 'sotu' })
  })

  it('navigates to home on Team Directory click', async () => {
    const wrapper = mount(QuickLinksWidget, { props: { size: 'half' } })
    const dirBtn = wrapper.findAll('button').find(b => b.text().includes('Team Directory'))
    await dirBtn.trigger('click')
    expect(mockNavigateTo).toHaveBeenCalledWith('team-tracker', 'home', { from: 'sotu' })
  })

  it('navigates to people on People click', async () => {
    const wrapper = mount(QuickLinksWidget, { props: { size: 'half' } })
    const peopleBtn = wrapper.findAll('button').find(b => b.text().includes('People'))
    await peopleBtn.trigger('click')
    expect(mockNavigateTo).toHaveBeenCalledWith('team-tracker', 'people', { from: 'sotu' })
  })

  it('renders SVG icons for each visible link', () => {
    const wrapper = mount(QuickLinksWidget, { props: { size: 'half' } })
    const svgs = wrapper.findAll('svg')
    expect(svgs.length).toBe(2) // Team Directory + People (no manager link)
  })

  it('renders SVG icons for all links when manager', () => {
    mockIsManager.value = true
    const wrapper = mount(QuickLinksWidget, { props: { size: 'half' } })
    const svgs = wrapper.findAll('svg')
    expect(svgs.length).toBe(3)
  })
})
