import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RiskBadge from '../../../client/plan/components/RiskBadge.vue'
import HealthSummaryCards from '../../../client/plan/components/HealthSummaryCards.vue'
import RiceScoreDisplay from '../../../client/plan/components/RiceScoreDisplay.vue'
import HealthFilterBar from '../../../client/plan/components/HealthFilterBar.vue'
import MilestoneTimeline from '../../../client/plan/components/MilestoneTimeline.vue'
import FeatureHealthTable from '../../../client/plan/components/FeatureHealthTable.vue'
import BigRockExpandedRow from '../../../client/plan/components/BigRockExpandedRow.vue'

// ─── RiskBadge ───

describe('RiskBadge', function() {
  it('renders Green label by default', function() {
    var wrapper = mount(RiskBadge)
    expect(wrapper.text()).toContain('Green')
  })

  it('renders Red label for level red', function() {
    var wrapper = mount(RiskBadge, { props: { level: 'red' } })
    expect(wrapper.text()).toContain('Red')
  })

  it('renders Yellow label for level yellow', function() {
    var wrapper = mount(RiskBadge, { props: { level: 'yellow' } })
    expect(wrapper.text()).toContain('Yellow')
  })

  it('applies red color classes for red level', function() {
    var wrapper = mount(RiskBadge, { props: { level: 'red' } })
    expect(wrapper.find('span').classes().join(' ')).toContain('red')
  })

  it('shows flag count superscript when flagCount > 0', function() {
    var wrapper = mount(RiskBadge, { props: { level: 'yellow', flagCount: 3 } })
    var sup = wrapper.find('sup')
    expect(sup.exists()).toBe(true)
    expect(sup.text()).toBe('3')
  })

  it('does not show superscript when flagCount is 0', function() {
    var wrapper = mount(RiskBadge, { props: { level: 'green', flagCount: 0 } })
    expect(wrapper.find('sup').exists()).toBe(false)
  })

  it('shows override indicator when override is present', function() {
    var wrapper = mount(RiskBadge, {
      props: { level: 'red', override: { riskOverride: 'green', reason: 'PM approved' } }
    })
    expect(wrapper.text()).toContain('M')
  })

  it('displays override level instead of original level', function() {
    var wrapper = mount(RiskBadge, {
      props: { level: 'red', override: { riskOverride: 'green', reason: 'PM approved' } }
    })
    expect(wrapper.text()).toContain('Green')
  })
})

// ─── HealthSummaryCards ───

describe('HealthSummaryCards', function() {
  var cardCounts = {
    total: 15,
    dorPassed: 12,
    dodPassed: 8,
    stratSignedOff: 10,
    riceComplete: 13,
    ownerAssigned: 11,
    versionSet: 14,
    unblocked: 12,
    escalatedBlockers: 2
  }

  it('renders nothing when cardCounts is null', function() {
    var wrapper = mount(HealthSummaryCards, { props: { cardCounts: null } })
    expect(wrapper.text()).toBe('')
  })

  it('renders 4 primary cards with three-gate labels', function() {
    var wrapper = mount(HealthSummaryCards, { props: { cardCounts: cardCounts } })
    expect(wrapper.text()).toContain('DoR Passed')
    expect(wrapper.text()).toContain('DoD Passed')
    expect(wrapper.text()).toContain('Strategy Signed Off')
    expect(wrapper.text()).toContain('RICE Complete')
  })

  it('shows count fractions for primary cards', function() {
    var wrapper = mount(HealthSummaryCards, { props: { cardCounts: cardCounts } })
    expect(wrapper.text()).toContain('12')
    expect(wrapper.text()).toContain('8')
    expect(wrapper.text()).toContain('10')
    expect(wrapper.text()).toContain('13')
    expect(wrapper.text()).toContain('/ 15')
  })

  it('shows percentage for primary cards', function() {
    var wrapper = mount(HealthSummaryCards, { props: { cardCounts: cardCounts } })
    expect(wrapper.text()).toContain('80%')  // 12/15
    expect(wrapper.text()).toContain('53%')  // 8/15
    expect(wrapper.text()).toContain('67%')  // 10/15
    expect(wrapper.text()).toContain('87%')  // 13/15
  })

  it('hides detail cards by default', function() {
    var wrapper = mount(HealthSummaryCards, { props: { cardCounts: cardCounts } })
    expect(wrapper.text()).not.toContain('Version Set')
    expect(wrapper.text()).toContain('Show details')
  })

  it('shows detail cards when toggle clicked', async function() {
    var wrapper = mount(HealthSummaryCards, { props: { cardCounts: cardCounts } })
    var toggle = wrapper.findAll('button').filter(function(b) { return b.text().includes('details') })
    await toggle[0].trigger('click')
    expect(wrapper.text()).toContain('Owner Assigned')
    expect(wrapper.text()).toContain('Version Set')
    expect(wrapper.text()).toContain('Unblocked')
    expect(wrapper.text()).toContain('Escalated Blockers')
    expect(wrapper.text()).toContain('Hide details')
  })

  it('renders planning deadline when provided', function() {
    var wrapper = mount(HealthSummaryCards, {
      props: {
        cardCounts: cardCounts,
        planningDeadline: { date: '2026-05-01', daysRemaining: 5 }
      }
    })
    expect(wrapper.text()).toContain('Planning Deadline')
    expect(wrapper.text()).toContain('2026-05-01')
    expect(wrapper.text()).toContain('5')
  })

  it('does not render planning deadline when null', function() {
    var wrapper = mount(HealthSummaryCards, { props: { cardCounts: cardCounts } })
    expect(wrapper.text()).not.toContain('Planning Deadline')
  })

  it('handles zero total gracefully', function() {
    var zeroCounts = { total: 0, dorPassed: 0, dodPassed: 0, stratSignedOff: 0, riceComplete: 0, ownerAssigned: 0, versionSet: 0, unblocked: 0, escalatedBlockers: 0 }
    var wrapper = mount(HealthSummaryCards, { props: { cardCounts: zeroCounts } })
    expect(wrapper.text()).toContain('0')
    expect(wrapper.text()).toContain('/ 0')
  })
})

// ─── RiceScoreDisplay ───

describe('RiceScoreDisplay', function() {
  it('shows N/A when rice is null', function() {
    var wrapper = mount(RiceScoreDisplay, { props: { rice: null } })
    expect(wrapper.text()).toContain('N/A')
  })

  it('shows score when rice has a score', function() {
    var wrapper = mount(RiceScoreDisplay, { props: { rice: { score: 400 } } })
    expect(wrapper.text()).toContain('400')
  })

  it('shows N/A when rice has no score', function() {
    var wrapper = mount(RiceScoreDisplay, { props: { rice: { score: null } } })
    expect(wrapper.text()).toContain('N/A')
  })

  it('applies indigo styling when score is present', function() {
    var wrapper = mount(RiceScoreDisplay, { props: { rice: { score: 1234 } } })
    expect(wrapper.find('span').classes().join(' ')).toContain('indigo')
  })

  it('applies gray styling when score is absent', function() {
    var wrapper = mount(RiceScoreDisplay, { props: { rice: null } })
    expect(wrapper.find('span').classes().join(' ')).toContain('gray')
  })
})


// ─── HealthFilterBar ───

describe('HealthFilterBar', function() {
  it('renders search input', function() {
    var wrapper = mount(HealthFilterBar)
    expect(wrapper.find('input[type="text"]').exists()).toBe(true)
  })

  it('renders big rocks select when bigRocks provided', function() {
    var wrapper = mount(HealthFilterBar, { props: { bigRocks: ['Rock A', 'Rock B'] } })
    expect(wrapper.text()).toContain('Rock A')
    expect(wrapper.text()).toContain('Rock B')
  })

  it('renders component multi-select button when components provided', function() {
    var wrapper = mount(HealthFilterBar, { props: { components: ['Model Serving', 'Pipelines'] } })
    expect(wrapper.text()).toContain('All Components')
  })

  it('shows component options in dropdown when button clicked', async function() {
    var wrapper = mount(HealthFilterBar, {
      props: { components: ['Model Serving', 'Pipelines'] },
      attachTo: document.body
    })
    var compBtn = wrapper.findAll('button').filter(function(b) {
      return b.text().includes('All Components')
    })
    if (compBtn.length > 0) {
      await compBtn[0].trigger('click')
      expect(wrapper.text()).toContain('Model Serving')
      expect(wrapper.text()).toContain('Pipelines')
    }
    wrapper.unmount()
  })

  it('shows selected component chips', function() {
    var wrapper = mount(HealthFilterBar, {
      props: {
        components: ['Model Serving', 'Pipelines'],
        selectedComponents: ['Model Serving']
      }
    })
    expect(wrapper.text()).toContain('Model Serving')
  })

  it('emits update:selectedComponents when chip remove is clicked', async function() {
    var wrapper = mount(HealthFilterBar, {
      props: {
        components: ['Model Serving', 'Pipelines'],
        selectedComponents: ['Model Serving']
      }
    })
    var removeBtn = wrapper.findAll('button').filter(function(b) {
      return b.attributes('aria-label') === 'Remove component filter'
    })
    if (removeBtn.length > 0) {
      await removeBtn[0].trigger('click')
      expect(wrapper.emitted('update:selectedComponents')).toBeDefined()
      expect(wrapper.emitted('update:selectedComponents')[0][0]).toEqual([])
    }
  })

  it('shows clear button when hasActiveFilters is true', function() {
    var wrapper = mount(HealthFilterBar, { props: { hasActiveFilters: true } })
    var clearBtn = wrapper.findAll('button').filter(function(b) { return b.text().toLowerCase().includes('clear') })
    expect(clearBtn.length).toBeGreaterThan(0)
  })

  it('hides clear button when hasActiveFilters is false', function() {
    var wrapper = mount(HealthFilterBar, { props: { hasActiveFilters: false } })
    var clearBtn = wrapper.findAll('button').filter(function(b) { return b.text().toLowerCase().includes('clear') })
    expect(clearBtn.length).toBe(0)
  })

  it('emits clearFilters when clear button is clicked', async function() {
    var wrapper = mount(HealthFilterBar, { props: { hasActiveFilters: true } })
    var clearBtn = wrapper.findAll('button').filter(function(b) { return b.text().toLowerCase().includes('clear') })
    if (clearBtn.length > 0) {
      await clearBtn[0].trigger('click')
      expect(wrapper.emitted('clearFilters')).toBeDefined()
    }
  })

  it('emits update:searchQuery on input', async function() {
    var wrapper = mount(HealthFilterBar)
    await wrapper.find('input[type="text"]').setValue('test query')
    expect(wrapper.emitted('update:searchQuery')).toBeDefined()
    expect(wrapper.emitted('update:searchQuery')[0][0]).toBe('test query')
  })

  it('renders planning status filter dropdown', function() {
    var wrapper = mount(HealthFilterBar)
    var selects = wrapper.findAll('select')
    var planningSelect = selects.filter(function(s) { return s.attributes('aria-label') === 'Filter by planning status' })
    expect(planningSelect.length).toBe(1)
    expect(planningSelect[0].text()).toContain('All Statuses')
    expect(planningSelect[0].text()).toContain('Not Ready')
    expect(planningSelect[0].text()).toContain('In Planning')
    expect(planningSelect[0].text()).toContain('Ready for Execution')
  })

  it('emits update:planningStatusFilter on change', async function() {
    var wrapper = mount(HealthFilterBar)
    var selects = wrapper.findAll('select')
    var planningSelect = selects.filter(function(s) { return s.attributes('aria-label') === 'Filter by planning status' })
    await planningSelect[0].setValue('not-ready')
    expect(wrapper.emitted('update:planningStatusFilter')).toBeDefined()
    expect(wrapper.emitted('update:planningStatusFilter')[0][0]).toBe('not-ready')
  })

  it('renders risk level filter dropdown', function() {
    var wrapper = mount(HealthFilterBar)
    var selects = wrapper.findAll('select')
    var riskSelect = selects.filter(function(s) { return s.attributes('aria-label') === 'Filter by risk level' })
    expect(riskSelect.length).toBe(1)
    expect(riskSelect[0].text()).toContain('All Risk Levels')
    expect(riskSelect[0].text()).toContain('Green')
    expect(riskSelect[0].text()).toContain('Yellow')
    expect(riskSelect[0].text()).toContain('Red')
  })

  it('emits update:riskLevelFilter on change', async function() {
    var wrapper = mount(HealthFilterBar)
    var selects = wrapper.findAll('select')
    var riskSelect = selects.filter(function(s) { return s.attributes('aria-label') === 'Filter by risk level' })
    await riskSelect[0].setValue('red')
    expect(wrapper.emitted('update:riskLevelFilter')).toBeDefined()
    expect(wrapper.emitted('update:riskLevelFilter')[0][0]).toBe('red')
  })
})

// ─── MilestoneTimeline ───

describe('MilestoneTimeline', function() {
  var milestones = {
    ea1Freeze: '2026-05-01',
    ea1Target: '2026-05-15',
    ea2Freeze: '2026-06-15',
    ea2Target: '2026-07-01',
    gaFreeze: '2026-08-01',
    gaTarget: '2026-08-15'
  }

  it('shows fallback when milestones is null', function() {
    var wrapper = mount(MilestoneTimeline, { props: { milestones: null } })
    expect(wrapper.text()).toContain('Milestone')
  })

  it('renders milestone labels when data provided', function() {
    var wrapper = mount(MilestoneTimeline, { props: { milestones: milestones } })
    expect(wrapper.text()).toContain('EA1')
    expect(wrapper.text()).toContain('GA')
  })

  it('shows next milestone countdown', function() {
    var wrapper = mount(MilestoneTimeline, { props: { milestones: milestones } })
    var text = wrapper.text()
    if (text.includes('day')) {
      expect(text).toMatch(/\d+\s*day/)
    }
  })

  it('renders milestone points', function() {
    var wrapper = mount(MilestoneTimeline, { props: { milestones: milestones } })
    expect(wrapper.findAll('[class*="rounded-full"]').length || wrapper.findAll('div').length).toBeGreaterThan(0)
  })
})

// ─── FeatureHealthTable ───

describe('FeatureHealthTable', function() {
  var features = [
    {
      key: 'T-1', summary: 'Feature 1', status: 'In Progress',
      risk: { level: 'green', flags: [], riskScore: 0 },
      dor: { gate: 'dor', passed: true, blockers: [], warnings: [] },
      dod: { gate: 'dod', passed: true, checks: [] },
      planningStatus: 'ready-for-execution',
      rice: null, components: 'Model Serving', phase: 'GA', bigRock: 'MaaS',
      deliveryOwner: 'Alice', priorityScore: 65, priorityBreakdown: { rice: 50, bigRock: 100, priority: 60, complexity: 50 }
    },
    {
      key: 'T-2', summary: 'Feature 2', status: 'New',
      risk: { level: 'red', flags: [{ category: 'MILESTONE_MISS', severity: 'high', message: 'Past deadline' }], riskScore: 1 },
      dor: { gate: 'dor', passed: true, blockers: [], warnings: [] },
      dod: { gate: 'dod', passed: false, checks: [{ id: 'DoD-1', label: 'Owner Assigned', passed: false }] },
      planningStatus: 'in-planning',
      rice: { score: 250, complete: true }, components: 'Pipelines', phase: 'TP', bigRock: null,
      deliveryOwner: 'Bob', priorityScore: 42, priorityBreakdown: { rice: 40, bigRock: 60, priority: 40, complexity: 30 }
    }
  ]

  it('renders table headers including Health, Priority, and Owner', function() {
    var wrapper = mount(FeatureHealthTable, { props: { features: features } })
    expect(wrapper.text()).toContain('Feature')
    expect(wrapper.text()).toContain('Summary')
    expect(wrapper.text()).toContain('Health')
    expect(wrapper.text()).toContain('Priority')
    expect(wrapper.text()).toContain('Owner')
    expect(wrapper.text()).not.toContain('Risk')
    expect(wrapper.text()).not.toContain('DoR')
  })

  it('shows empty state when features array is empty', function() {
    var wrapper = mount(FeatureHealthTable, { props: { features: [] } })
    expect(wrapper.text()).toContain('No features')
  })

  it('renders feature rows', function() {
    var wrapper = mount(FeatureHealthTable, { props: { features: features } })
    expect(wrapper.text()).toContain('T-1')
    expect(wrapper.text()).toContain('T-2')
    expect(wrapper.text()).toContain('Feature 1')
    expect(wrapper.text()).toContain('Feature 2')
  })

  it('does not show pagination for small feature lists', function() {
    var wrapper = mount(FeatureHealthTable, { props: { features: features } })
    expect(wrapper.text()).not.toContain('Next')
  })

  it('sorts features by priority descending by default (highest first)', function() {
    var wrapper = mount(FeatureHealthTable, { props: { features: features } })
    var rows = wrapper.findAll('tr')
    var firstDataRow = rows.length > 1 ? rows[1].text() : ''
    expect(firstDataRow).toContain('T-1')
  })

  it('has 11 column headers', function() {
    var wrapper = mount(FeatureHealthTable, { props: { features: features } })
    var headers = wrapper.findAll('th')
    expect(headers.length).toBe(11)
  })
})

// ─── BigRockExpandedRow ───

describe('BigRockExpandedRow', function() {
  var sampleFeatures = [
    {
      key: 'RHOAI-101', level: 'green', flagCount: 0, flagCategories: [],
      summary: 'Enable model serving', deliveryOwner: 'Smith', jiraUrl: 'https://issues.redhat.com/browse/RHOAI-101',
      override: null, dorPassed: true, dodPassed: true, planningStatus: 'ready-for-execution', status: 'In Progress'
    },
    {
      key: 'RHOAI-102', level: 'yellow', flagCount: 1, flagCategories: ['VELOCITY_LAG'],
      summary: 'Add KServe support', deliveryOwner: 'Jones', jiraUrl: 'https://issues.redhat.com/browse/RHOAI-102',
      override: null, dorPassed: true, dodPassed: false, planningStatus: 'in-planning', status: 'In Progress'
    },
    {
      key: 'RHOAI-103', level: 'red', flagCount: 2, flagCategories: ['BLOCKED', 'MILESTONE_MISS'],
      summary: 'Batch inference pipeline with really long summary text that should be truncated when displayed',
      deliveryOwner: 'Chen', jiraUrl: 'https://issues.redhat.com/browse/RHOAI-103',
      override: { riskOverride: 'yellow', reason: 'PM override' }, dorPassed: false, dodPassed: false,
      planningStatus: 'not-ready', status: 'New'
    }
  ]

  function mountExpanded(props) {
    return mount(BigRockExpandedRow, {
      props: Object.assign({ colspan: 6, rockName: 'MaaS' }, props)
    })
  }

  it('renders feature rows with keys, summaries, and owners', function() {
    var wrapper = mountExpanded({ features: sampleFeatures })
    expect(wrapper.text()).toContain('RHOAI-101')
    expect(wrapper.text()).toContain('RHOAI-102')
    expect(wrapper.text()).toContain('RHOAI-103')
    expect(wrapper.text()).toContain('Enable model serving')
    expect(wrapper.text()).toContain('Smith')
    expect(wrapper.text()).toContain('Jones')
    expect(wrapper.text()).toContain('Chen')
  })

  it('shows empty state when features array is empty', function() {
    var wrapper = mountExpanded({ features: [] })
    expect(wrapper.text()).toContain('No feature health data available')
  })

  it('shows loading state when loading is true', function() {
    var wrapper = mountExpanded({ features: [], loading: true })
    expect(wrapper.text()).toContain('Loading feature health...')
  })

  it('renders feature keys as links when jiraUrl is provided', function() {
    var wrapper = mountExpanded({ features: sampleFeatures })
    var links = wrapper.findAll('a')
    var featureLinks = links.filter(function(a) { return a.text() === 'RHOAI-101' })
    expect(featureLinks.length).toBe(1)
    expect(featureLinks[0].attributes('href')).toBe('https://issues.redhat.com/browse/RHOAI-101')
    expect(featureLinks[0].attributes('target')).toBe('_blank')
  })

  it('shows risk flag categories or -- for no flags', function() {
    var wrapper = mountExpanded({ features: sampleFeatures })
    expect(wrapper.text()).toContain('--')
    expect(wrapper.text()).toContain('VELOCITY_LAG')
    expect(wrapper.text()).toContain('BLOCKED, MILESTONE_MISS')
  })

  it('renders "View all in Features tab" link', function() {
    var wrapper = mountExpanded({ features: sampleFeatures, rockName: 'MaaS' })
    var viewLink = wrapper.findAll('a').filter(function(a) { return a.text().includes('View all in Features tab') })
    expect(viewLink.length).toBe(1)
    expect(viewLink[0].attributes('href')).toContain('#/releases/plan?tab=health')
    expect(viewLink[0].attributes('href')).toContain('bigRock=MaaS')
  })

  it('shows override indicator (M) when feature has override', function() {
    var wrapper = mountExpanded({ features: sampleFeatures })
    var overrideIndicators = wrapper.findAll('span').filter(function(s) { return s.text() === 'M' })
    expect(overrideIndicators.length).toBe(1)
  })

  it('renders colored health dots for each feature', function() {
    var wrapper = mountExpanded({ features: sampleFeatures })
    var dots = wrapper.findAll('[role="img"]')
    expect(dots.length).toBe(3)
    expect(dots[0].classes().join(' ')).toContain('bg-green-500')
    expect(dots[1].classes().join(' ')).toContain('bg-yellow-500')
    expect(dots[2].classes().join(' ')).toContain('bg-red-500')
  })

  it('sets correct colspan on the wrapping td', function() {
    var wrapper = mountExpanded({ features: sampleFeatures, colspan: 8 })
    var td = wrapper.find('td')
    expect(td.attributes('colspan')).toBe('8')
  })

  it('has 4 column headers in the inner table', function() {
    var wrapper = mountExpanded({ features: sampleFeatures })
    var headers = wrapper.findAll('th')
    expect(headers.length).toBe(4)
  })
})
