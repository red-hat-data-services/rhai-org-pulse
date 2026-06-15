import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'

vi.mock('@shared/client/composables/useAuth.js', () => ({
  useAuth: () => ({ user: ref({ email: 'test@redhat.com' }), isManager: ref(false), isAdmin: ref(false) })
}))
vi.mock('@shared/client/composables/useRoster.js', () => ({
  useRoster: () => ({ rosterData: ref(null), loading: ref(false), loadRoster: vi.fn() })
}))
vi.mock('@shared/client/composables/useFieldDefinitions.js', () => ({
  useFieldDefinitions: () => ({ definitions: ref(null), fetchDefinitions: vi.fn() })
}))
vi.mock('../../client/composables/useAIImpact.js', () => ({
  useAIImpact: () => ({ rfeData: ref(null), loading: ref(false) })
}))
vi.mock('../../client/composables/useFeatures.js', () => ({
  useFeatures: () => ({ features: ref({}), featureLoading: ref(false), loadFeatures: vi.fn() })
}))
vi.mock('../../client/composables/useAssessments.js', () => ({
  useAssessments: () => ({ assessments: ref({}), assessmentLoading: ref(false), loadAssessments: vi.fn() })
}))
vi.mock('../../client/composables/useForYouPreferences.js', () => ({
  useForYouPreferences: () => ({
    mode: ref('auto'), manualComponents: ref([]), wizardSeen: ref(true),
    activeTab: ref('actions'), setMode: vi.fn(), setManualComponents: vi.fn(),
    markWizardSeen: vi.fn(), setActiveTab: vi.fn(), resetPreferences: vi.fn()
  }),
  sanitizeComponents: (c) => c
}))

import {
  classifyRfe,
  classifyFeature,
  computeWaitDays,
  resolveUserComponents,
  filterByComponents,
  findPersonByUid,
  RFE_STATES,
  FEATURE_STATES
} from '../../client/composables/useForYou.js'
import { useForYou } from '../../client/composables/useForYou.js'

describe('classifyRfe', () => {
  it('returns null when linkedFeature is present (skipped)', () => {
    const rfe = { labels: [], linkedFeature: { key: 'RHAISTRAT-1' } }
    expect(classifyRfe(rfe)).toBeNull()
  })

  it('returns null even with needs-attention if linkedFeature exists', () => {
    const rfe = { labels: ['rfe-creator-needs-attention'], linkedFeature: { key: 'RHAISTRAT-1' } }
    expect(classifyRfe(rfe)).toBeNull()
  })

  it('returns NEEDS_REVISION when needs-attention without rubric-pass', () => {
    const rfe = { labels: ['rfe-creator-needs-attention'], linkedFeature: null }
    expect(classifyRfe(rfe)).toBe(RFE_STATES.NEEDS_REVISION)
  })

  it('returns PASSED_WITH_CAVEATS when both labels present', () => {
    const rfe = { labels: ['rfe-creator-autofix-rubric-pass', 'rfe-creator-needs-attention'], linkedFeature: null }
    expect(classifyRfe(rfe)).toBe(RFE_STATES.PASSED_WITH_CAVEATS)
  })

  it('returns READY_TO_ADVANCE with rubric-pass but no scope label', () => {
    const rfe = { labels: ['rfe-creator-autofix-rubric-pass'], linkedFeature: null }
    expect(classifyRfe(rfe)).toBe(RFE_STATES.READY_TO_ADVANCE)
  })

  it('returns READY_TO_ADVANCE with tech-reviewed but no scope label', () => {
    const rfe = { labels: ['tech-reviewed'], linkedFeature: null }
    expect(classifyRfe(rfe)).toBe(RFE_STATES.READY_TO_ADVANCE)
  })

  it('returns QUEUED_FOR_PIPELINE with rubric-pass and scope label', () => {
    const rfe = { labels: ['rfe-creator-autofix-rubric-pass', 'strat-creator-3.5'], linkedFeature: null }
    expect(classifyRfe(rfe)).toBe(RFE_STATES.QUEUED_FOR_PIPELINE)
  })

  it('returns NOT_ASSESSED when no pipeline labels', () => {
    const rfe = { labels: [], linkedFeature: null }
    expect(classifyRfe(rfe)).toBe(RFE_STATES.NOT_ASSESSED)
  })

  it('returns NOT_ASSESSED for unrelated labels only', () => {
    const rfe = { labels: ['customer-request', 'strategic'], linkedFeature: null }
    expect(classifyRfe(rfe)).toBe(RFE_STATES.NOT_ASSESSED)
  })
})

describe('classifyFeature', () => {
  it('returns SIGNED_OFF when humanReviewStatus is approved', () => {
    const f = { recommendation: 'approve', humanReviewStatus: 'approved', approvedBy: 'Alice' }
    expect(classifyFeature(f)).toBe(FEATURE_STATES.SIGNED_OFF)
  })

  it('returns SIGNED_OFF when approvedBy is set', () => {
    const f = { recommendation: 'approve', humanReviewStatus: 'awaiting-review', approvedBy: 'Alice' }
    expect(classifyFeature(f)).toBe(FEATURE_STATES.SIGNED_OFF)
  })

  it('returns SIGNED_OFF for revise + approved (human override)', () => {
    const f = { recommendation: 'revise', humanReviewStatus: 'approved' }
    expect(classifyFeature(f)).toBe(FEATURE_STATES.SIGNED_OFF)
  })

  it('returns SIGNED_OFF for reject + approved (human override)', () => {
    const f = { recommendation: 'reject', humanReviewStatus: 'approved' }
    expect(classifyFeature(f)).toBe(FEATURE_STATES.SIGNED_OFF)
  })

  it('returns REJECTED when recommendation is reject', () => {
    const f = { recommendation: 'reject', humanReviewStatus: 'awaiting-review' }
    expect(classifyFeature(f)).toBe(FEATURE_STATES.REJECTED)
  })

  it('returns REVISE_REQUIRED when recommendation is revise', () => {
    const f = { recommendation: 'revise', humanReviewStatus: 'awaiting-review' }
    expect(classifyFeature(f)).toBe(FEATURE_STATES.REVISE_REQUIRED)
  })

  it('returns AWAITING_SIGNOFF when recommendation is approve', () => {
    const f = { recommendation: 'approve', humanReviewStatus: 'awaiting-review' }
    expect(classifyFeature(f)).toBe(FEATURE_STATES.AWAITING_SIGNOFF)
  })

  it('returns unclassified for unknown recommendation', () => {
    const f = { recommendation: 'unknown', humanReviewStatus: 'awaiting-review' }
    const result = classifyFeature(f)
    expect(result.id).toBe('unclassified')
  })
})

describe('computeWaitDays', () => {
  it('uses needsAttentionSince for RFE needs-revision state', () => {
    const now = Date.now()
    const fiveDaysAgo = new Date(now - 5 * 86400000).toISOString()
    const item = { needsAttentionSince: fiveDaysAgo, created: '2020-01-01T00:00:00Z' }
    const state = { id: 'needs-revision' }
    expect(computeWaitDays(item, state, 'rfe')).toBe(5)
  })

  it('uses needsAttentionSince for RFE passed-with-caveats state', () => {
    const now = Date.now()
    const eightDaysAgo = new Date(now - 8 * 86400000).toISOString()
    const item = { needsAttentionSince: eightDaysAgo, created: '2020-01-01T00:00:00Z' }
    const state = { id: 'passed-with-caveats' }
    expect(computeWaitDays(item, state, 'rfe')).toBe(8)
  })

  it('falls back to created for RFE needs-revision when no needsAttentionSince', () => {
    const now = Date.now()
    const tenDaysAgo = new Date(now - 10 * 86400000).toISOString()
    const item = { created: tenDaysAgo }
    const state = { id: 'needs-revision' }
    expect(computeWaitDays(item, state, 'rfe')).toBe(10)
  })

  it('assessedAt alone does not drive waitDays for needs-revision', () => {
    const now = Date.now()
    const twoDaysAgo = new Date(now - 2 * 86400000).toISOString()
    const thirtyDaysAgo = new Date(now - 30 * 86400000).toISOString()
    const item = { assessedAt: twoDaysAgo, needsAttentionSince: thirtyDaysAgo, created: '2020-01-01T00:00:00Z' }
    const state = { id: 'needs-revision' }
    expect(computeWaitDays(item, state, 'rfe')).toBe(30)
  })

  it('uses rubricPassSince for RFE ready-to-advance state', () => {
    const now = Date.now()
    const threeDaysAgo = new Date(now - 3 * 86400000).toISOString()
    const item = { rubricPassSince: threeDaysAgo, created: '2020-01-01T00:00:00Z' }
    const state = { id: 'ready-to-advance' }
    expect(computeWaitDays(item, state, 'rfe')).toBe(3)
  })

  it('uses rubricPassSince for RFE queued-for-pipeline state', () => {
    const now = Date.now()
    const threeDaysAgo = new Date(now - 3 * 86400000).toISOString()
    const item = { rubricPassSince: threeDaysAgo, created: '2020-01-01T00:00:00Z' }
    const state = { id: 'queued-for-pipeline' }
    expect(computeWaitDays(item, state, 'rfe')).toBe(3)
  })

  it('falls back to created for RFE queued-for-pipeline when no rubricPassSince', () => {
    const now = Date.now()
    const threeDaysAgo = new Date(now - 3 * 86400000).toISOString()
    const item = { created: threeDaysAgo }
    const state = { id: 'queued-for-pipeline' }
    expect(computeWaitDays(item, state, 'rfe')).toBe(3)
  })

  it('uses created for RFE not-assessed state', () => {
    const now = Date.now()
    const sixDaysAgo = new Date(now - 6 * 86400000).toISOString()
    const item = { created: sixDaysAgo }
    const state = { id: 'not-assessed' }
    expect(computeWaitDays(item, state, 'rfe')).toBe(6)
  })

  it('uses reviewedAt for features', () => {
    const now = Date.now()
    const twoDaysAgo = new Date(now - 2 * 86400000).toISOString()
    const item = { reviewedAt: twoDaysAgo, created: '2020-01-01T00:00:00Z' }
    const state = { id: 'awaiting-signoff' }
    expect(computeWaitDays(item, state, 'feature')).toBe(2)
  })

  it('returns 0 for missing date', () => {
    expect(computeWaitDays({}, { id: 'test' }, 'rfe')).toBe(0)
  })
})

describe('resolveUserComponents', () => {
  const fieldDefinitions = {
    personFields: [
      { id: 'field_x1', type: 'free-text' },
      { id: 'field_comp', type: 'constrained', optionsRef: 'component', multiValue: true }
    ]
  }

  const rosterData = {
    orgs: [{
      teams: {
        Platform: {
          members: [
            { uid: 'achen', name: 'Alice Chen', customFields: { field_comp: ['Platform Core'] } },
            { uid: 'bsmith', name: 'Bob Smith', customFields: { field_comp: ['ML Models', 'Platform Dashboard'] } }
          ]
        }
      }
    }]
  }

  it('resolves components for a known user', () => {
    const result = resolveUserComponents(rosterData, { email: 'achen@example.com' }, fieldDefinitions)
    expect(result.state).toBe('resolved')
    expect(result.components).toEqual(['Platform Core'])
    expect(result.displayName).toBe('Alice Chen')
  })

  it('resolves array components for multiValue field', () => {
    const result = resolveUserComponents(rosterData, { email: 'bsmith@example.com' }, fieldDefinitions)
    expect(result.state).toBe('resolved')
    expect(result.components).toEqual(['ML Models', 'Platform Dashboard'])
  })

  it('coerces single string to array', () => {
    const roster = {
      orgs: [{
        teams: { T: { members: [{ uid: 'single', name: 'S', customFields: { field_comp: 'Single Component' } }] } }
      }]
    }
    const result = resolveUserComponents(roster, { email: 'single@x.com' }, fieldDefinitions)
    expect(result.components).toEqual(['Single Component'])
  })

  it('returns no-components when field is empty', () => {
    const roster = {
      orgs: [{
        teams: { T: { members: [{ uid: 'empty', name: 'E', customFields: { field_comp: [] } }] } }
      }]
    }
    const result = resolveUserComponents(roster, { email: 'empty@x.com' }, fieldDefinitions)
    expect(result.state).toBe('no-components')
  })

  it('returns not-found for unknown user', () => {
    const result = resolveUserComponents(rosterData, { email: 'nobody@x.com' }, fieldDefinitions)
    expect(result.state).toBe('not-found')
  })

  it('returns not-found when user is null', () => {
    const result = resolveUserComponents(rosterData, null, fieldDefinitions)
    expect(result.state).toBe('not-found')
  })

  it('returns no-components when component field not defined', () => {
    const noCompDefs = { personFields: [{ id: 'f1', type: 'free-text' }] }
    const result = resolveUserComponents(rosterData, { email: 'achen@example.com' }, noCompDefs)
    expect(result.state).toBe('no-components')
  })
})

describe('filterByComponents', () => {
  const items = [
    { key: 'A', components: ['Platform Core'] },
    { key: 'B', components: ['ML Models'] },
    { key: 'C', components: ['Platform Core', 'ML Models'] },
    { key: 'D', components: [] }
  ]

  it('filters items by component intersection', () => {
    const result = filterByComponents(items, ['Platform Core'])
    expect(result.map(i => i.key)).toEqual(['A', 'C'])
  })

  it('returns all items when userComponents is empty', () => {
    const result = filterByComponents(items, [])
    expect(result).toEqual(items)
  })

  it('returns empty array when no overlap', () => {
    const result = filterByComponents(items, ['Nonexistent'])
    expect(result.map(i => i.key)).toEqual([])
  })

  it('handles multi-component user scope', () => {
    const result = filterByComponents(items, ['Platform Core', 'ML Models'])
    expect(result.map(i => i.key)).toEqual(['A', 'B', 'C'])
  })
})

describe('findPersonByUid', () => {
  it('finds person across teams', () => {
    const roster = {
      orgs: [{
        teams: {
          A: { members: [{ uid: 'a1', name: 'A1' }] },
          B: { members: [{ uid: 'b1', name: 'B1' }] }
        }
      }]
    }
    expect(findPersonByUid(roster, 'b1').name).toBe('B1')
  })

  it('returns null when not found', () => {
    expect(findPersonByUid({ orgs: [] }, 'nope')).toBeNull()
  })

  it('handles null roster', () => {
    expect(findPersonByUid(null, 'x')).toBeNull()
  })
})

describe('boardColumns', () => {
  const rosterData = ref({ orgs: [] })
  const user = ref({ email: 'test@example.com' })
  const features = ref({})
  const assessments = ref({})
  const fieldDefinitions = ref({ personFields: [] })

  it('groups items into correct columns', () => {
    const rfeData = ref({
      issues: [
        { key: 'RFE-1', summary: 'A', components: [], labels: ['rfe-creator-needs-attention'], linkedFeature: null, priority: 'High', created: '2025-01-01' },
        { key: 'RFE-2', summary: 'B', components: [], labels: [], linkedFeature: null, priority: 'Medium', created: '2025-01-01' },
        { key: 'RFE-3', summary: 'C', components: [], labels: ['rfe-creator-autofix-rubric-pass'], linkedFeature: null, priority: 'Low', created: '2025-01-01' }
      ]
    })
    const { boardColumns } = useForYou(rosterData, user, rfeData, features, assessments, fieldDefinitions)
    const colMap = Object.fromEntries(boardColumns.value.map(c => [c.id, c]))
    expect(colMap['needs-revision'].items.map(i => i.key)).toEqual(['RFE-1'])
    expect(colMap['not-assessed'].items.map(i => i.key)).toEqual(['RFE-2'])
    expect(colMap['ready-to-advance'].items.map(i => i.key)).toEqual(['RFE-3'])
  })

  it('has all 9 columns', () => {
    const rfeData = ref({ issues: [] })
    const { boardColumns } = useForYou(rosterData, user, rfeData, features, assessments, fieldDefinitions)
    expect(boardColumns.value).toHaveLength(9)
    const ids = boardColumns.value.map(c => c.id)
    expect(ids).toContain('not-assessed')
    expect(ids).toContain('needs-revision')
    expect(ids).not.toContain('strategy-created')
    expect(ids).toContain('signed-off')
  })
})

describe('actionGroups', () => {
  const rosterData = ref({ orgs: [] })
  const user = ref({ email: 'test@example.com' })
  const assessments = ref({})
  const fieldDefinitions = ref({ personFields: [] })

  it('groups action items and hides empty groups', () => {
    const rfeData = ref({
      issues: [
        { key: 'RFE-1', summary: 'A', components: [], labels: ['rfe-creator-needs-attention'], linkedFeature: null, priority: 'High', created: '2025-01-01' },
        { key: 'RFE-2', summary: 'B', components: [], labels: ['rfe-creator-autofix-rubric-pass'], linkedFeature: null, priority: 'Medium', created: '2025-01-01' }
      ]
    })
    const features = ref({})
    const { actionGroups } = useForYou(rosterData, user, rfeData, features, assessments, fieldDefinitions)
    const groupIds = actionGroups.value.map(g => g.id)
    expect(groupIds).toContain('failed-rubric')
    expect(groupIds).toContain('advance-rfes')
    expect(groupIds).not.toContain('passed-with-caveats')
    expect(groupIds).not.toContain('review-features')
  })

  it('separates failed-rubric from passed-with-caveats', () => {
    const rfeData = ref({
      issues: [
        { key: 'RFE-1', summary: 'Failed', components: [], labels: ['rfe-creator-needs-attention'], linkedFeature: null, priority: 'High', created: '2025-01-01' },
        { key: 'RFE-2', summary: 'Caveats', components: [], labels: ['rfe-creator-autofix-rubric-pass', 'rfe-creator-needs-attention'], linkedFeature: null, priority: 'Medium', created: '2025-01-01' }
      ]
    })
    const features = ref({})
    const { actionGroups } = useForYou(rosterData, user, rfeData, features, assessments, fieldDefinitions)
    const groupMap = Object.fromEntries(actionGroups.value.map(g => [g.id, g]))
    expect(groupMap['failed-rubric'].items.map(i => i.key)).toEqual(['RFE-1'])
    expect(groupMap['passed-with-caveats'].items.map(i => i.key)).toEqual(['RFE-2'])
  })

  it('returns empty array when no action items', () => {
    const rfeData = ref({ issues: [] })
    const features = ref({})
    const { actionGroups } = useForYou(rosterData, user, rfeData, features, assessments, fieldDefinitions)
    expect(actionGroups.value).toEqual([])
  })
})

describe('useForYou manual mode', () => {
  const rosterData = ref({ orgs: [] })
  const user = ref({ email: 'testuser@example.com' })
  const rfeData = ref({
    issues: [
      { key: 'RFE-1', summary: 'Test', components: ['Platform Core'], labels: ['rfe-creator-needs-attention'], linkedFeature: null, priority: 'High', created: '2025-01-01' },
      { key: 'RFE-2', summary: 'Other', components: ['ML Models'], labels: [], linkedFeature: null, priority: 'Medium', created: '2025-01-01' }
    ]
  })
  const features = ref({})
  const assessments = ref({})
  const fieldDefinitions = ref({ personFields: [] })

  it('filters items by manual components', () => {
    const mode = ref('manual')
    const manualComponents = ref(['Platform Core'])
    const { classifiedItems, rosterResolutionState } = useForYou(
      rosterData, user, rfeData, features, assessments, fieldDefinitions,
      { mode, manualComponents }
    )
    expect(rosterResolutionState.value).toBe('manual')
    expect(classifiedItems.value.map(i => i.key)).toEqual(['RFE-1'])
  })

  it('shows all items when manual components is empty', () => {
    const mode = ref('manual')
    const manualComponents = ref([])
    const { classifiedItems, rosterResolutionState } = useForYou(
      rosterData, user, rfeData, features, assessments, fieldDefinitions,
      { mode, manualComponents }
    )
    expect(rosterResolutionState.value).toBe('manual-empty')
    expect(classifiedItems.value).toHaveLength(2)
  })

  it('defaults to auto mode when no options provided', () => {
    const { rosterResolutionState } = useForYou(
      rosterData, user, rfeData, features, assessments, fieldDefinitions
    )
    // user not found in empty roster → not-found
    expect(rosterResolutionState.value).toBe('not-found')
  })
})
