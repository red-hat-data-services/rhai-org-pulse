import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref, readonly } from 'vue'
import ReportShell from '../../../client/reports/ReportShell.vue'

const mockNavigateTo = vi.fn()

describe('ReportShell', () => {
  function createWrapper(props = {}, slots = {}) {
    mockNavigateTo.mockClear()
    return mount(ReportShell, {
      props: {
        title: 'Test Report',
        description: 'A test description',
        hasFilters: false,
        ...props,
      },
      slots,
      global: {
        provide: {
          moduleNav: {
            navigateTo: mockNavigateTo,
            goBack: vi.fn(),
            params: readonly(ref({})),
            moduleSlug: readonly(ref('team-tracker')),
          }
        }
      }
    })
  }

  it('renders title and description', () => {
    const wrapper = createWrapper()
    expect(wrapper.text()).toContain('Test Report')
    expect(wrapper.text()).toContain('A test description')
  })

  it('navigates back to reports catalog on back button click', async () => {
    const wrapper = createWrapper()
    await wrapper.find('[data-testid="report-shell-back"]').trigger('click')
    expect(mockNavigateTo).toHaveBeenCalledWith('reports')
  })

  it('renders filter bar when hasFilters is true', () => {
    const wrapper = createWrapper(
      { hasFilters: true },
      { filters: '<div data-testid="filter-content">Filter</div>' }
    )
    expect(wrapper.find('[data-testid="filter-content"]').exists()).toBe(true)
  })

  it('does not render filter bar when hasFilters is false and no filter slot', () => {
    const wrapper = createWrapper({ hasFilters: false })
    // The filter bar div should not appear
    const filterBar = wrapper.findAll('.p-4.mb-6')
    expect(filterBar.length).toBe(0)
  })

  it('renders default slot content', () => {
    const wrapper = createWrapper(
      {},
      { default: '<div data-testid="report-content">Chart here</div>' }
    )
    expect(wrapper.find('[data-testid="report-content"]').exists()).toBe(true)
  })
})
