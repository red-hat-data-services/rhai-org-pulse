import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import FeatureReadinessDrawer from '../../client/components/FeatureReadinessDrawer.vue'

function makeStratFeature(overrides = {}) {
  return {
    key: 'RHAISTRAT-100',
    title: 'Strat Feature',
    priority: 'Major',
    status: 'In Progress',
    size: 'M',
    recommendation: 'approve',
    needsAttention: false,
    humanReviewStatus: 'approved',
    scores: { feasibility: 2, testability: 1, scope: 2, architecture: 1 },
    reviewers: { feasibility: 'approve', testability: 'revise', scope: 'approve', architecture: 'approve' },
    components: ['Dashboard'],
    team: 'Serving',
    bigRock: 'MaaS',
    targetVersions: ['2.20'],
    fixVersion: '2.20-EA1',
    effectivePriorityScore: 72,
    priorityScoreFallback: false,
    blockingDimensions: [],
    actionRequired: null,
    deliveryOwner: null,
    dataSource: 'strat-creator',
    confidence: 'committed',
    readinessGates: {
      ownerAssigned: true,
      notBlocked: true,
      pastRefinement: true,
      hasTargetVersion: true,
      noBlockingViolations: true
    },
    violations: null,
    ...overrides
  }
}

function makeHealthFeature(overrides = {}) {
  return {
    key: 'AIPCC-200',
    title: 'AIPCC Feature',
    priority: 'Major',
    status: 'Planning',
    size: 'L',
    recommendation: null,
    needsAttention: false,
    humanReviewStatus: null,
    scores: {},
    reviewers: {},
    components: ['Inference'],
    team: 'ModelServing',
    bigRock: 'AIPCC Serving',
    targetVersions: ['2.20'],
    fixVersion: null,
    effectivePriorityScore: 55,
    priorityScoreFallback: true,
    blockingDimensions: [],
    actionRequired: null,
    deliveryOwner: 'Jane Smith',
    dataSource: 'health-pipeline',
    confidence: 'ready',
    readinessGates: {
      ownerAssigned: true,
      notBlocked: true,
      pastRefinement: true,
      hasTargetVersion: true,
      noBlockingViolations: true
    },
    violations: null,
    ...overrides
  }
}

function mountDrawer(feature) {
  return mount(FeatureReadinessDrawer, {
    props: { feature, jiraBaseUrl: 'https://issues.redhat.com/browse' },
    global: { stubs: { Teleport: true, Transition: true } }
  })
}

describe('FeatureReadinessDrawer', () => {
  describe('closed state', () => {
    it('renders nothing when feature is null', () => {
      const wrapper = mountDrawer(null)
      expect(wrapper.find('aside').exists()).toBe(false)
    })
  })

  describe('confidence badge', () => {
    it('shows green Ready badge for committed features', () => {
      const wrapper = mountDrawer(makeStratFeature({ confidence: 'committed' }))
      const headerDiv = wrapper.find('.flex.flex-wrap')
      const badges = headerDiv.findAll('span')
      const readyBadge = badges.find(b => b.text() === 'Ready' && b.classes().some(c => c.includes('green')))
      expect(readyBadge).toBeTruthy()
    })

    it('shows yellow Ready badge for ready features', () => {
      const wrapper = mountDrawer(makeHealthFeature({ confidence: 'ready' }))
      const headerDiv = wrapper.find('.flex.flex-wrap')
      const badges = headerDiv.findAll('span')
      const readyBadge = badges.find(b => b.text() === 'Ready' && b.classes().some(c => c.includes('yellow')))
      expect(readyBadge).toBeTruthy()
    })

    it('shows red Not Ready badge for not-ready features', () => {
      const wrapper = mountDrawer(makeHealthFeature({ confidence: 'not-ready' }))
      const headerDiv = wrapper.find('.flex.flex-wrap')
      const badges = headerDiv.findAll('span')
      const readyBadge = badges.find(b => b.text() === 'Not Ready' && b.classes().some(c => c.includes('red')))
      expect(readyBadge).toBeTruthy()
    })

    it('shows confidence tooltip on badge', () => {
      const wrapper = mountDrawer(makeStratFeature({ confidence: 'committed' }))
      const headerDiv = wrapper.find('.flex.flex-wrap')
      const badges = headerDiv.findAll('span')
      const readyBadge = badges.find(b => b.attributes('title') && b.attributes('title').includes('Committed'))
      expect(readyBadge).toBeTruthy()
    })
  })

  describe('tier removed', () => {
    it('does not show tier badge in header', () => {
      const wrapper = mountDrawer(makeStratFeature({ tier: 'T1' }))
      const headerDiv = wrapper.find('.flex.flex-wrap')
      expect(headerDiv.text()).not.toContain('T1')
    })
  })

  describe('strat-creator features', () => {
    it('shows humanReviewStatus badge', () => {
      const wrapper = mountDrawer(makeStratFeature({ humanReviewStatus: 'approved' }))
      expect(wrapper.text()).toContain('Approved')
    })

    it('shows recommendation badge', () => {
      const wrapper = mountDrawer(makeStratFeature({ recommendation: 'approve' }))
      expect(wrapper.text()).toContain('Approve')
    })

    it('does not show "Health Pipeline" badge', () => {
      const wrapper = mountDrawer(makeStratFeature())
      expect(wrapper.text()).not.toContain('Health Pipeline')
    })

    it('shows rubric section with dimension bars', () => {
      const wrapper = mountDrawer(makeStratFeature())
      expect(wrapper.text()).toContain('Rubric')
      expect(wrapper.text()).toContain('feasibility')
      expect(wrapper.text()).toContain('testability')
      expect(wrapper.text()).toContain('scope')
      expect(wrapper.text()).toContain('architecture')
    })

    it('shows rubric total', () => {
      const wrapper = mountDrawer(makeStratFeature({
        scores: { feasibility: 2, testability: 1, scope: 2, architecture: 1 }
      }))
      expect(wrapper.text()).toContain('6 / 8')
    })

    it('shows Data Source as Strategy Creator', () => {
      const wrapper = mountDrawer(makeStratFeature())
      expect(wrapper.text()).toContain('Strategy Creator')
    })
  })

  describe('health-pipeline features', () => {
    it('shows "Health Pipeline" badge', () => {
      const wrapper = mountDrawer(makeHealthFeature())
      expect(wrapper.text()).toContain('Health Pipeline')
    })

    it('does not show humanReviewStatus or recommendation badges in header', () => {
      const wrapper = mountDrawer(makeHealthFeature())
      const headerDiv = wrapper.find('.flex.flex-wrap')
      expect(headerDiv.text()).not.toContain('Awaiting Sign-off')
    })

    it('does not show rubric section', () => {
      const wrapper = mountDrawer(makeHealthFeature())
      expect(wrapper.text()).not.toContain('Rubric')
      expect(wrapper.text()).not.toContain('feasibility')
    })

    it('shows delivery owner in details section', () => {
      const wrapper = mountDrawer(makeHealthFeature({ deliveryOwner: 'Jane Smith' }))
      expect(wrapper.text()).toContain('Delivery Owner')
    })

    it('shows Data Source in details section', () => {
      const wrapper = mountDrawer(makeHealthFeature())
      expect(wrapper.text()).toContain('Data Source')
    })

    it('shows current status next to refinement gate', () => {
      const wrapper = mountDrawer(makeHealthFeature({ status: 'Planning' }))
      const gateSection = wrapper.findAll('section').find(s => s.text().includes('Readiness Gates'))
      expect(gateSection.text()).toContain('Planning')
    })
  })

  describe('readiness gates (all features)', () => {
    it('shows readiness gates section for strat-creator features', () => {
      const wrapper = mountDrawer(makeStratFeature())
      expect(wrapper.text()).toContain('Readiness Gates')
    })

    it('shows readiness gates section for health-pipeline features', () => {
      const wrapper = mountDrawer(makeHealthFeature())
      expect(wrapper.text()).toContain('Readiness Gates')
    })

    it('shows all five readiness gate labels', () => {
      const wrapper = mountDrawer(makeHealthFeature())
      expect(wrapper.text()).toContain('Owner assigned')
      expect(wrapper.text()).toContain('No blockers')
      expect(wrapper.text()).toContain('Status beyond Refinement')
      expect(wrapper.text()).toContain('Target version assigned')
      expect(wrapper.text()).toContain('No blocking hygiene violations')
    })

    it('shows filled circle for passing gates and empty circle for failing gates', () => {
      const wrapper = mountDrawer(makeHealthFeature({
        readinessGates: { ownerAssigned: true, notBlocked: false, pastRefinement: true, hasTargetVersion: false, noBlockingViolations: true }
      }))
      const gateSection = wrapper.findAll('section').find(s => s.text().includes('Readiness Gates'))
      const gateItems = gateSection.findAll('.flex.items-center.gap-2')
      const indicators = gateItems.map(item => item.findAll('span')[0].text())
      expect(indicators).toEqual(['●', '○', '●', '○', '●'])
    })

    it('shows green class for passing gates', () => {
      const wrapper = mountDrawer(makeHealthFeature())
      const gateSection = wrapper.findAll('section').find(s => s.text().includes('Readiness Gates'))
      const firstIndicator = gateSection.findAll('.flex.items-center.gap-2')[0].findAll('span')[0]
      expect(firstIndicator.classes().some(c => c.includes('green'))).toBe(true)
    })

    it('shows red class for failing gates', () => {
      const wrapper = mountDrawer(makeHealthFeature({
        readinessGates: { ownerAssigned: false, notBlocked: true, pastRefinement: true, hasTargetVersion: true, noBlockingViolations: true }
      }))
      const gateSection = wrapper.findAll('section').find(s => s.text().includes('Readiness Gates'))
      const firstIndicator = gateSection.findAll('.flex.items-center.gap-2')[0].findAll('span')[0]
      expect(firstIndicator.classes().some(c => c.includes('red'))).toBe(true)
    })

    it('shows delivery owner in readiness gates section', () => {
      const wrapper = mountDrawer(makeHealthFeature({ deliveryOwner: 'Jane Smith' }))
      const gateSection = wrapper.findAll('section').find(s => s.text().includes('Readiness Gates'))
      expect(gateSection.text()).toContain('Jane Smith')
    })
  })

  describe('hygiene section', () => {
    it('shows "All clear" badge when no violations', () => {
      const wrapper = mountDrawer(makeStratFeature({ violations: [] }))
      expect(wrapper.text()).toContain('Hygiene')
      expect(wrapper.text()).toContain('All clear')
    })

    it('shows violation count badge when violations exist', () => {
      const wrapper = mountDrawer(makeStratFeature({
        violations: [
          { id: 'missing-assignee', name: 'Missing Assignee', category: 'ownership', message: 'No assignee' },
          { id: 'missing-target-version', name: 'Missing Target', category: 'metadata', message: 'No target' }
        ]
      }))
      expect(wrapper.text()).toContain('Hygiene')
      expect(wrapper.text()).toContain('2')
    })

    it('renders violations grouped by category', () => {
      const wrapper = mountDrawer(makeStratFeature({
        violations: [
          { id: 'missing-assignee', name: 'Missing Assignee', category: 'ownership', message: 'No assignee set' },
          { id: 'stale-status', name: 'Stale Status', category: 'timeliness', message: 'Status is stale' }
        ]
      }))
      expect(wrapper.text()).toContain('Ownership')
      expect(wrapper.text()).toContain('Missing Assignee')
      expect(wrapper.text()).toContain('Timeliness')
      expect(wrapper.text()).toContain('Stale Status')
    })

    it('shows "All checks passing" when violations is empty array', () => {
      const wrapper = mountDrawer(makeHealthFeature({ violations: [] }))
      expect(wrapper.text()).toContain('All checks passing')
    })

    it('shows hygiene section for null violations', () => {
      const wrapper = mountDrawer(makeStratFeature({ violations: null }))
      expect(wrapper.text()).toContain('Hygiene')
      expect(wrapper.text()).toContain('All clear')
    })
  })

  describe('common behavior', () => {
    it('emits close when close button is clicked', async () => {
      const wrapper = mountDrawer(makeStratFeature())
      const closeBtn = wrapper.find('button[aria-label="Close detail panel"]')
      await closeBtn.trigger('click')
      expect(wrapper.emitted('close')).toBeTruthy()
    })

    it('shows Jira link with correct href', () => {
      const wrapper = mountDrawer(makeStratFeature({ key: 'RHAISTRAT-42' }))
      const link = wrapper.find('a')
      expect(link.attributes('href')).toBe('https://issues.redhat.com/browse/RHAISTRAT-42')
    })

    it('shows priority score with tilde for fallback', () => {
      const wrapper = mountDrawer(makeHealthFeature({ effectivePriorityScore: 55, priorityScoreFallback: true }))
      expect(wrapper.text()).toContain('~55')
    })

    it('shows fallback explanation text for estimated scores', () => {
      const wrapper = mountDrawer(makeHealthFeature({ priorityScoreFallback: true }))
      expect(wrapper.text()).toContain('tier + priority')
    })

    it('shows pipeline explanation text for non-fallback scores', () => {
      const wrapper = mountDrawer(makeStratFeature({ priorityScoreFallback: false }))
      expect(wrapper.text()).toContain('From prioritization pipeline')
    })
  })

  describe('score breakdown section', () => {
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

    it('shows Score Breakdown header when breakdown is present', () => {
      const wrapper = mountDrawer(makeStratFeature({
        priorityScoreFallback: true,
        priorityScoreBreakdown: breakdown
      }))
      expect(wrapper.text()).toContain('Score Breakdown')
    })

    it('shows signal count badge when completeness < 1', () => {
      const wrapper = mountDrawer(makeStratFeature({
        priorityScoreFallback: true,
        priorityScoreBreakdown: breakdown
      }))
      expect(wrapper.text()).toContain('2/4 signals')
    })

    it('does not render breakdown section when no breakdown', () => {
      const wrapper = mountDrawer(makeStratFeature({
        priorityScoreFallback: false,
        priorityScoreBreakdown: null
      }))
      expect(wrapper.text()).not.toContain('Score Breakdown')
    })

    it('shows signal names when expanded', async () => {
      const wrapper = mountDrawer(makeStratFeature({
        priorityScoreFallback: true,
        priorityScoreBreakdown: breakdown
      }))
      const buttons = wrapper.findAll('button')
      const breakdownBtn = buttons.find(b => b.text().includes('Score Breakdown'))
      await breakdownBtn.trigger('click')
      expect(wrapper.text()).toContain('Rubric')
      expect(wrapper.text()).toContain('Priority')
    })

    it('shows completeness penalty info when expanded', async () => {
      const wrapper = mountDrawer(makeStratFeature({
        priorityScoreFallback: true,
        priorityScoreBreakdown: breakdown
      }))
      const buttons = wrapper.findAll('button')
      const breakdownBtn = buttons.find(b => b.text().includes('Score Breakdown'))
      await breakdownBtn.trigger('click')
      expect(wrapper.text()).toContain('completeness')
      expect(wrapper.text()).toContain('0.7')
    })

    it('shows missing signals when expanded', async () => {
      const wrapper = mountDrawer(makeStratFeature({
        priorityScoreFallback: true,
        priorityScoreBreakdown: breakdown
      }))
      const buttons = wrapper.findAll('button')
      const breakdownBtn = buttons.find(b => b.text().includes('Score Breakdown'))
      await breakdownBtn.trigger('click')
      expect(wrapper.text()).toContain('Missing')
      expect(wrapper.text()).toContain('Tier')
      expect(wrapper.text()).toContain('Target Version')
    })
  })
})
