import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BigRockRow from '../../../client/plan/components/BigRockRow.vue'
import BigRocksTable from '../../../client/plan/components/BigRocksTable.vue'
import FilterBar from '../../../client/plan/components/FilterBar.vue'

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

  it('renders rock name', () => {
    const wrapper = mountRow()
    expect(wrapper.text()).toContain('MaaS')
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

  it('shows Add button when canAdd is true', () => {
    const wrapper = mount(BigRocksTable, {
      props: { bigRocks, canEdit: true, canAdd: true }
    })
    expect(wrapper.text()).toContain('Add Big Rock')
  })

  it('hides Add button when canAdd is false', () => {
    const wrapper = mount(BigRocksTable, {
      props: { bigRocks, canEdit: true, canAdd: false }
    })
    expect(wrapper.text()).not.toContain('Add Big Rock')
  })

  it('emits addRock when Add button is clicked', async () => {
    const wrapper = mount(BigRocksTable, {
      props: { bigRocks, canEdit: true, canAdd: true }
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

  it('shows edit pencil button in edit mode', () => {
    const wrapper = mount(BigRocksTable, {
      props: { bigRocks, canEdit: true }
    })
    const editBtn = wrapper.find('button[aria-label="Edit Rock A"]')
    expect(editBtn.exists()).toBe(true)
  })

  it('emits editRock when pencil button is clicked', async () => {
    const wrapper = mount(BigRocksTable, {
      props: { bigRocks, canEdit: true }
    })
    const editBtn = wrapper.find('button[aria-label="Edit Rock A"]')
    await editBtn.trigger('click')
    expect(wrapper.emitted('editRock')).toBeTruthy()
    expect(wrapper.emitted('editRock')[0][0]).toMatchObject({ name: 'Rock A' })
  })

  it('does not show edit pencil in read-only mode', () => {
    const wrapper = mount(BigRocksTable, {
      props: { bigRocks, canEdit: false }
    })
    const editBtn = wrapper.find('button[aria-label="Edit Rock A"]')
    expect(editBtn.exists()).toBe(false)
  })

  it('sets draggable="true" when canReorder is true', () => {
    const wrapper = mount(BigRocksTable, {
      props: { bigRocks, canEdit: true, canReorder: true }
    })
    const rows = wrapper.findAll('tbody tr')
    expect(rows[0].attributes('draggable')).toBe('true')
  })

  it('sets draggable="false" when canReorder is false', () => {
    const wrapper = mount(BigRocksTable, {
      props: { bigRocks, canEdit: true, canReorder: false }
    })
    const rows = wrapper.findAll('tbody tr')
    expect(rows[0].attributes('draggable')).toBe('false')
  })

  it('shows toolbar reorder text when canReorder is true', () => {
    const wrapper = mount(BigRocksTable, {
      props: { bigRocks, canEdit: true, canReorder: true }
    })
    expect(wrapper.text()).not.toContain('Click a row to edit')
    expect(wrapper.text()).toContain('Drag to reorder')
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
