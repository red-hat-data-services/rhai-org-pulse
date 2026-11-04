import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick, ref } from 'vue'
import ExecuteView from '../../../client/views/ExecuteView.vue'

vi.mock('../../../client/execute/views/ExecuteWorkspaceView.vue', function() {
  return {
    default: {
      name: 'ExecuteWorkspaceView',
      props: ['viewMode'],
      emits: ['update:viewMode'],
      template: '<div data-testid="feature-execution-workspace">Feature Execution · {{ viewMode }}</div>'
    }
  }
})

vi.mock('../../../client/execute/views/TechDebtPrioritizationView.vue', function() {
  return {
    default: {
      name: 'TechDebtPrioritizationView',
      template: '<div data-testid="tech-debt-prioritization">Tech Debt Prioritization</div>'
    }
  }
})

function mountExecuteView(params) {
  const paramsRef = ref(params || {})
  const updateParams = vi.fn()
  const wrapper = mount(ExecuteView, {
    global: {
      provide: {
        moduleNav: {
          params: paramsRef,
          updateParams
        }
      }
    }
  })
  return { wrapper, paramsRef, updateParams }
}

describe('ExecuteView tabs', function() {
  beforeEach(function() {
    vi.clearAllMocks()
  })

  it('shows Feature Execution first and Tech Debt Prioritization second', function() {
    const { wrapper } = mountExecuteView()
    const labels = wrapper.findAll('[role="tab"]').map(function(tab) { return tab.text() })

    expect(labels).toEqual(['Feature Execution', 'Tech Debt Prioritization'])
    expect(wrapper.get('[data-testid="feature-execution-workspace"]').isVisible()).toBe(true)
    expect(wrapper.find('[data-testid="tech-debt-prioritization"]').exists()).toBe(false)
  })

  it('opens Tech Debt from its canonical deep link', function() {
    const { wrapper } = mountExecuteView({ tab: 'tech-debt-prioritization' })

    expect(wrapper.get('[data-testid="execute-tab-tech-debt-prioritization"]').attributes('aria-selected')).toBe('true')
    expect(wrapper.get('[data-testid="tech-debt-prioritization"]').isVisible()).toBe(true)
    expect(wrapper.find('[data-testid="feature-execution-workspace"]').exists()).toBe(false)
  })

  it('keeps each workspace instance alive after it has been opened', async function() {
    const { wrapper, updateParams } = mountExecuteView()

    await wrapper.get('[data-testid="execute-tab-tech-debt-prioritization"]').trigger('click')
    await nextTick()
    expect(updateParams).toHaveBeenLastCalledWith({ tab: 'tech-debt-prioritization', view: undefined })
    const techDebtInstance = wrapper.getComponent({ name: 'TechDebtPrioritizationView' }).vm

    await wrapper.get('[data-testid="execute-tab-feature-execution"]').trigger('click')
    await nextTick()
    await wrapper.get('[data-testid="execute-tab-tech-debt-prioritization"]').trigger('click')
    await nextTick()

    expect(wrapper.getComponent({ name: 'TechDebtPrioritizationView' }).vm).toBe(techDebtInstance)
  })

  it('uses the view parameter for Feature Execution modes', async function() {
    const { wrapper, updateParams } = mountExecuteView({ tab: 'feature-execution', view: 'signals', version: '3.5' })
    await nextTick()

    expect(wrapper.get('[data-testid="feature-execution-workspace"]').text()).toContain('signals')

    wrapper.getComponent({ name: 'ExecuteWorkspaceView' }).vm.$emit('update:viewMode', 'board')
    await nextTick()

    expect(updateParams).toHaveBeenLastCalledWith({ tab: 'feature-execution', view: 'board' })
  })

  it.each([
    ['feature-tracking', 'table', undefined],
    ['feature-list', 'signals', 'signals'],
    ['feature-status', 'board', 'board']
  ])('normalizes legacy %s links to Feature Execution', async function(legacyTab, expectedMode, expectedView) {
    const { wrapper, updateParams } = mountExecuteView({ tab: legacyTab, version: '3.5' })
    await nextTick()

    expect(wrapper.get('[data-testid="feature-execution-workspace"]').text()).toContain(expectedMode)
    expect(updateParams).toHaveBeenCalledWith({
      tab: 'feature-execution',
      view: expectedView
    }, { push: false })
  })

  it('responds to top-level tab changes from the URL', async function() {
    const { wrapper, paramsRef } = mountExecuteView({ tab: 'feature-execution' })

    paramsRef.value = { tab: 'tech-debt-prioritization', version: '3.5' }
    await nextTick()
    await nextTick()

    expect(wrapper.get('[data-testid="execute-tab-tech-debt-prioritization"]').attributes('aria-selected')).toBe('true')
    expect(wrapper.get('[data-testid="tech-debt-prioritization"]').isVisible()).toBe(true)
  })
})
