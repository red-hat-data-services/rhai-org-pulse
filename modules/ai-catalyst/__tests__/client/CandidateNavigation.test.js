import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import Board from '../../client/views/Board.vue'
import ReportView from '../../client/views/ReportView.vue'
import { apiRequest } from '@shared/client/services/api'

vi.mock('@shared/client/services/api', () => ({ apiRequest: vi.fn() }))

describe('legacy candidate navigation', () => {
  it.each([
    ['board', Board, 'CandidateCard'],
    ['report', ReportView, 'ReportHighlightCards'],
  ])('uses the source link from the %s when the producer ID is blank', async (_name, component, child) => {
    const candidate = { uniqueId: '', title: 'Legacy project', link: 'https://github.com/org/legacy', category: 'model-inference', source: 'github', impactScore: 8 }
    const nav = { navigateTo: vi.fn(), params: { value: {} } }
    apiRequest.mockImplementation(async url => url.endsWith('/boards')
      ? { boards: [{ month: '2026-04', candidateCount: 1 }] }
      : { candidates: [candidate], pillars: [], total: 1 })
    const wrapper = mount(component, { global: {
      provide: { moduleNav: nav },
      stubs: { ImpactFeasibilityChart: true, CategoryDonutChart: true, SourceBarChart: true, LanguageBarChart: true },
    } })
    await flushPromises()

    wrapper.findComponent({ name: child }).vm.$emit('select', candidate)

    expect(nav.navigateTo).toHaveBeenCalledWith('candidate-detail', { id: 'https://github.com/org/legacy', month: '2026-04' })
    wrapper.unmount()
  })
})
