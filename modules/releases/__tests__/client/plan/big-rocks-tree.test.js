import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BigRocksTree from '../../../client/plan/components/BigRocksTree.vue'

function makeBigRock(name, pillar, priority, extras) {
  return Object.assign({
    name: name,
    pillar: arguments.length > 1 ? pillar : 'Default Pillar',
    priority: priority || 1,
    outcomeKeys: [],
    outcomeDescriptions: {},
    outcomes: [],
    featureCount: 0,
    rfeCount: 0,
    owner: '',
    architect: ''
  }, extras || {})
}

function makeRockHealth(worstLevel, featureCount, extras) {
  return Object.assign({
    worstLevel: worstLevel || 'green',
    featureCount: featureCount || 0,
    totalFlags: 0,
    dorPassedCount: 0,
    dodPassedCount: 0,
    releaseTypes: [],
    totalEpicCount: 0,
    totalIssueCount: 0,
    totalStoryPoints: 0,
    versionedCount: 0,
    missingVersionCount: 0,
    committedCount: 0,
    targetedCount: 0,
    distinctVersions: [],
    planningReady: 0,
    planningTotal: 0,
    planningBlockers: 0
  }, extras || {})
}

function makeFeatureDetail(key, level, extras) {
  return Object.assign({
    key: key,
    level: level || 'green',
    flagCount: 0,
    flagCategories: [],
    summary: 'Summary for ' + key,
    deliveryOwner: 'Owner',
    jiraUrl: 'https://issues.redhat.com/browse/' + key,
    releaseType: '',
    targetRelease: '',
    fixVersions: '',
    epicCount: 0,
    issueCount: 0,
    rice: null,
    storyPoints: null,
    completionPct: 0,
    override: null,
    bigRock: '',
    planningStatus: '',
    planningChecks: null,
    status: '',
    versionStatus: 'none'
  }, extras || {})
}

describe('BigRocksTree', function() {
  it('renders rocks in stack rank order', function() {
    var wrapper = mount(BigRocksTree, {
      props: {
        bigRocks: [
          makeBigRock('Third', 'Platform', 3),
          makeBigRock('First', 'AI', 1),
          makeBigRock('Second', 'AI', 2)
        ],
        rockHealth: {}
      }
    })
    var text = wrapper.text()
    expect(text.indexOf('First')).toBeLessThan(text.indexOf('Second'))
    expect(text.indexOf('Second')).toBeLessThan(text.indexOf('Third'))
  })

  it('shows pillar labels on rock nodes', function() {
    var wrapper = mount(BigRocksTree, {
      props: {
        bigRocks: [
          makeBigRock('Rock A', 'AI', 1),
          makeBigRock('Rock B', 'Platform', 2)
        ],
        rockHealth: {}
      }
    })
    expect(wrapper.text()).toContain('AI')
    expect(wrapper.text()).toContain('Platform')
  })

  it('shows "Unassigned" for rocks without a pillar', function() {
    var wrapper = mount(BigRocksTree, {
      props: {
        bigRocks: [makeBigRock('Orphan', null, 1)],
        rockHealth: {}
      }
    })
    expect(wrapper.text()).toContain('Unassigned')
  })

  it('shows PM owner and Eng. Lead on rock nodes', function() {
    var wrapper = mount(BigRocksTree, {
      props: {
        bigRocks: [makeBigRock('Rock A', 'AI', 1, { owner: 'Alice', architect: 'Bob' })],
        rockHealth: {}
      }
    })
    expect(wrapper.text()).toContain('Alice')
    expect(wrapper.text()).toContain('Bob')
  })

  it('shows health dot with correct color on rock node', function() {
    var wrapper = mount(BigRocksTree, {
      props: {
        bigRocks: [makeBigRock('Rock A', 'AI', 1)],
        rockHealth: { 'Rock A': makeRockHealth('red', 3) }
      }
    })
    expect(wrapper.find('.bg-red-500').exists()).toBe(true)
  })

  it('shows health badge with correct label in execution mode', function() {
    var wrapper = mount(BigRocksTree, {
      props: {
        bigRocks: [makeBigRock('Rock A', 'AI', 1)],
        rockHealth: { 'Rock A': makeRockHealth('yellow', 2) },
        releasePhaseMode: 'execution'
      }
    })
    expect(wrapper.text()).toContain('At Risk')
  })

  it('shows planning readiness badge in planning mode', function() {
    var wrapper = mount(BigRocksTree, {
      props: {
        bigRocks: [makeBigRock('Rock A', 'AI', 1)],
        rockHealth: { 'Rock A': makeRockHealth('green', 2, { planningReady: 3, planningTotal: 5, planningBlockers: 2 }) },
        releasePhaseMode: 'planning'
      }
    })
    expect(wrapper.text()).toContain('3/5 ready')
  })

  it('shows release type badges on rock node', function() {
    var wrapper = mount(BigRocksTree, {
      props: {
        bigRocks: [makeBigRock('Rock A', 'AI', 1)],
        rockHealth: { 'Rock A': makeRockHealth('green', 1, { releaseTypes: ['DP', 'GA'] }) }
      }
    })
    expect(wrapper.text()).toContain('DP')
    expect(wrapper.text()).toContain('GA')
  })

  it('shows version summary on rock node', function() {
    var wrapper = mount(BigRocksTree, {
      props: {
        bigRocks: [makeBigRock('Rock A', 'AI', 1)],
        rockHealth: { 'Rock A': makeRockHealth('green', 3, { versionedCount: 2, missingVersionCount: 1 }) }
      }
    })
    expect(wrapper.text()).toContain('2 versioned')
    expect(wrapper.text()).toContain('1 missing')
  })

  it('shows feature and RFE counts on rock node', function() {
    var wrapper = mount(BigRocksTree, {
      props: {
        bigRocks: [makeBigRock('Rock A', 'AI', 1, { featureCount: 5, rfeCount: 3 })],
        rockHealth: {}
      }
    })
    expect(wrapper.text()).toContain('5')
    expect(wrapper.text()).toContain('feat.')
    expect(wrapper.text()).toContain('3')
    expect(wrapper.text()).toContain('RFEs')
  })

  it('shows outcomes when rock is expanded', async function() {
    var wrapper = mount(BigRocksTree, {
      props: {
        bigRocks: [makeBigRock('Rock A', 'AI', 1, {
          outcomeKeys: ['RHAISTRAT-1513'],
          outcomeDescriptions: { 'RHAISTRAT-1513': 'Enable MaaS' }
        })],
        rockHealth: {}
      }
    })
    var rockNode = wrapper.find('.wg-rock')
    await rockNode.trigger('click')
    expect(wrapper.text()).toContain('RHAISTRAT-1513')
    expect(wrapper.text()).toContain('Enable MaaS')
  })

  it('shows features with all fields when outcome is expanded', async function() {
    var wrapper = mount(BigRocksTree, {
      props: {
        bigRocks: [makeBigRock('Rock A', 'AI', 1, { outcomeKeys: ['OUT-1'] })],
        rockHealth: { 'Rock A': makeRockHealth('yellow', 1) },
        rockFeatures: {
          'Rock A': [makeFeatureDetail('FEAT-1', 'yellow', {
            summary: 'Test feature summary',
            deliveryOwner: 'Jane Doe',
            releaseType: 'GA',
            targetRelease: 'rhoai-3.5',
            fixVersions: 'RHOAI 3.5.0, RHOAI 3.5.1',
            completionPct: 65
          })]
        }
      }
    })
    var expandBtn = wrapper.findAll('button').find(function(b) { return b.text() === 'Expand All' })
    await expandBtn.trigger('click')
    var text = wrapper.text()
    expect(text).toContain('FEAT-1')
    expect(text).toContain('Test feature summary')
    expect(text).toContain('Jane Doe')
    expect(text).toContain('GA')
    expect(text).toContain('rhoai-3.5')
    expect(text).toContain('RHOAI 3.5.0')
    expect(text).toContain('RHOAI 3.5.1')
    expect(text).toContain('65%')
  })

  it('shows override "M" and shared "S" badges on features', async function() {
    var wrapper = mount(BigRocksTree, {
      props: {
        bigRocks: [makeBigRock('Rock A', 'AI', 1, { outcomeKeys: ['OUT-1'] })],
        rockHealth: {},
        rockFeatures: {
          'Rock A': [makeFeatureDetail('FEAT-1', 'red', {
            override: 'manual',
            bigRock: 'Rock A, Rock B'
          })]
        }
      }
    })
    var expandBtn = wrapper.findAll('button').find(function(b) { return b.text() === 'Expand All' })
    await expandBtn.trigger('click')
    expect(wrapper.text()).toContain('M')
    expect(wrapper.text()).toContain('S')
  })

  it('shows planning status badges on features in planning mode', async function() {
    var wrapper = mount(BigRocksTree, {
      props: {
        bigRocks: [makeBigRock('Rock A', 'AI', 1, { outcomeKeys: ['OUT-1'] })],
        rockHealth: {},
        rockFeatures: {
          'Rock A': [makeFeatureDetail('FEAT-1', 'green', {
            planningStatus: 'ready-for-execution',
            planningChecks: { passedCount: 4, totalCount: 5 }
          })]
        },
        releasePhaseMode: 'planning'
      }
    })
    var expandBtn = wrapper.findAll('button').find(function(b) { return b.text() === 'Expand All' })
    await expandBtn.trigger('click')
    expect(wrapper.text()).toContain('Ready')
    expect(wrapper.text()).toContain('4/5')
  })

  it('shows "no version" warning when feature has no fix versions', async function() {
    var wrapper = mount(BigRocksTree, {
      props: {
        bigRocks: [makeBigRock('Rock A', 'AI', 1, { outcomeKeys: ['OUT-1'] })],
        rockHealth: {},
        rockFeatures: {
          'Rock A': [makeFeatureDetail('FEAT-1', 'green', { fixVersions: '' })]
        }
      }
    })
    var expandBtn = wrapper.findAll('button').find(function(b) { return b.text() === 'Expand All' })
    await expandBtn.trigger('click')
    expect(wrapper.text()).toContain('no version')
  })

  it('expand all / collapse all controls work', async function() {
    var wrapper = mount(BigRocksTree, {
      props: {
        bigRocks: [
          makeBigRock('Rock A', 'AI', 1, { outcomeKeys: ['OUT-1'] }),
          makeBigRock('Rock B', 'Platform', 2, { outcomeKeys: ['OUT-2'] })
        ],
        rockHealth: {},
        rockFeatures: {
          'Rock A': [makeFeatureDetail('FEAT-1', 'green')],
          'Rock B': [makeFeatureDetail('FEAT-2', 'red')]
        }
      }
    })
    var expandBtn = wrapper.findAll('button').find(function(b) { return b.text() === 'Expand All' })
    await expandBtn.trigger('click')
    expect(wrapper.text()).toContain('FEAT-1')
    expect(wrapper.text()).toContain('FEAT-2')

    var collapseBtn = wrapper.findAll('button').find(function(b) { return b.text() === 'Collapse All' })
    await collapseBtn.trigger('click')
    expect(wrapper.text()).not.toContain('FEAT-1')
    expect(wrapper.text()).not.toContain('FEAT-2')
  })

  it('emits editRock when edit button clicked', function() {
    var rock = makeBigRock('Rock A', 'AI', 1)
    var wrapper = mount(BigRocksTree, {
      props: { bigRocks: [rock], rockHealth: {}, canEdit: true }
    })
    var editBtn = wrapper.find('[title="Edit"]')
    editBtn.trigger('click')
    expect(wrapper.emitted('editRock')).toBeTruthy()
    expect(wrapper.emitted('editRock')[0][0]).toEqual(rock)
  })

  it('emits deleteRock when delete button clicked', function() {
    var rock = makeBigRock('Rock A', 'AI', 1)
    var wrapper = mount(BigRocksTree, {
      props: { bigRocks: [rock], rockHealth: {}, canDelete: true }
    })
    var deleteBtn = wrapper.find('[title="Delete"]')
    deleteBtn.trigger('click')
    expect(wrapper.emitted('deleteRock')).toBeTruthy()
    expect(wrapper.emitted('deleteRock')[0][0]).toEqual(rock)
  })

  it('emits addRock when add button clicked', function() {
    var wrapper = mount(BigRocksTree, {
      props: { bigRocks: [makeBigRock('Rock A', 'AI')], rockHealth: {}, canAdd: true }
    })
    var addBtn = wrapper.findAll('button').find(function(b) { return b.text().includes('Add Rock') })
    addBtn.trigger('click')
    expect(wrapper.emitted('addRock')).toBeTruthy()
  })

  it('shows empty state when no big rocks', function() {
    var wrapper = mount(BigRocksTree, { props: { bigRocks: [], rockHealth: {} } })
    expect(wrapper.text()).toContain('No big rocks found')
  })

  it('shows loading state', function() {
    var wrapper = mount(BigRocksTree, { props: { bigRocks: [], rockHealth: {}, loading: true } })
    expect(wrapper.text()).toContain('Loading')
  })

  it('shows "No outcomes configured" for rocks without outcomeKeys', async function() {
    var wrapper = mount(BigRocksTree, {
      props: {
        bigRocks: [makeBigRock('Rock A', 'AI', 1)],
        rockHealth: {}
      }
    })
    var rockNode = wrapper.find('.wg-rock')
    await rockNode.trigger('click')
    expect(wrapper.text()).toContain('No outcomes configured')
  })

  it('shows "No features linked" when outcome expanded but no features exist', async function() {
    var wrapper = mount(BigRocksTree, {
      props: {
        bigRocks: [makeBigRock('Rock A', 'AI', 1, { outcomeKeys: ['OUT-1'] })],
        rockHealth: {},
        rockFeatures: {}
      }
    })
    var expandBtn = wrapper.findAll('button').find(function(b) { return b.text() === 'Expand All' })
    await expandBtn.trigger('click')
    expect(wrapper.text()).toContain('No features linked')
  })

  it('shows outcome count preview on collapsed rock', function() {
    var wrapper = mount(BigRocksTree, {
      props: {
        bigRocks: [makeBigRock('Rock A', 'AI', 1, { outcomeKeys: ['OUT-1', 'OUT-2', 'OUT-3'] })],
        rockHealth: {}
      }
    })
    expect(wrapper.text()).toContain('3 outcomes')
  })
})
