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
    },
    nightly: {
      fetchedAt: '2026-10-13T11:53:15.000Z',
      source: 'ec-cve-run-tool (RHEL errata filtered, Konflux Clair scan)',
      versions: [
        {
          id: 'rhoai-3.6',
          tag: 'v3.6',
          summary: {
            imageCount: 2,
            gradeDistribution: { A: 1, D: 1 },
            critical: 0,
            important: 4,
            staleImageCount: 1
          },
          components: [
            {
              name: 'AI Core Dashboard',
              summary: { imageCount: 1, worstGrade: 'A', oldestImageAgeDays: 0 },
              images: [
                {
                  name: 'odh-dashboard-nightly-rhel9',
                  grade: 'A',
                  gradeDate: '2026-10-13',
                  vulnerabilityCount: 0,
                  lastUpdated: '2026-10-13',
                  ageDays: 0,
                  scanNote: 'Nightly scan completed'
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

  it('toggles Nightly builds and shows nightly-specific ec-cve-run-tool grading copy', async () => {
    const wrapper = mountReport()
    await flushPromises()

    const nightlyBtn = wrapper.findAll('button').find(b => b.text() === 'Nightly builds')
    expect(nightlyBtn).toBeTruthy()
    await nightlyBtn.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('ec-cve-run-tool')
    expect(wrapper.text()).toContain('rhel-vex')
    expect(wrapper.text()).toContain('RHEL errata filtering')
    // Nightly tooltip should NOT show the Konflux on-push clair-scan copy
    expect(wrapper.text()).not.toContain('Konflux builds uses official')
    expect(wrapper.text()).not.toContain('on-push run')
  })

  it('nightly version dropdown shows nightly versions regardless of activeStreams', async () => {
    // activeStreams only lists rhoai-2.25 and rhoai-3.5 (no rhoai-3.6),
    // but nightly has rhoai-3.6. The nightly tab must bypass the filter
    // so rhoai-3.6 still appears in the version dropdown.
    const wrapper = mountReport()
    await flushPromises()

    const nightlyBtn = wrapper.findAll('button').find(b => b.text() === 'Nightly builds')
    await nightlyBtn.trigger('click')
    await flushPromises()

    const select = wrapper.find('#chi-version')
    expect(select.exists()).toBe(true)
    const options = select.findAll('option')
    expect(options.length).toBeGreaterThan(0)
    expect(options.some(o => o.element.value === 'rhoai-3.6')).toBe(true)
  })

  it('nightly image table shows Scan note column', async () => {
    const wrapper = mountReport()
    await flushPromises()

    const nightlyBtn = wrapper.findAll('button').find(b => b.text() === 'Nightly builds')
    await nightlyBtn.trigger('click')
    await flushPromises()

    const compBtn = wrapper.findAll('button').find(b => b.text().includes('AI Core Dashboard'))
    await compBtn.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Scan note')
    expect(wrapper.text()).toContain('Nightly scan completed')
  })

  it('sorts version IDs numerically with the newest version first', async () => {
    const numericFixture = structuredClone(fixture)
    numericFixture.environments.nightly.versions = [
      { id: 'rhoai-3.9', tag: 'v3.9', summary: {}, components: [] },
      { id: 'rhoai-3.10', tag: 'v3.10', summary: {}, components: [] }
    ]
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => numericFixture
    })

    const wrapper = mountReport()
    await flushPromises()

    const nightlyBtn = wrapper.findAll('button').find(b => b.text() === 'Nightly builds')
    await nightlyBtn.trigger('click')
    await flushPromises()

    const options = wrapper.find('#chi-version').findAll('option')
    expect(options.map(option => option.element.value)).toEqual(['rhoai-3.10', 'rhoai-3.9'])
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
