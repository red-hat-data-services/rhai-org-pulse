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
    tier1: { features: 20, rfes: 5 },
    tier2: { features: 15, rfes: 5 },
    tier3: { features: 7, rfes: 0 }
  }

  it('renders all four tier cards', () => {
    const wrapper = mount(SummaryCards, { props: { summary } })
    expect(wrapper.text()).toContain('Tier 1')
    expect(wrapper.text()).toContain('Tier 2')
    expect(wrapper.text()).toContain('Tier 3')
    expect(wrapper.text()).toContain('Totals')
  })

  it('shows correct feature and RFE counts', () => {
    const wrapper = mount(SummaryCards, { props: { summary } })
    expect(wrapper.text()).toContain('42')
    expect(wrapper.text()).toContain('10')
    expect(wrapper.text()).toContain('20')
  })

  it('renders nothing when summary is null', () => {
    const wrapper = mount(SummaryCards, { props: { summary: null } })
    expect(wrapper.text()).toBe('')
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
