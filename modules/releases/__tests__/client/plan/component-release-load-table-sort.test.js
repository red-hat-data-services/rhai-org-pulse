/**
 * Component-level tests for column sorting in ComponentReleaseLoadTable.
 *
 * Uses @vue/test-utils to mount the component and verify:
 * - Clickable sort headers render correctly
 * - Sort arrows appear/disappear on click
 * - Feature rows reorder when sorted
 * - Sort state emits sort-changed event
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ComponentReleaseLoadTable from '../../../client/plan/components/ComponentReleaseLoadTable.vue'

function makeFeature(overrides) {
  return Object.assign({
    key: 'RHAIENG-1',
    summary: 'Test feature',
    status: 'In Progress',
    colorStatus: 'Green',
    statusSummary: '<p>On track</p>',
    releaseType: 'Feature',
    priority: 'Major',
    isBlocked: false,
    components: ['Dashboard'],
    fixVersions: ['rhoai-3.5'],
    targetVersions: ['rhoai-3.5'],
    assignee: 'Alice',
    pmOwner: 'Bob'
  }, overrides)
}

function makeGroups(features) {
  return [{
    version: 'rhoai-3.5',
    components: [{
      component: 'TestComp',
      requestedFeatures: features,
      committedFeatures: features,
      requestedCount: features.length,
      committedCount: features.length,
      blockedCount: features.filter(function (f) { return f.isBlocked }).length
    }],
    requestedCount: features.length,
    committedCount: features.length,
    blockedCount: 0
  }]
}

function mountTable(props) {
  return mount(ComponentReleaseLoadTable, {
    props: Object.assign({
      groups: makeGroups([
        makeFeature({ key: 'X-3', priority: 'Normal', assignee: 'Charlie' }),
        makeFeature({ key: 'X-1', priority: 'Blocker', assignee: 'Alice' }),
        makeFeature({ key: 'X-2', priority: 'Major', assignee: 'Bob' })
      ]),
      componentLeads: {},
      velocity: null,
      initialSort: { column: null, direction: 'asc' }
    }, props || {})
  })
}

describe('ComponentReleaseLoadTable sorting (component)', function () {
  describe('header rendering', function () {
    it('renders 13 sortable th elements when a component is expanded', async function () {
      var wrapper = mountTable()
      var groupHeader = wrapper.find('tr.cursor-pointer')
      await groupHeader.trigger('click')
      var ths = wrapper.findAll('th')
      expect(ths.length).toBe(13)
    })

    it('all headers have cursor-pointer class', async function () {
      var wrapper = mountTable()
      await wrapper.find('tr.cursor-pointer').trigger('click')
      var ths = wrapper.findAll('th')
      for (var i = 0; i < ths.length; i++) {
        expect(ths[i].classes()).toContain('cursor-pointer')
      }
    })

    it('no sort arrows visible initially', async function () {
      var wrapper = mountTable()
      await wrapper.find('tr.cursor-pointer').trigger('click')
      var svgs = wrapper.findAll('th svg')
      expect(svgs.length).toBe(0)
    })
  })

  describe('sort interaction', function () {
    it('shows sort arrow after clicking a column header', async function () {
      var wrapper = mountTable()
      await wrapper.find('tr.cursor-pointer').trigger('click')
      var ths = wrapper.findAll('th')
      await ths[0].trigger('click')
      var svgs = wrapper.findAll('th svg')
      expect(svgs.length).toBe(1)
    })

    it('emits sort-changed event on header click', async function () {
      var wrapper = mountTable()
      await wrapper.find('tr.cursor-pointer').trigger('click')
      var ths = wrapper.findAll('th')
      await ths[0].trigger('click')
      var emitted = wrapper.emitted('sort-changed')
      expect(emitted).toBeTruthy()
      expect(emitted[0][0]).toEqual({ column: 'key', direction: 'asc' })
    })

    it('emits desc on second click', async function () {
      var wrapper = mountTable()
      await wrapper.find('tr.cursor-pointer').trigger('click')
      var ths = wrapper.findAll('th')
      await ths[0].trigger('click')
      await ths[0].trigger('click')
      var emitted = wrapper.emitted('sort-changed')
      expect(emitted[1][0]).toEqual({ column: 'key', direction: 'desc' })
    })

    it('emits null column on third click (clear)', async function () {
      var wrapper = mountTable()
      await wrapper.find('tr.cursor-pointer').trigger('click')
      var ths = wrapper.findAll('th')
      await ths[0].trigger('click')
      await ths[0].trigger('click')
      await ths[0].trigger('click')
      var emitted = wrapper.emitted('sort-changed')
      expect(emitted[2][0]).toEqual({ column: null, direction: 'asc' })
    })

    it('reorders features when sorted by key ascending', async function () {
      var wrapper = mountTable()
      await wrapper.find('tr.cursor-pointer').trigger('click')
      var ths = wrapper.findAll('th')
      await ths[0].trigger('click')
      var links = wrapper.findAll('a')
      var keys = links.map(function (l) { return l.text() })
      expect(keys).toEqual(['X-1', 'X-2', 'X-3'])
    })

    it('reorders features when sorted by key descending', async function () {
      var wrapper = mountTable()
      await wrapper.find('tr.cursor-pointer').trigger('click')
      var ths = wrapper.findAll('th')
      await ths[0].trigger('click')
      await ths[0].trigger('click')
      var links = wrapper.findAll('a')
      var keys = links.map(function (l) { return l.text() })
      expect(keys).toEqual(['X-3', 'X-2', 'X-1'])
    })

    it('restores original order after clearing sort', async function () {
      var wrapper = mountTable()
      await wrapper.find('tr.cursor-pointer').trigger('click')
      var ths = wrapper.findAll('th')
      await ths[0].trigger('click')
      await ths[0].trigger('click')
      await ths[0].trigger('click')
      var links = wrapper.findAll('a')
      var keys = links.map(function (l) { return l.text() })
      expect(keys).toEqual(['X-3', 'X-1', 'X-2'])
    })
  })

  describe('initialSort prop', function () {
    it('applies initial sort on mount', async function () {
      var wrapper = mountTable({ initialSort: { column: 'key', direction: 'asc' } })
      await wrapper.find('tr.cursor-pointer').trigger('click')
      var links = wrapper.findAll('a')
      var keys = links.map(function (l) { return l.text() })
      expect(keys).toEqual(['X-1', 'X-2', 'X-3'])
    })

    it('shows sort arrow for initial sort column', async function () {
      var wrapper = mountTable({ initialSort: { column: 'key', direction: 'asc' } })
      await wrapper.find('tr.cursor-pointer').trigger('click')
      var svgs = wrapper.findAll('th svg')
      expect(svgs.length).toBe(1)
    })
  })

  describe('expandAll / collapseAll', function () {
    it('expandAll exposes all component features', async function () {
      var wrapper = mountTable()
      wrapper.vm.expandAll()
      await wrapper.vm.$nextTick()
      var links = wrapper.findAll('a')
      expect(links.length).toBeGreaterThan(0)
    })

    it('collapseAll hides all features', async function () {
      var wrapper = mountTable()
      wrapper.vm.expandAll()
      wrapper.vm.collapseAll()
      await wrapper.vm.$nextTick()
      var links = wrapper.findAll('a')
      expect(links.length).toBe(0)
    })
  })
})
