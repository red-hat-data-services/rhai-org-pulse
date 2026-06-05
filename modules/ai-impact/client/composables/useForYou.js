import { computed, ref } from 'vue'

const SCOPE_LABEL = 'strat-creator-3.5'

const RFE_STATES = {
  NOT_ASSESSED: { id: 'not-assessed', label: 'Not Yet Assessed', color: 'gray', order: 4 },
  NEEDS_REVISION: { id: 'needs-revision', label: 'Needs Revision', color: 'red', order: 0 },
  PASSED_WITH_CAVEATS: { id: 'passed-with-caveats', label: 'Passed with Caveats', color: 'amber', order: 1 },
  READY_TO_ADVANCE: { id: 'ready-to-advance', label: 'Ready for Feature Creation', color: 'amber', order: 2 },
  QUEUED_FOR_PIPELINE: { id: 'queued-for-pipeline', label: 'Queued for Feature Creation', color: 'blue', order: 3 }
}

const FEATURE_STATES = {
  REJECTED: { id: 'rejected', label: 'RFE Rejected', color: 'red', order: 0 },
  REVISE_REQUIRED: { id: 'revise-required', label: 'Revise Required', color: 'red', order: 1 },
  AWAITING_SIGNOFF: { id: 'awaiting-signoff', label: 'Awaiting Sign-off', color: 'amber', order: 2 },
  SIGNED_OFF: { id: 'signed-off', label: 'Signed Off', color: 'green', order: 3 }
}

function classifyRfe(rfe) {
  const labels = new Set(rfe.labels || [])
  const hasLinkedFeature = !!rfe.linkedFeature
  const hasRubricPass = labels.has('rfe-creator-autofix-rubric-pass')
  const hasNeedsAttention = labels.has('rfe-creator-needs-attention')
  const hasTechReviewed = labels.has('tech-reviewed')
  const hasScopeLabel = labels.has(SCOPE_LABEL)

  // Skip RFEs that already have a linked feature — they're tracked on the feature side
  if (hasLinkedFeature) return null

  // State 1: Needs Revision (needs-attention WITHOUT rubric-pass)
  if (hasNeedsAttention && !hasRubricPass) return RFE_STATES.NEEDS_REVISION

  // State 2: Passed with Caveats (BOTH labels)
  if (hasRubricPass && hasNeedsAttention) return RFE_STATES.PASSED_WITH_CAVEATS

  // State 3: Ready to Advance (quality gate passed, no scope label, no linkedFeature)
  if ((hasRubricPass || hasTechReviewed) && !hasScopeLabel) return RFE_STATES.READY_TO_ADVANCE

  // State 4: Queued for Pipeline (quality gate + scope label, no linkedFeature)
  if ((hasRubricPass || hasTechReviewed) && hasScopeLabel) return RFE_STATES.QUEUED_FOR_PIPELINE

  // State 0: Not Yet Assessed (catch-all)
  return RFE_STATES.NOT_ASSESSED
}

function classifyFeature(feature) {
  const rec = feature.recommendation
  const status = feature.humanReviewStatus
  const hasApproval = status === 'approved' || !!feature.approvedBy

  // Edge cases: human overrode CI
  if (rec === 'revise' && hasApproval) return FEATURE_STATES.SIGNED_OFF
  if (rec === 'reject' && hasApproval) return FEATURE_STATES.SIGNED_OFF

  // State 4: Signed Off
  if (hasApproval) return FEATURE_STATES.SIGNED_OFF

  // State 1: Rejected
  if (rec === 'reject') return FEATURE_STATES.REJECTED

  // State 2: Revise Required
  if (rec === 'revise') return FEATURE_STATES.REVISE_REQUIRED

  // State 3: Awaiting Sign-off
  if (rec === 'approve') return FEATURE_STATES.AWAITING_SIGNOFF

  // Fallback: unclassified
  return { id: 'unclassified', label: 'Unclassified', color: 'gray', order: 6 }
}

function computeWaitDays(item, state, type) {
  let dateStr
  if (type === 'rfe') {
    if (['needs-revision', 'passed-with-caveats', 'ready-to-advance'].includes(state.id)) {
      dateStr = item.assessedAt || item.created
    } else {
      dateStr = item.created
    }
  } else {
    dateStr = item.reviewedAt || item.created
  }
  if (!dateStr) return 0
  const ms = new Date(dateStr).getTime()
  if (Number.isNaN(ms)) return 0
  const diff = Date.now() - ms
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)))
}

const PRIORITY_ORDER = { Blocker: 0, Critical: 1, High: 2, Major: 3, Medium: 4, Normal: 5, Minor: 6, Low: 7, None: 8, Undefined: 9 }

function sortItems(items) {
  return [...items].sort((a, b) => {
    const waitDiff = b.waitDays - a.waitDays
    if (waitDiff !== 0) return waitDiff
    return (PRIORITY_ORDER[a.priority] ?? 10) - (PRIORITY_ORDER[b.priority] ?? 10)
  })
}

function findPersonByUid(rosterData, uid) {
  if (!rosterData?.orgs) return null
  for (const org of rosterData.orgs) {
    if (!org.teams) continue
    for (const team of Object.values(org.teams)) {
      if (!team.members) continue
      for (const member of team.members) {
        if (member.uid === uid) return member
      }
    }
  }
  return null
}

function resolveUserComponents(rosterData, user, fieldDefinitions) {
  if (!user?.email) return { components: [], displayName: null, state: 'not-found' }

  const uid = user.email.split('@')[0]
  const person = findPersonByUid(rosterData, uid)
  if (!person) return { components: [], displayName: null, state: 'not-found' }

  const displayName = person.name || person.jiraDisplayName || uid

  // Find component field from definitions
  const personFields = fieldDefinitions?.personFields || []
  const componentField = personFields.find(f => f.optionsRef === 'component')
  if (!componentField) return { components: [], displayName, state: 'no-components' }

  const val = person.customFields?.[componentField.id]
  const components = Array.isArray(val) ? val : (val ? [val] : [])
  if (components.length === 0) return { components: [], displayName, state: 'no-components' }

  return { components, displayName, state: 'resolved' }
}

function filterByComponents(items, userComponents) {
  if (!userComponents.length) return items
  const userSet = new Set(userComponents)
  return items.filter(item => {
    const itemComponents = item.components || []
    return itemComponents.some(c => userSet.has(c))
  })
}

export function useForYou(rosterData, user, rfeData, features, assessments, fieldDefinitions, options = {}) {
  const { mode = ref('auto'), manualComponents = ref([]) } = options
  const stageFilter = ref([])
  const priorityFilter = ref([])
  const componentFilter = ref([])

  const userResolution = computed(() => {
    if (mode.value === 'manual') {
      const comps = manualComponents.value
      const displayName = user.value?.email?.split('@')[0] || null
      if (comps.length === 0) {
        return { components: [], displayName, state: 'manual-empty' }
      }
      return { components: comps, displayName, state: 'manual' }
    }
    return resolveUserComponents(rosterData.value, user.value, fieldDefinitions.value)
  })

  const userComponents = computed(() => userResolution.value.components)
  const userDisplayName = computed(() => userResolution.value.displayName)
  const rosterResolutionState = computed(() => userResolution.value.state)

  const classifiedItems = computed(() => {
    const items = []

    // Classify RFEs
    const rfes = rfeData.value?.issues || []
    const userComps = userComponents.value
    const filteredRfes = filterByComponents(rfes, userComps)

    for (const rfe of filteredRfes) {
      const state = classifyRfe(rfe)
      if (!state) continue // Skip RFEs with linked features
      const assessment = assessments.value?.[rfe.key]
      const waitDays = computeWaitDays(
        { ...rfe, assessedAt: assessment?.assessedAt },
        state,
        'rfe'
      )
      items.push({
        type: 'rfe',
        key: rfe.key,
        summary: rfe.summary,
        components: rfe.components || [],
        priority: rfe.priority,
        labels: rfe.labels || [],
        created: rfe.created,
        state,
        waitDays,
        scores: assessment?.scores || null,
        linkedFeature: rfe.linkedFeature,
        assessedAt: assessment?.assessedAt || null
      })
    }

    // Classify Features
    const featureMap = features.value || {}
    const featureList = Object.values(featureMap)
    const filteredFeatures = filterByComponents(featureList, userComps)

    for (const feature of filteredFeatures) {
      const state = classifyFeature(feature)
      const waitDays = computeWaitDays(feature, state, 'feature')
      items.push({
        type: 'feature',
        key: feature.key,
        summary: feature.title,
        components: feature.components || [],
        priority: feature.priority,
        labels: feature.labels || [],
        created: feature.reviewedAt,
        state,
        waitDays,
        scores: feature.scores || null,
        recommendation: feature.recommendation,
        humanReviewStatus: feature.humanReviewStatus,
        sourceRfe: feature.sourceRfe,
        reviewedAt: feature.reviewedAt,
        approvedBy: feature.approvedBy || null
      })
    }

    return items
  })

  const availableItemComponents = computed(() => {
    const set = new Set()
    for (const item of classifiedItems.value) {
      for (const c of item.components || []) {
        set.add(c)
      }
    }
    return [...set].sort()
  })

  const filteredItems = computed(() => {
    let items = classifiedItems.value
    if (stageFilter.value.length > 0) {
      const stageSet = new Set(stageFilter.value)
      items = items.filter(i => stageSet.has(i.state.id))
    }
    if (priorityFilter.value.length > 0) {
      const prioritySet = new Set(priorityFilter.value)
      items = items.filter(i => prioritySet.has(i.priority))
    }
    if (componentFilter.value.length > 0) {
      const filterSet = new Set(componentFilter.value)
      items = items.filter(i => (i.components || []).some(c => filterSet.has(c)))
    }
    return items
  })

  const actionNeeded = computed(() => {
    const items = filteredItems.value.filter(i => {
      if (i.type === 'rfe') {
        return ['needs-revision', 'passed-with-caveats', 'ready-to-advance'].includes(i.state.id)
      }
      return ['rejected', 'revise-required', 'awaiting-signoff'].includes(i.state.id)
    })
    return sortItems(items)
  })

  const everythingElse = computed(() => {
    const items = filteredItems.value.filter(i => {
      if (i.type === 'rfe') {
        return ['queued-for-pipeline', 'not-assessed'].includes(i.state.id)
      }
      return i.state.id === 'signed-off'
    })
    return sortItems(items)
  })

  const boardColumns = computed(() => {
    const columns = [
      { ...RFE_STATES.NOT_ASSESSED, items: [] },
      { ...RFE_STATES.NEEDS_REVISION, items: [] },
      { ...RFE_STATES.PASSED_WITH_CAVEATS, items: [] },
      { ...RFE_STATES.READY_TO_ADVANCE, items: [] },
      { ...RFE_STATES.QUEUED_FOR_PIPELINE, items: [] },
      { ...FEATURE_STATES.REJECTED, items: [] },
      { ...FEATURE_STATES.REVISE_REQUIRED, items: [] },
      { ...FEATURE_STATES.AWAITING_SIGNOFF, items: [] },
      { ...FEATURE_STATES.SIGNED_OFF, items: [] }
    ]
    const columnMap = {}
    for (const col of columns) {
      columnMap[col.id] = col
    }
    for (const item of filteredItems.value) {
      const col = columnMap[item.state.id]
      if (col) {
        col.items.push(item)
      }
    }
    return columns
  })

  const actionGroups = computed(() => {
    const groups = [
      { id: 'failed-rubric', label: 'RFEs Failed Rubric', items: [] },
      { id: 'passed-with-caveats', label: 'RFEs Passed with Caveats', items: [] },
      { id: 'advance-rfes', label: 'RFEs Ready for Feature Creation', items: [] },
      { id: 'review-features', label: 'Features Needing Review', items: [] }
    ]
    for (const item of actionNeeded.value) {
      if (item.type === 'rfe' && item.state.id === 'needs-revision') {
        groups[0].items.push(item)
      } else if (item.type === 'rfe' && item.state.id === 'passed-with-caveats') {
        groups[1].items.push(item)
      } else if (item.type === 'rfe' && item.state.id === 'ready-to-advance') {
        groups[2].items.push(item)
      } else if (item.type === 'feature') {
        groups[3].items.push(item)
      }
    }
    return groups.filter(g => g.items.length > 0)
  })

  const stats = computed(() => {
    const all = classifiedItems.value

    const reviseRfes = all.filter(i =>
      i.type === 'rfe' && ['needs-revision', 'passed-with-caveats'].includes(i.state.id)
    ).length

    const reviewFeatures = all.filter(i =>
      i.type === 'feature' && ['awaiting-signoff', 'revise-required'].includes(i.state.id)
    ).length

    const queuedForStrat = all.filter(i =>
      i.type === 'rfe' && i.state.id === 'ready-to-advance'
    ).length

    const signedOffFeatures = all.filter(i =>
      i.type === 'feature' && i.state.id === 'signed-off'
    ).length

    return { reviseRfes, reviewFeatures, queuedForStrat, signedOffFeatures }
  })

  return {
    userComponents,
    userDisplayName,
    rosterResolutionState,
    classifiedItems,
    actionNeeded,
    everythingElse,
    boardColumns,
    actionGroups,
    stats,
    stageFilter,
    priorityFilter,
    componentFilter,
    availableItemComponents
  }
}

// Exports for testing
export {
  classifyRfe,
  classifyFeature,
  computeWaitDays,
  resolveUserComponents,
  filterByComponents,
  findPersonByUid,
  RFE_STATES,
  FEATURE_STATES,
  SCOPE_LABEL
}
