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
    tier: 'T1',
    bigRock: 'MaaS',
    targetVersions: ['2.20'],
    fixVersion: '2.20-EA1',
    effectivePriorityScore: 72,
    priorityScoreFallback: false,
    blockingDimensions: [],
    actionRequired: null,
    deliveryOwner: null,
    dataSource: 'strat-creator',
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
    tier: 'T1',
    bigRock: 'AIPCC Serving',
    targetVersions: ['2.20'],
    fixVersion: null,
    effectivePriorityScore: 55,
    priorityScoreFallback: true,
    blockingDimensions: [],
    actionRequired: null,
    deliveryOwner: 'Jane Smith',
    dataSource: 'health-pipeline',
    readinessGates: {
      ownerAssigned: true,
      notBlocked: true,
      pastRefinement: true,
      hasTargetVersion: true
    },
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

    it('does not show readiness gates section', () => {
      const wrapper = mountDrawer(makeStratFeature())
      expect(wrapper.text()).not.toContain('Readiness Gates')
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

    it('shows "Ready" badge when all gates pass', () => {
      const wrapper = mountDrawer(makeHealthFeature())
      expect(wrapper.text()).toContain('Ready')
    })

    it('shows "Not Ready" badge when a gate fails', () => {
      const wrapper = mountDrawer(makeHealthFeature({
        readinessGates: { ownerAssigned: false, notBlocked: true, pastRefinement: true, hasTargetVersion: true }
      }))
      expect(wrapper.text()).toContain('Not Ready')
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

    it('shows readiness gates section', () => {
      const wrapper = mountDrawer(makeHealthFeature())
      expect(wrapper.text()).toContain('Readiness Gates')
    })

    it('shows all four readiness gate labels', () => {
      const wrapper = mountDrawer(makeHealthFeature())
      expect(wrapper.text()).toContain('Owner assigned')
      expect(wrapper.text()).toContain('No blockers')
      expect(wrapper.text()).toContain('Status beyond Refinement')
      expect(wrapper.text()).toContain('Target version assigned')
    })

    it('shows filled circle for passing gates and empty circle for failing gates', () => {
      const wrapper = mountDrawer(makeHealthFeature({
        readinessGates: { ownerAssigned: true, notBlocked: false, pastRefinement: true, hasTargetVersion: false }
      }))
      const gateSection = wrapper.findAll('section').find(s => s.text().includes('Readiness Gates'))
      const gateItems = gateSection.findAll('.flex.items-center.gap-2')
      const indicators = gateItems.map(item => item.findAll('span')[0].text())
      expect(indicators).toEqual(['●', '○', '●', '○'])
    })

    it('shows green class for passing gates', () => {
      const wrapper = mountDrawer(makeHealthFeature())
      const gateSection = wrapper.findAll('section').find(s => s.text().includes('Readiness Gates'))
      const firstIndicator = gateSection.findAll('.flex.items-center.gap-2')[0].findAll('span')[0]
      expect(firstIndicator.classes().some(c => c.includes('green'))).toBe(true)
    })

    it('shows red class for failing gates', () => {
      const wrapper = mountDrawer(makeHealthFeature({
        readinessGates: { ownerAssigned: false, notBlocked: true, pastRefinement: true, hasTargetVersion: true }
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
      expect(wrapper.text()).toContain('tier + priority + size')
    })

    it('shows pipeline explanation text for non-fallback scores', () => {
      const wrapper = mountDrawer(makeStratFeature({ priorityScoreFallback: false }))
      expect(wrapper.text()).toContain('From prioritization pipeline')
    })
  })
})
