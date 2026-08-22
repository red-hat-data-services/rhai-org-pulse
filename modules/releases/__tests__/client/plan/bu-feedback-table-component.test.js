import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import BuFeedbackTable from '../../../client/plan/components/BuFeedbackTable.vue'

function issue(overrides) {
  return Object.assign({
    key: 'RHOAIENG-1',
    url: 'https://issues.redhat.com/browse/RHOAIENG-1',
    summary: 'Dashboard filter is broken',
    issueType: 'Bug',
    assignee: 'Jane Smith',
    reporter: 'Alex Lee',
    priority: 'Major',
    status: 'New',
    statusCategory: 'To Do',
    resolution: 'Unresolved',
    created: '2026-08-19T12:00:00.000Z',
    updated: '2026-08-19T13:00:00.000Z',
    dueDate: null,
    components: ['AI Core Dashboard', 'Documentation'],
    fixVersions: ['RHOAI 3.2'],
    feedbackLabels: ['AIBU_Feedback']
  }, overrides)
}

function mountTable(issues) {
  return mount(BuFeedbackTable, { props: { issues: issues } })
}

describe('BuFeedbackTable', function() {
  it('renders a compact table with search and multi-select filters outside column headers', function() {
    var wrapper = mountTable([issue()])
    expect(wrapper.find('[data-testid="bu-feedback-search"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="bu-feedback-filter-type"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="bu-feedback-table"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('RHOAIENG-1')
    expect(wrapper.text()).toContain('Dashboard filter is broken')
    expect(wrapper.text()).toContain('BU')
    expect(wrapper.find('thead select').exists()).toBe(false)
    expect(wrapper.find('select').exists()).toBe(false)
  })

  it('shows the full issue type name', function() {
    var wrapper = mountTable([issue({ issueType: 'Feature Request', summary: 'Add export' })])
    var badge = wrapper.findAll('span').filter(function(el) { return el.text() === 'Feature Request' })[0]
    expect(badge).toBeTruthy()
    expect(badge.classes().join(' ')).not.toContain('truncate')
  })

  it('filters rows from the toolbar search', async function() {
    var wrapper = mountTable([
      issue({ key: 'RHOAIENG-1', summary: 'Dashboard filter is broken' }),
      issue({ key: 'RHAIRFE-2', summary: 'Add export', issueType: 'Feature Request' })
    ])
    await wrapper.find('[data-testid="bu-feedback-search"]').setValue('export')
    await nextTick()
    expect(wrapper.text()).toContain('RHAIRFE-2')
    expect(wrapper.text()).not.toContain('RHOAIENG-1')
    expect(wrapper.get('[data-testid="bu-feedback-count"]').text()).toContain('1–1 of 1')
  })

  it('expands a row to show secondary details', async function() {
    var wrapper = mountTable([issue()])
    expect(wrapper.text()).not.toContain('Alex Lee')
    await wrapper.get('[data-testid="bu-feedback-row-RHOAIENG-1"]').trigger('click')
    expect(wrapper.text()).toContain('Alex Lee')
    expect(wrapper.text()).toContain('RHOAI 3.2')
    expect(wrapper.text()).toContain('Unresolved')
  })

  it('pages when there are more than 25 issues', async function() {
    var issues = []
    for (var i = 0; i < 26; i++) {
      issues.push(issue({
        key: 'RHOAIENG-' + (100 + i),
        created: '2026-08-' + String((i % 28) + 1).padStart(2, '0') + 'T00:00:00.000Z'
      }))
    }
    var wrapper = mountTable(issues)
    expect(wrapper.find('[data-testid="bu-feedback-next-page"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="bu-feedback-count"]').text()).toContain('1–25 of 26')
    await wrapper.get('[data-testid="bu-feedback-next-page"]').trigger('click')
    expect(wrapper.get('[data-testid="bu-feedback-count"]').text()).toContain('26–26 of 26')
  })

  it('shows overflow chip when a row has more than two components', function() {
    var wrapper = mountTable([issue({ components: ['One', 'Two', 'Three'] })])
    var overflow = wrapper.findAll('span').filter(function(el) { return el.text() === '+1' })
    expect(overflow.length).toBeGreaterThan(0)
    expect(overflow[0].attributes('title')).toBe('Three')
  })
})
