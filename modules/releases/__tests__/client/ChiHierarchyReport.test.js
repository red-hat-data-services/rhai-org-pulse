import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import ChiHierarchyReport from '../../client/reports/ChiHierarchyReport.vue'

const fixture = {
  fetchedAt: '2026-09-30T18:00:00.000Z',
  activeStreams: ['rhoai-2.25', 'rhoai-3.5'],
  environments: {
    prod: {
      fetchedAt: '2026-09-30T18:00:00.000Z',
      source: 'catalog.redhat.com',
      versions: [
        {
          id: 'rhoai-3.5',
          tag: 'v3.5',
          summary: {
            imageCount: 2,
            gradeDistribution: { A: 1, B: 1 },
            critical: 0,
            important: 11,
            staleImageCount: 1
          },
          components: [
            {
              name: 'AI Core Dashboard',
              summary: {
                imageCount: 1,
                worstGrade: 'B',
                critical: 0,
                important: 11,
                oldestImageAgeDays: 9
              },
              images: [
                {
                  name: 'odh-dashboard-rhel9',
                  grade: 'B',
                  gradeDate: '2026-09-21',
                  vulnerabilityCount: 21,
                  lastUpdated: '2026-09-21',
                  ageDays: 9,
                  catalogUrl: 'https://catalog.redhat.com/software/containers/rhoai/odh-dashboard-rhel9'
                }
              ]
            },
            {
              name: 'Unmapped',
              summary: {
                imageCount: 1,
                worstGrade: 'D',
                oldestImageAgeDays: 40
              },
              images: [
                {
                  name: 'odh-example-stale-rhel9',
                  grade: 'D',
                  gradeDate: '2026-08-01',
                  vulnerabilityCount: 8,
                  lastUpdated: '2026-08-21',
                  ageDays: 40
                }
              ]
            }
          ]
        }
      ]
    },
    stage: {
      fetchedAt: '2026-09-30T17:30:00.000Z',
      source: 'pyxis.stage.engineering.redhat.com',
      versions: [
        {
          id: 'rhoai-3.5',
          tag: 'v3.5',
          summary: {
            imageCount: 1,
            gradeDistribution: { B: 1 },
            critical: 0,
            important: 6,
            staleImageCount: 0
          },
          components: [
            {
              name: 'AI Core Dashboard',
              summary: { imageCount: 1, worstGrade: 'B', oldestImageAgeDays: 10 },
              images: [
                {
                  name: 'odh-dashboard-rhel9',
                  grade: 'B',
                  gradeDate: '2026-09-20',
                  vulnerabilityCount: 8,
                  lastUpdated: '2026-09-20',
                  ageDays: 10
                }
              ]
            }
          ]
        }
      ]
    },
    latest: {
      fetchedAt: '2026-10-06T09:00:00.000Z',
      source: 'konflux-clair-scan',
      versions: [
        {
          id: 'rhoai-2.25',
          tag: 'v2.25',
          summary: {
            imageCount: 1,
            gradeDistribution: { A: 1, Unknown: 2 },
            critical: 0,
            important: 0,
            staleImageCount: 0
          },
          components: [
            {
              name: 'AI Core Dashboard',
              summary: { imageCount: 1, worstGrade: 'A', oldestImageAgeDays: 0 },
              images: [
                {
                  name: 'odh-dashboard-rhel9',
                  grade: 'A',
                  gradeDate: '2026-10-06',
                  vulnerabilityCount: 0,
                  lastUpdated: '2026-10-06',
                  ageDays: 0,
                  konfluxUrl: 'https://konflux.example/pr/dash'
                }
              ]
            }
          ]
        }
      ]
    }
  }
}

function mountReport() {
  return mount(ChiHierarchyReport, {
    global: {
      provide: {
        moduleNav: { navigateTo: vi.fn(), params: ref({}), updateParams: vi.fn() }
      },
      stubs: {
        ArrowLeft: true,
        ChevronRight: true,
        Shield: true,
        HelpCircle: true
      }
    }
  })
}

describe('ChiHierarchyReport', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => fixture
    })))
  })

  it('loads hierarchy and shows prod summary with versions', async () => {
    const wrapper = mountReport()
    await flushPromises()

    expect(wrapper.text()).toContain('Container Health Index')
    expect(wrapper.text()).toContain('catalog.redhat.com')
    expect(wrapper.text()).toContain('AI Core Dashboard')
    expect(wrapper.find('#chi-version').exists()).toBe(true)
    expect(wrapper.text()).toContain('Stale')
    expect(wrapper.text()).toMatch(/1/)
  })

  it('toggles to stage and updates source summary', async () => {
    const wrapper = mountReport()
    await flushPromises()

    const stageBtn = wrapper.findAll('button').find(b => b.text() === 'Stage')
    expect(stageBtn).toBeTruthy()
    await stageBtn.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('pyxis.stage.engineering.redhat.com')
    expect(wrapper.text()).not.toContain('Unmapped')
  })

  it('expands a component to show image grade and age', async () => {
    const wrapper = mountReport()
    await flushPromises()

    const dashBtn = wrapper.findAll('button').find(b => b.text().includes('AI Core Dashboard'))
    await dashBtn.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('odh-dashboard-rhel9')
    expect(wrapper.text()).toContain('9d')
    expect(wrapper.text()).toContain('Grade date')
  })

  it('marks stale images when ageDays > 14', async () => {
    const wrapper = mountReport()
    await flushPromises()

    const unmappedBtn = wrapper.findAll('button').find(b => b.text().includes('Unmapped'))
    await unmappedBtn.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('odh-example-stale-rhel9')
    expect(wrapper.text()).toContain('stale')
    expect(wrapper.text()).toContain('40d')
  })

  it('toggles Konflux builds and shows Konflux source plus rhel-vex grading copy', async () => {
    const wrapper = mountReport()
    await flushPromises()

    const latestBtn = wrapper.findAll('button').find(b => b.text() === 'Konflux builds')
    expect(latestBtn).toBeTruthy()
    await latestBtn.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('konflux-clair-scan')
    expect(wrapper.text()).toContain('rhel-vex')
    expect(wrapper.text()).toContain('How grades are calculated')
    expect(wrapper.text()).toContain('Konflux builds uses official')
    const unknownChip = wrapper.find('[aria-label="Unknown"]')
    expect(unknownChip.exists()).toBe(true)
    expect(unknownChip.text()).toBe('?')
  })
})
