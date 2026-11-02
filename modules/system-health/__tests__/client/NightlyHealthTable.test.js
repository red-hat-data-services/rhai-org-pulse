import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import NightlyHealthTable from '../../client/components/NightlyHealthTable.vue'

const fixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../fixtures/system-health/test-execution/nightly_health.json'
)

describe('NightlyHealthTable', () => {
  it('renders date-column matrix from fixture', () => {
    const payload = JSON.parse(readFileSync(fixturePath, 'utf8'))
    const wrapper = mount(NightlyHealthTable, { props: { payload } })

    expect(wrapper.find('.nightly-matrix').exists()).toBe(true)
    expect(wrapper.text()).toContain('Cluster health')
    expect(wrapper.text()).toContain('RHOAI deployment')
    expect(wrapper.find('.pager-btn').exists()).toBe(true)
  })

  it('shows RHOAI deployment label when gate still has legacy Operator health name', () => {
    const payload = {
      schema_version: 1,
      days: [{
        date: '2026-11-01',
        latest_run_id: 'run-a',
        runs: [{
          run_id: 'run-a',
          gates: [{
            id: 'operator-health',
            name: 'Operator health',
            source_status: 'failed',
            tests: { passed: 3, failed: 1, skipped: 0 }
          }],
          components: []
        }]
      }]
    }
    const wrapper = mount(NightlyHealthTable, { props: { payload } })
    expect(wrapper.text()).toContain('RHOAI deployment')
    expect(wrapper.text()).not.toContain('Operator health')
  })

  it('shows day detail panel with all builds when a date column is clicked', async () => {
    const payload = JSON.parse(readFileSync(fixturePath, 'utf8'))
    const wrapper = mount(NightlyHealthTable, { props: { payload } })

    const headerBtn = wrapper.findAll('.date-header-btn').find((b) => b.text().includes('Nov 1'))
    expect(headerBtn).toBeTruthy()
    await headerBtn.trigger('click')

    expect(wrapper.find('.day-panel').exists()).toBe(true)
    expect(wrapper.text()).toContain('Runs on 2026-11-01')
    expect(wrapper.text()).toContain('Blocked')
    expect(wrapper.text()).toContain('BVT: failed')
    expect(wrapper.text()).toContain('Build #101')
    expect(wrapper.text()).toContain('Build #102')
    expect(wrapper.text()).toContain('Selected for column')
  })

  it('shows unavailable message when latest_run_id is invalid', async () => {
    const payload = {
      schema_version: 1,
      days: [{
        date: '2026-11-01',
        latest_run_id: 'not-in-list',
        runs: [
          {
            run_id: 'run-a',
            gates: [],
            components: [{ id: 'dashboard', name: 'Dashboard', state: 'ready', reason_code: 'ok' }]
          }
        ]
      }]
    }
    const wrapper = mount(NightlyHealthTable, { props: { payload } })

    await wrapper.find('.date-header-btn').trigger('click')
    expect(wrapper.find('.selection-error').exists()).toBe(true)
    expect(wrapper.text()).toContain('not-in-list')
  })
})
