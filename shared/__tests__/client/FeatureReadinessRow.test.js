import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import FeatureReadinessRow from '../../client/components/FeatureReadinessRow.vue'

function makeFeature(overrides = {}) {
  return {
    key: 'RHAISTRAT-100',
    title: 'Test Feature',
    priority: 'Major',
    status: 'In Progress',
    size: 'M',
    recommendation: 'approve',
    needsAttention: false,
    humanReviewStatus: 'approved',
    scores: { feasibility: 2, testability: 1, scope: 2, architecture: 1 },
    reviewers: {},
    components: ['Dashboard'],
    team: 'Serving',
    tier: 'T1',
    bigRock: 'MaaS',
    targetVersions: ['2.20'],
    fixVersion: '2.20-EA1',
    effectivePriorityScore: 72,
    priorityScoreFallback: false,
    dataSource: 'strat-creator',
    ...overrides
  }
}

function makeHealthFeature(overrides = {}) {
  return makeFeature({
    key: 'AIPCC-200',
    title: 'AIPCC Feature',
    dataSource: 'health-pipeline',
    recommendation: null,
    humanReviewStatus: null,
    scores: {},
    reviewers: {},
    readinessGates: {
      ownerAssigned: true,
      notBlocked: true,
      pastRefinement: true,
      hasTargetVersion: true
    },
    ...overrides
  })
}

function mountRow(feature, props = {}) {
  const table = document.createElement('table')
  const tbody = document.createElement('tbody')
  table.appendChild(tbody)
  document.body.appendChild(table)

  return mount(FeatureReadinessRow, {
    props: { feature, index: 1, jiraBaseUrl: 'https://issues.redhat.com/browse', ...props },
    attachTo: tbody
  })
}

describe('FeatureReadinessRow', () => {
  describe('strat-creator features', () => {
    it('renders RubricScoreBadge for strat-creator features', () => {
      const wrapper = mountRow(makeFeature())
      expect(wrapper.text()).not.toContain('no rubric')
      expect(wrapper.find('.italic').exists()).toBe(false)
    })

    it('shows humanReviewStatus badge in status column', () => {
      const wrapper = mountRow(makeFeature({ humanReviewStatus: 'approved' }))
      expect(wrapper.text()).toContain('Approved')
    })

    it('shows recommendation label', () => {
      const wrapper = mountRow(makeFeature({ recommendation: 'approve' }))
      expect(wrapper.text()).toContain('Approve')
    })

    it('shows Awaiting Sign-off for awaiting-review status', () => {
      const wrapper = mountRow(makeFeature({ humanReviewStatus: 'awaiting-review' }))
      expect(wrapper.text()).toContain('Awaiting Sign-off')
    })

    it('shows Flagged for needs-review status', () => {
      const wrapper = mountRow(makeFeature({ humanReviewStatus: 'needs-review' }))
      expect(wrapper.text()).toContain('Flagged')
    })
  })

  describe('health-pipeline features', () => {
    it('shows "no rubric" italic text instead of RubricScoreBadge', () => {
      const wrapper = mountRow(makeHealthFeature())
      expect(wrapper.text()).toContain('no rubric')
      expect(wrapper.find('.italic').exists()).toBe(true)
    })

    it('shows "Ready" badge when all gates pass', () => {
      const wrapper = mountRow(makeHealthFeature())
      expect(wrapper.text()).toContain('Ready')
    })

    it('shows "Not Ready" badge when a gate fails', () => {
      const wrapper = mountRow(makeHealthFeature({
        readinessGates: { ownerAssigned: false, notBlocked: true, pastRefinement: true, hasTargetVersion: true }
      }))
      expect(wrapper.text()).toContain('Not Ready')
    })

    it('applies green class to Ready badge', () => {
      const wrapper = mountRow(makeHealthFeature())
      const statusTd = wrapper.findAll('td').at(12)
      const badge = statusTd.findAll('span').find(s => s.text() === 'Ready')
      expect(badge.classes().some(c => c.includes('green'))).toBe(true)
    })

    it('applies amber class to Not Ready badge', () => {
      const wrapper = mountRow(makeHealthFeature({
        readinessGates: { ownerAssigned: false, notBlocked: true, pastRefinement: true, hasTargetVersion: true }
      }))
      const statusTd = wrapper.findAll('td').at(12)
      const badge = statusTd.findAll('span').find(s => s.text() === 'Not Ready')
      expect(badge.classes().some(c => c.includes('amber'))).toBe(true)
    })

    it('shows dash for recommendation when null', () => {
      const wrapper = mountRow(makeHealthFeature({ recommendation: null }))
      const recTd = wrapper.findAll('td').at(11)
      expect(recTd.text()).toBe('—')
    })
  })

  describe('common behavior', () => {
    it('emits select event on row click', async () => {
      const feature = makeFeature()
      const wrapper = mountRow(feature)
      await wrapper.find('tr').trigger('click')
      expect(wrapper.emitted('select')).toBeTruthy()
      expect(wrapper.emitted('select')[0][0]).toEqual(feature)
    })

    it('renders Jira link with correct href', () => {
      const wrapper = mountRow(makeFeature({ key: 'RHAISTRAT-42' }))
      const link = wrapper.find('a')
      expect(link.attributes('href')).toBe('https://issues.redhat.com/browse/RHAISTRAT-42')
      expect(link.text()).toBe('RHAISTRAT-42')
    })

    it('shows tilde prefix for fallback priority score', () => {
      const wrapper = mountRow(makeFeature({ effectivePriorityScore: 55, priorityScoreFallback: true }))
      expect(wrapper.text()).toContain('~55')
    })

    it('shows plain score when not fallback', () => {
      const wrapper = mountRow(makeFeature({ effectivePriorityScore: 72, priorityScoreFallback: false }))
      expect(wrapper.text()).toContain('72')
      expect(wrapper.text()).not.toContain('~72')
    })

    it('shows tier badge', () => {
      const wrapper = mountRow(makeFeature({ tier: 'T2' }))
      expect(wrapper.text()).toContain('T2')
    })

    it('shows needs-attention indicator', () => {
      const wrapper = mountRow(makeFeature({ needsAttention: true }))
      expect(wrapper.find('[title="Needs attention"]').exists()).toBe(true)
    })
  })
})
