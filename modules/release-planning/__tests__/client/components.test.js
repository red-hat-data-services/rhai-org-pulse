import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import StatusBadge from '../../client/components/StatusBadge.vue'
import SummaryCards from '../../client/components/SummaryCards.vue'
import BigRockRow from '../../client/components/BigRockRow.vue'
import BigRocksTable from '../../client/components/BigRocksTable.vue'
import FilterBar from '../../client/components/FilterBar.vue'

describe('StatusBadge', () => {
  it('renders status text', () => {
    const wrapper = mount(StatusBadge, { props: { status: 'In Progress' } })
    expect(wrapper.text()).toBe('In Progress')
  })

  it('applies color class for known statuses', () => {
    const wrapper = mount(StatusBadge, { props: { status: 'In Progress' } })
    expect(wrapper.find('span').classes()).toEqual(
      expect.arrayContaining([expect.stringContaining('blue')])
    )
  })

  it('applies default color for unknown statuses', () => {
    const wrapper = mount(StatusBadge, { props: { status: 'Unknown Status' } })
    expect(wrapper.find('span').classes()).toEqual(
      expect.arrayContaining([expect.stringContaining('gray')])
    )
  })
})

describe('SummaryCards', () => {
  const summary = {
    totalFeatures: 42,
    totalRfes: 10,
    totalBigRocks: 5,
    rocksWithData: 3,
    tier1: { features: 19, rfes: 5 },
    tier2: { features: 15, rfes: 5 },
    tier3: { features: 8, rfes: 0 }
  }

  it('renders all three summary cards', () => {
    const wrapper = mount(SummaryCards, { props: { summary, tier1HealthSummary: null, releaseDistribution: null } })
    expect(wrapper.text()).toContain('Feature Summary')
    expect(wrapper.text()).toContain('Outcome Health')
    expect(wrapper.text()).toContain('Milestone Coverage')
    // Should have exactly 3 card root elements in the grid
    const cards = wrapper.findAll('.p-4.rounded-lg')
    expect(cards).toHaveLength(3)
  })

  it('shows correct feature and RFE counts', () => {
    const wrapper = mount(SummaryCards, { props: { summary, tier1HealthSummary: null, releaseDistribution: null } })
    // Total counts in Feature Summary subtitle
    expect(wrapper.text()).toContain('42')
    expect(wrapper.text()).toContain('10')
    // Table element exists with aria-label
    const table = wrapper.find('table[aria-label]')
    expect(table.exists()).toBe(true)
  })

  it('renders nothing when summary is null', () => {
    const wrapper = mount(SummaryCards, { props: { summary: null } })
    expect(wrapper.text()).toBe('')
  })

  it('shows per-tier breakdown table in Feature Summary card', () => {
    const wrapper = mount(SummaryCards, {
      props: { summary, tier1HealthSummary: null, releaseDistribution: null }
    })
    // Table exists with accessible label
    const table = wrapper.find('table[aria-label]')
    expect(table.exists()).toBe(true)
    // Header row
    expect(table.text()).toContain('Features')
    expect(table.text()).toContain('RFEs')
    // Tier rows
    expect(table.text()).toContain('Tier 1')
    expect(table.text()).toContain('Tier 2')
    expect(table.text()).toContain('Tier 3')
  })

  it('shows health bars when tier1HealthSummary is provided', () => {
    const tier1HealthSummary = { byRisk: { green: 8, yellow: 4, red: 2 } }
    const wrapper = mount(SummaryCards, {
      props: { summary, tier1HealthSummary, releaseDistribution: null }
    })
    expect(wrapper.text()).toContain('Outcome Health')
    expect(wrapper.text()).toContain('features tracked')
    // Health section with aria-label
    const healthSection = wrapper.find('[aria-label*="on track"]')
    expect(healthSection.exists()).toBe(true)
    expect(healthSection.attributes('aria-label')).toContain('8 on track')
    expect(healthSection.attributes('aria-label')).toContain('4 at risk')
    expect(healthSection.attributes('aria-label')).toContain('2 off track')
    // Labels and counts visible
    expect(healthSection.text()).toContain('On track')
    expect(healthSection.text()).toContain('At risk')
    expect(healthSection.text()).toContain('Off track')
    expect(healthSection.text()).toContain('8')
    expect(healthSection.text()).toContain('4')
    expect(healthSection.text()).toContain('2')
  })

  it('shows features tracked count in Outcome Health card', () => {
    const wrapper = mount(SummaryCards, {
      props: { summary, tier1HealthSummary: null, releaseDistribution: null }
    })
    // Shows feature count from summary.tier1.features
    expect(wrapper.text()).toContain('19')
    expect(wrapper.text()).toContain('features tracked')
  })

  it('shows loading state when tier1HealthSummary is null', () => {
    const wrapper = mount(SummaryCards, {
      props: { summary, tier1HealthSummary: null, releaseDistribution: null }
    })
    expect(wrapper.find('[aria-label="Loading health data"]').exists()).toBe(true)
    expect(wrapper.findAll('.animate-pulse').length).toBeGreaterThanOrEqual(3)
    // No health bars rendered
    expect(wrapper.find('[aria-label*="on track"]').exists()).toBe(false)
  })

  it('renders release distribution with doughnut chart and legend', () => {
    const releaseDistribution = [
      { label: 'EA1', count: 3, pct: 30, barColor: 'bg-blue-500' },
      { label: 'GA', count: 4, pct: 40, barColor: 'bg-emerald-500' },
      { label: '--', count: 3, pct: 30, barColor: 'bg-gray-400' }
    ]
    const wrapper = mount(SummaryCards, {
      props: { summary, releaseDistribution }
    })
    // Legend entries present
    expect(wrapper.text()).toContain('EA1')
    expect(wrapper.text()).toContain('GA')
    expect(wrapper.text()).toContain('--')
    // Total shown in center overlay
    expect(wrapper.text()).toContain('10')
    expect(wrapper.text()).toContain('total')
    // Semantic <dl> legend markup
    expect(wrapper.find('dl').exists()).toBe(true)
    expect(wrapper.findAll('dt')).toHaveLength(3)
    expect(wrapper.findAll('dd')).toHaveLength(3)
  })

  it('shows empty-state message when releaseDistribution is null', () => {
    const wrapper = mount(SummaryCards, {
      props: { summary, releaseDistribution: null }
    })
    // Release Version card header is always present
    expect(wrapper.text()).toContain('Milestone Coverage')
    // Empty-state message is shown
    expect(wrapper.text()).toContain('No release version data available')
    // No <dl> markup rendered
    expect(wrapper.find('dl').exists()).toBe(false)
  })
})

describe('BigRockRow', () => {
  const rock = {
    priority: 1,
    name: 'MaaS',
    fullName: 'Model as a Service',
    pillar: 'Inference',
    owner: 'jsmith',
    architect: 'jdoe',
    featureCount: 5,
    rfeCount: 2,
    notes: 'Important rock',
    outcomeKeys: ['KEY-100', 'KEY-200'],
    outcomeDescriptions: { 'KEY-100': 'Deploy models' }
  }

  function mountRow(props) {
    return mount(BigRockRow, {
      props: props || { rock, jiraBaseUrl: 'https://jira.example.com' },
      global: {
        config: { compilerOptions: { isCustomElement: () => false } }
      },
      attachTo: (() => {
        const table = document.createElement('table')
        const tbody = document.createElement('tbody')
        const tr = document.createElement('tr')
        tbody.appendChild(tr)
        table.appendChild(tbody)
        document.body.appendChild(table)
        return tr
      })()
    })
  }

  it('renders rock name and fullName', () => {
    const wrapper = mountRow()
    expect(wrapper.text()).toContain('MaaS')
    expect(wrapper.text()).toContain('Model as a Service')
  })

  it('renders priority', () => {
    const wrapper = mountRow()
    expect(wrapper.text()).toContain('1')
  })

  it('renders outcome keys as links', () => {
    const wrapper = mountRow()
    const links = wrapper.findAll('a')
    expect(links.length).toBe(2)
    expect(links[0].attributes('href')).toBe('https://jira.example.com/KEY-100')
    expect(links[0].text()).toBe('KEY-100')
  })

  it('shows outcome description when available', () => {
    const wrapper = mountRow()
    expect(wrapper.text()).toContain('Deploy models')
  })

  it('renders feature and RFE counts', () => {
    const wrapper = mountRow()
    expect(wrapper.text()).toContain('5')
    expect(wrapper.text()).toContain('2')
  })

  it('shows TBD when no outcome keys', () => {
    const emptyRock = { ...rock, outcomeKeys: [] }
    const wrapper = mountRow({ rock: emptyRock, jiraBaseUrl: '' })
    expect(wrapper.text()).toContain('TBD')
  })
})

describe('BigRocksTable', () => {
  const bigRocks = [
    { priority: 1, name: 'Rock A', pillar: 'Platform', fullName: '', owner: '', architect: '', featureCount: 3, rfeCount: 1, notes: '', outcomeKeys: ['KEY-1'] },
    { priority: 2, name: 'Rock B', pillar: 'Inference', fullName: '', owner: '', architect: '', featureCount: 1, rfeCount: 0, notes: '', outcomeKeys: [] }
  ]

  it('renders all Big Rock rows in read-only mode', () => {
    const wrapper = mount(BigRocksTable, {
      props: { bigRocks, canEdit: false }
    })
    expect(wrapper.text()).toContain('Rock A')
    expect(wrapper.text()).toContain('Rock B')
  })

  it('shows empty state when no rocks', () => {
    const wrapper = mount(BigRocksTable, {
      props: { bigRocks: [], canEdit: false }
    })
    expect(wrapper.text()).toContain('No Big Rocks configured')
  })

  it('shows Add button when canEdit is true', () => {
    const wrapper = mount(BigRocksTable, {
      props: { bigRocks, canEdit: true }
    })
    expect(wrapper.text()).toContain('Add Big Rock')
  })

  it('hides Add button when canEdit is false', () => {
    const wrapper = mount(BigRocksTable, {
      props: { bigRocks, canEdit: false }
    })
    expect(wrapper.text()).not.toContain('Add Big Rock')
  })

  it('emits addRock when Add button is clicked', async () => {
    const wrapper = mount(BigRocksTable, {
      props: { bigRocks, canEdit: true }
    })
    const addBtn = wrapper.findAll('button').find(b => b.text().includes('Add Big Rock'))
    await addBtn.trigger('click')
    expect(wrapper.emitted('addRock')).toBeTruthy()
  })

  it('has table caption for accessibility', () => {
    const wrapper = mount(BigRocksTable, {
      props: { bigRocks, canEdit: false }
    })
    const caption = wrapper.find('caption')
    expect(caption.exists()).toBe(true)
    expect(caption.classes()).toContain('sr-only')
  })

  it('uses scope="col" on all header cells', () => {
    const wrapper = mount(BigRocksTable, {
      props: { bigRocks, canEdit: false }
    })
    const ths = wrapper.findAll('th')
    for (const th of ths) {
      expect(th.attributes('scope')).toBe('col')
    }
  })

  it('shows skeleton rows when loading is true', () => {
    const wrapper = mount(BigRocksTable, {
      props: { bigRocks: [], canEdit: false, loading: true }
    })
    // Should show skeleton rows, not the empty state
    expect(wrapper.text()).not.toContain('No Big Rocks configured')
    const skeletonRows = wrapper.findAll('.animate-pulse')
    expect(skeletonRows.length).toBe(3)
  })

  it('hides skeleton and shows data when loading is false', () => {
    const wrapper = mount(BigRocksTable, {
      props: { bigRocks, canEdit: false, loading: false }
    })
    expect(wrapper.findAll('.animate-pulse').length).toBe(0)
    expect(wrapper.text()).toContain('Rock A')
    expect(wrapper.text()).toContain('Rock B')
  })

  it('shows empty state when loading is false and no rocks', () => {
    const wrapper = mount(BigRocksTable, {
      props: { bigRocks: [], canEdit: false, loading: false }
    })
    expect(wrapper.text()).toContain('No Big Rocks configured')
    expect(wrapper.findAll('.animate-pulse').length).toBe(0)
  })
})

describe('FilterBar', () => {
  const filterOptions = {
    pillars: ['Inference', 'Platform'],
    rocks: ['Rock A', 'Rock B'],
    statuses: ['In Progress', 'New'],
    priorities: ['Major', 'Normal'],
    teams: ['Serving', 'Training']
  }

  it('renders search input with aria-label', () => {
    const wrapper = mount(FilterBar, {
      props: { filterOptions, activeTab: 'features' }
    })
    const input = wrapper.find('input[type="text"]')
    expect(input.exists()).toBe(true)
    expect(input.attributes('aria-label')).toBe('Search issues')
  })

  it('shows pillar filter on big-rocks tab', () => {
    const wrapper = mount(FilterBar, {
      props: { filterOptions, activeTab: 'big-rocks' }
    })
    const selects = wrapper.findAll('select')
    const pillarSelect = selects.find(s => s.attributes('aria-label') === 'Filter by pillar')
    expect(pillarSelect).toBeTruthy()
  })

  it('shows rock/status/priority filters on features tab', () => {
    const wrapper = mount(FilterBar, {
      props: { filterOptions, activeTab: 'features' }
    })
    const selects = wrapper.findAll('select')
    expect(selects.length).toBeGreaterThanOrEqual(3)
  })

  it('shows Clear Filters button when filters are active', () => {
    const wrapper = mount(FilterBar, {
      props: { filterOptions, activeTab: 'features', hasActiveFilters: true }
    })
    expect(wrapper.text()).toContain('Clear Filters')
  })

  it('hides Clear Filters button when no filters active', () => {
    const wrapper = mount(FilterBar, {
      props: { filterOptions, activeTab: 'features', hasActiveFilters: false }
    })
    expect(wrapper.text()).not.toContain('Clear Filters')
  })
})
