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
    bigRock: 'MaaS',
    targetVersions: ['2.20'],
    fixVersion: '2.20-EA1',
    effectivePriorityScore: 72,
    priorityScoreFallback: false,
    dataSource: 'strat-creator',
    confidence: 'committed',
    readinessGates: {
      ownerAssigned: true,
      notBlocked: true,
      pastRefinement: true,
      hasTargetVersion: true,
      noBlockingViolations: true
    },
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
    confidence: 'ready',
    readinessGates: {
      ownerAssigned: true,
      notBlocked: true,
      pastRefinement: true,
      hasTargetVersion: true,
      noBlockingViolations: true
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

    it('shows Jira status in status column', () => {
      const wrapper = mountRow(makeFeature({ status: 'In Progress' }))
      expect(wrapper.text()).toContain('In Progress')
    })

    it('shows recommendation label', () => {
      const wrapper = mountRow(makeFeature({ recommendation: 'approve' }))
      expect(wrapper.text()).toContain('Approve')
    })

    it('shows Refinement status', () => {
      const wrapper = mountRow(makeFeature({ status: 'Refinement' }))
      expect(wrapper.text()).toContain('Refinement')
    })

    it('shows dash for missing status', () => {
      const wrapper = mountRow(makeFeature({ status: null }))
      expect(wrapper.text()).toContain('—')
    })
  })

  describe('health-pipeline features', () => {
    it('shows "no rubric" italic text instead of RubricScoreBadge', () => {
      const wrapper = mountRow(makeHealthFeature())
      expect(wrapper.text()).toContain('no rubric')
      expect(wrapper.find('.italic').exists()).toBe(true)
    })

    it('shows dash for recommendation when null', () => {
      const wrapper = mountRow(makeHealthFeature({ recommendation: null }))
      const recTd = wrapper.findAll('td').at(11)
      expect(recTd.text()).toBe('—')
    })
  })

  describe('confidence column', () => {
    it('shows "Ready" with green class for committed features', () => {
      const wrapper = mountRow(makeFeature({ confidence: 'committed' }))
      const readinessTd = wrapper.findAll('td').at(2)
      const badge = readinessTd.find('span')
      expect(badge.text()).toBe('Ready')
      expect(badge.classes().some(c => c.includes('green'))).toBe(true)
    })

    it('shows "Ready" with yellow class for ready features', () => {
      const wrapper = mountRow(makeHealthFeature({ confidence: 'ready' }))
      const readinessTd = wrapper.findAll('td').at(2)
      const badge = readinessTd.find('span')
      expect(badge.text()).toBe('Ready')
      expect(badge.classes().some(c => c.includes('yellow'))).toBe(true)
    })

    it('shows "Not Ready" with red class for not-ready features', () => {
      const wrapper = mountRow(makeHealthFeature({ confidence: 'not-ready' }))
      const readinessTd = wrapper.findAll('td').at(2)
      const badge = readinessTd.find('span')
      expect(badge.text()).toBe('Not Ready')
      expect(badge.classes().some(c => c.includes('red'))).toBe(true)
    })

    it('shows confidence tooltip on readiness badge', () => {
      const wrapper = mountRow(makeFeature({ confidence: 'committed' }))
      const readinessTd = wrapper.findAll('td').at(2)
      const badge = readinessTd.find('span')
      expect(badge.attributes('title')).toContain('Committed')
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

    it('does not show tier column', () => {
      const wrapper = mountRow(makeFeature({ tier: 'T2' }))
      const allTds = wrapper.findAll('td')
      const tdsText = allTds.map(td => td.text())
      expect(tdsText).not.toContain('T2')
    })

    it('shows needs-attention indicator', () => {
      const wrapper = mountRow(makeFeature({ needsAttention: true }))
      expect(wrapper.find('[title="Needs attention"]').exists()).toBe(true)
    })

    it('shows score breakdown tooltip when priorityScoreBreakdown is present', () => {
      const breakdown = {
        score: 62,
        rawScore: 88,
        signals: [
          { name: 'Rubric', value: 0.75, weight: 30, raw: 6 },
          { name: 'Priority', value: 0.6, weight: 35, raw: 'Major' }
        ],
        signalCount: 2,
        maxSignals: 4,
        completenessMultiplier: 0.7,
        missing: ['Tier', 'Target Version']
      }
      const wrapper = mountRow(makeFeature({
        effectivePriorityScore: 62,
        priorityScoreFallback: true,
        priorityScoreBreakdown: breakdown
      }))
      const scoreTd = wrapper.findAll('td').at(1)
      const scoreSpan = scoreTd.find('span')
      const title = scoreSpan.attributes('title')
      expect(title).toContain('Score: 62 / 100')
      expect(title).toContain('Rubric')
      expect(title).toContain('Priority')
      expect(title).toContain('0.7')
      expect(title).toContain('Missing')
    })

    it('shows simple tooltip when no breakdown available', () => {
      const wrapper = mountRow(makeFeature({
        effectivePriorityScore: 72,
        priorityScoreFallback: false,
        priorityScoreBreakdown: null
      }))
      const scoreTd = wrapper.findAll('td').at(1)
      const scoreSpan = scoreTd.find('span')
      expect(scoreSpan.attributes('title')).toBe('Computed priority score')
    })
  })
})
