import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import PersonLookupWidget from '../../../client/widgets/PersonLookupWidget.vue'

const mockRosterData = ref({
  orgs: [
    {
      key: 'org1',
      teams: {
        'Team Alpha': {
          displayName: 'Team Alpha',
          members: [
            { uid: 'jdoe', name: 'Jane Doe', title: 'Senior Engineer' },
            { uid: 'jsmith', name: 'John Smith', title: 'Manager' }
          ]
        },
        'Team Beta': {
          displayName: 'Team Beta',
          members: [
            { uid: 'abrown', name: 'Alice Brown', title: 'Staff Engineer' },
            { uid: 'jdoe', name: 'Jane Doe', title: 'Senior Engineer' } // duplicate
          ]
        }
      }
    }
  ]
})

const mockLoadRoster = vi.fn()
const mockCrossNavigate = vi.fn()

vi.mock('@shared/client/composables/useRoster.js', () => ({
  useRoster: () => ({
    rosterData: mockRosterData,
    loading: ref(false),
    loadRoster: mockLoadRoster
  })
}))

vi.mock('@shared/client/composables/useModuleLink.js', () => ({
  useModuleLink: () => ({
    navigateTo: mockCrossNavigate
  })
}))

describe('PersonLookupWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders in half size', () => {
    const wrapper = mount(PersonLookupWidget, { props: { size: 'half' } })
    expect(wrapper.find('h3').text()).toBe('Person Lookup')
    expect(wrapper.find('input').exists()).toBe(true)
  })

  it('renders in full size', () => {
    const wrapper = mount(PersonLookupWidget, { props: { size: 'full' } })
    expect(wrapper.find('h3').text()).toBe('Person Lookup')
  })

  it('loads roster on mount', () => {
    mount(PersonLookupWidget)
    expect(mockLoadRoster).toHaveBeenCalled()
  })

  it('shows no dropdown when search is empty', () => {
    const wrapper = mount(PersonLookupWidget)
    expect(wrapper.find('ul').exists()).toBe(false)
  })

  it('filters people by name on input', async () => {
    const wrapper = mount(PersonLookupWidget)
    const input = wrapper.find('input')
    await input.setValue('Jane')
    await input.trigger('input')
    // Dropdown should appear with Jane Doe (deduplicated)
    const options = wrapper.findAll('li[role="option"]')
    expect(options.length).toBe(1)
    expect(options[0].text()).toContain('Jane Doe')
  })

  it('filters people by title', async () => {
    const wrapper = mount(PersonLookupWidget)
    const input = wrapper.find('input')
    await input.setValue('Manager')
    await input.trigger('input')
    const options = wrapper.findAll('li[role="option"]')
    expect(options.length).toBe(1)
    expect(options[0].text()).toContain('John Smith')
  })

  it('deduplicates people across teams', async () => {
    const wrapper = mount(PersonLookupWidget)
    const input = wrapper.find('input')
    await input.setValue('doe')
    await input.trigger('input')
    // Jane Doe appears in both teams but should only show once
    const options = wrapper.findAll('li[role="option"]')
    expect(options.length).toBe(1)
  })

  it('shows team name in results', async () => {
    const wrapper = mount(PersonLookupWidget)
    const input = wrapper.find('input')
    await input.setValue('Alice')
    await input.trigger('input')
    const option = wrapper.find('li[role="option"]')
    expect(option.text()).toContain('Team Beta')
  })

  it('navigates to person-detail on click', async () => {
    const wrapper = mount(PersonLookupWidget)
    const input = wrapper.find('input')
    await input.setValue('John')
    await input.trigger('input')
    const option = wrapper.find('li[role="option"]')
    await option.trigger('mousedown')
    expect(mockCrossNavigate).toHaveBeenCalledWith('team-tracker', 'person-detail', { uid: 'jsmith', from: 'sotu' })
  })

  it('clears search after navigation', async () => {
    const wrapper = mount(PersonLookupWidget)
    const input = wrapper.find('input')
    await input.setValue('John')
    await input.trigger('input')
    const option = wrapper.find('li[role="option"]')
    await option.trigger('mousedown')
    expect(input.element.value).toBe('')
  })

  it('shows no-results message for unmatched search', async () => {
    const wrapper = mount(PersonLookupWidget)
    const input = wrapper.find('input')
    await input.setValue('zzzznonexistent')
    await input.trigger('input')
    expect(wrapper.text()).toContain('No people found matching')
  })

  it('supports keyboard navigation', async () => {
    const wrapper = mount(PersonLookupWidget)
    const input = wrapper.find('input')
    await input.setValue('e') // matches Jane Doe, Alice Brown, John Smith (all have 'e')
    await input.trigger('input')

    await input.trigger('keydown', { key: 'ArrowDown' })
    await input.trigger('keydown', { key: 'Enter' })

    expect(mockCrossNavigate).toHaveBeenCalled()
  })

  it('closes dropdown on Escape', async () => {
    const wrapper = mount(PersonLookupWidget)
    const input = wrapper.find('input')
    await input.setValue('Jane')
    await input.trigger('input')
    expect(wrapper.find('ul').exists()).toBe(true)

    await input.trigger('keydown', { key: 'Escape' })
    expect(wrapper.find('ul').exists()).toBe(false)
  })
})
