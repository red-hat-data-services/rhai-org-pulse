import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BigRockRow from '../../../client/plan/components/BigRockRow.vue'

function makeRock(overrides) {
  return Object.assign({
    name: 'MaaS',
    fullName: 'Model as a Service (continue from 3.4)',
    pillar: 'AI',
    priority: 1,
    owner: 'Sarah Chen',
    architect: 'David Kim',
    featureCount: 5,
    rfeCount: 3,
    outcomeKeys: ['RHOAI-100', 'RHOAI-101'],
    outcomeDescriptions: { 'RHOAI-100': 'Improve model serving', 'RHOAI-101': 'GPU sharing' }
  }, overrides || {})
}

function makeHealth(overrides) {
  return Object.assign({
    worstLevel: 'yellow',
    totalFlags: 2,
    featureCount: 5,
    dorPassedCount: 4,
    dodPassedCount: 3
  }, overrides || {})
}

function makeRockFeatures() {
  return [
    { key: 'F-1', level: 'green', flagCount: 0, flagCategories: [], summary: '', deliveryOwner: '', jiraUrl: '', override: null, dorPassed: true, dodPassed: true, planningStatus: '', status: '' },
    { key: 'F-2', level: 'green', flagCount: 0, flagCategories: [], summary: '', deliveryOwner: '', jiraUrl: '', override: null, dorPassed: true, dodPassed: true, planningStatus: '', status: '' },
    { key: 'F-3', level: 'yellow', flagCount: 1, flagCategories: ['DOR'], summary: '', deliveryOwner: '', jiraUrl: '', override: null, dorPassed: true, dodPassed: false, planningStatus: '', status: '' },
    { key: 'F-4', level: 'green', flagCount: 0, flagCategories: [], summary: '', deliveryOwner: '', jiraUrl: '', override: null, dorPassed: true, dodPassed: true, planningStatus: '', status: '' },
    { key: 'F-5', level: 'red', flagCount: 2, flagCategories: ['BLOCKED', 'MILESTONE_MISS'], summary: '', deliveryOwner: '', jiraUrl: '', override: null, dorPassed: false, dodPassed: false, planningStatus: '', status: '' }
  ]
}

function mountRow(props) {
  return mount(BigRockRow, {
    props: Object.assign({
      rock: makeRock(),
      jiraBaseUrl: 'https://issues.redhat.com',
      hasHealth: true,
      health: makeHealth(),
      rockFeatures: makeRockFeatures(),
      canEdit: false,
      expanded: false
    }, props || {})
  })
}

describe('BigRockRow', function() {
  describe('column structure', function() {
    it('renders 9 td elements when health is shown', function() {
      var wrapper = mountRow()
      var tds = wrapper.findAll('td')
      expect(tds.length).toBe(9)
    })

    it('renders 6 td elements when health is not shown', function() {
      var wrapper = mountRow({ hasHealth: false })
      var tds = wrapper.findAll('td')
      expect(tds.length).toBe(6)
    })
  })

  describe('merged Big Rock + Outcomes cell', function() {
    it('shows rock name', function() {
      var wrapper = mountRow()
      expect(wrapper.text()).toContain('MaaS')
    })

    it('does not show fullName supporting text', function() {
      var wrapper = mountRow()
      expect(wrapper.text()).not.toContain('continue from 3.4')
    })

    it('shows outcome keys and descriptions', function() {
      var wrapper = mountRow()
      expect(wrapper.text()).toContain('RHOAI-100')
      expect(wrapper.text()).toContain('Improve model serving')
      expect(wrapper.text()).toContain('RHOAI-101')
      expect(wrapper.text()).toContain('GPU sharing')
    })

    it('shows TBD when no outcomes', function() {
      var wrapper = mountRow({ rock: makeRock({ outcomeKeys: [] }) })
      expect(wrapper.text()).toContain('TBD')
    })

    it('renders outcome keys as links', function() {
      var wrapper = mountRow()
      var links = wrapper.findAll('a').filter(function(a) { return a.text() === 'RHOAI-100' })
      expect(links.length).toBe(1)
      expect(links[0].attributes('href')).toContain('RHOAI-100')
    })
  })

  describe('merged Owners cell', function() {
    it('shows PM tag with owner name', function() {
      var wrapper = mountRow()
      expect(wrapper.text()).toContain('PM')
      expect(wrapper.text()).toContain('Sarah Chen')
    })

    it('shows Eng. Lead tag with architect name', function() {
      var wrapper = mountRow()
      expect(wrapper.text()).toContain('Eng. Lead')
      expect(wrapper.text()).toContain('David Kim')
    })

    it('shows dash when owner is missing', function() {
      var wrapper = mountRow({ rock: makeRock({ owner: '' }) })
      var spans = wrapper.findAll('span').filter(function(s) { return s.text() === '-' })
      expect(spans.length).toBeGreaterThan(0)
    })
  })

  describe('merged Features / RFEs cell', function() {
    it('shows feature count with label', function() {
      var wrapper = mountRow()
      expect(wrapper.text()).toContain('5')
      expect(wrapper.text()).toContain('Features')
    })

    it('shows RFE count with label', function() {
      var wrapper = mountRow()
      expect(wrapper.text()).toContain('3')
      expect(wrapper.text()).toContain('RFEs')
    })
  })

  describe('health badge', function() {
    it('shows "At Risk" label for yellow level', function() {
      var wrapper = mountRow()
      expect(wrapper.text()).toContain('At Risk')
    })

    it('shows "OK" label for green level', function() {
      var wrapper = mountRow({ health: makeHealth({ worstLevel: 'green' }) })
      expect(wrapper.text()).toContain('OK')
    })

    it('shows "Critical" label for red level', function() {
      var wrapper = mountRow({ health: makeHealth({ worstLevel: 'red' }) })
      expect(wrapper.text()).toContain('Critical')
    })

    it('shows dash when health is null', function() {
      var wrapper = mountRow({ health: null, rockFeatures: [] })
      expect(wrapper.text()).toContain('-')
    })
  })

  describe('expand/collapse behavior', function() {
    it('emits toggle-expand when badge is clicked in read-only mode', async function() {
      var wrapper = mountRow({ canEdit: false })
      var badge = wrapper.find('[role="button"]')
      await badge.trigger('click')
      expect(wrapper.emitted('toggle-expand')).toBeDefined()
    })

    it('emits toggle-expand when badge is clicked in edit mode too', async function() {
      var wrapper = mountRow({ canEdit: true })
      var badge = wrapper.find('[role="button"]')
      await badge.trigger('click')
      expect(wrapper.emitted('toggle-expand')).toBeDefined()
    })

    it('shows chevron in both modes', function() {
      var readOnly = mountRow({ canEdit: false })
      expect(readOnly.findAll('svg').length).toBeGreaterThan(0)
      var editable = mountRow({ canEdit: true })
      expect(editable.find('[role="button"] svg').exists()).toBe(true)
    })

    it('has aria-expanded attribute on badge', function() {
      var wrapper = mountRow({ expanded: true })
      var badge = wrapper.find('[role="button"]')
      expect(badge.attributes('aria-expanded')).toBe('true')
    })

    it('rotates chevron when expanded', function() {
      var wrapper = mountRow({ expanded: true, canEdit: false })
      var svg = wrapper.find('[role="button"] svg')
      expect(svg.classes()).toContain('rotate-90')
    })

    it('shows cursor-pointer on health badge in both modes', function() {
      var readOnly = mountRow({ canEdit: false })
      var badge = readOnly.find('[role="button"]')
      expect(badge.classes()).toContain('cursor-pointer')

      var editable = mountRow({ canEdit: true })
      var editBadge = editable.find('[role="button"]')
      expect(editBadge.classes()).toContain('cursor-pointer')
    })
  })
})
