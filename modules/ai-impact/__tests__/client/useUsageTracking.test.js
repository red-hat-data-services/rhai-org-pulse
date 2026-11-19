import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref, nextTick } from 'vue'

vi.mock('@shared/client/services/usageTracking.js', () => ({ trackUsage: vi.fn() }))
import { trackUsage } from '@shared/client/services/usageTracking.js'
import { useUsageTracking } from '../../client/composables/useUsageTracking.js'

function mountView(options, template = '<div><a id="jira" href="https://redhat.atlassian.net/browse/SECRET-1">x</a><button id="b" data-track="button:export">e</button><a id="in" href="#/ai-impact/autofix">i</a></div>') {
  return mount({ template, setup() { useUsageTracking(options); return {} } }, { attachTo: document.body })
}

describe('useUsageTracking', () => {
  beforeEach(() => {
    trackUsage.mockClear()
    window.location.hash = '#/ai-impact/rfe-review'
  })

  it('reports which control changed, never its value', async () => {
    const status = ref('all'), multi = ref([]), search = ref(''), selected = ref(null), charts = ref(true)
    const w = mountView({ filter: { status, multi }, search, open: { rfe: selected }, toggle: { charts } })

    status.value = 'open'; multi.value.push('a'); search.value = 'my secret query'; selected.value = { key: 'SECRET-1' }; charts.value = false
    await nextTick()
    search.value = 'my secret query 2'; status.value = 'all' // same search, reset: not reported
    await nextTick()

    expect(trackUsage.mock.calls.map(c => c.slice(0, 2))).toEqual([
      ['filter', 'status'], ['filter', 'multi'], ['search', undefined], ['open', 'rfe'], ['button', 'charts'],
    ])
    expect(JSON.stringify(trackUsage.mock.calls)).not.toMatch(/secret/i)
    w.unmount()
  })

  it('reports outbound links by host kind, data-track clicks, and ignores in-app links', () => {
    const w = mountView()
    for (const id of ['jira', 'b', 'in']) document.getElementById(id).click()
    expect(trackUsage.mock.calls.map(c => c.slice(0, 2))).toEqual([['link', 'jira'], ['button', 'export']])
    w.unmount()
    document.body.click()
    expect(trackUsage).toHaveBeenCalledTimes(2)
  })

  it('reports movement between views, and widgets under their own page', () => {
    mountView().unmount()
    window.location.hash = '#/ai-impact/autofix'
    const v = mountView()
    expect(trackUsage).toHaveBeenLastCalledWith('nav', 'from-rfe-review')
    v.unmount()

    trackUsage.mockClear()
    const widget = mountView({ page: 'ai-impact::sotu/x' }, '<div><button id="wb" data-track="button:go">g</button></div>')
    const other = mountView({ page: 'ai-impact::sotu/y' }, '<div>other</div>')
    document.getElementById('wb').click()
    expect(trackUsage.mock.calls).toEqual([
      ['view', undefined, 'ai-impact::sotu/x'], ['view', undefined, 'ai-impact::sotu/y'], ['button', 'go', 'ai-impact::sotu/x'],
    ])
    widget.unmount(); other.unmount()
  })
})
