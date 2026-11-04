import { describe, it, expect, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import NightlyHealthTable from '../../client/components/NightlyHealthTable.vue'

const fixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../fixtures/system-health/test-execution/nightly_health.json'
)

describe('NightlyHealthTable', () => {
  const mountOptions = { attachTo: document.body }
  /** @type {import('@vue/test-utils').VueWrapper|null} */
  let wrapper = null

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
  })

  it('renders date-column matrix from fixture', async () => {
    const payload = JSON.parse(readFileSync(fixturePath, 'utf8'))
    // Oct 28–31 omit stream_key (→ default); Nov 1–2 use example-stream.
    wrapper = mount(NightlyHealthTable, {
      props: { payload, selectedStreamKey: 'default' },
      ...mountOptions
    })
    await nextTick()

    expect(wrapper.find('.nightly-matrix').exists()).toBe(true)
    expect(wrapper.text()).toContain('Cluster Health')
    expect(wrapper.text()).toContain('RHOAI Deployment')
    expect(wrapper.find('.pager-job-select').exists()).toBe(true)
    expect(wrapper.text()).toContain('Showing all 4 UTC days in this snapshot')
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
    wrapper = mount(NightlyHealthTable, { props: { payload }, ...mountOptions })
    expect(wrapper.text()).toContain('RHOAI Deployment')
    expect(wrapper.text()).not.toContain('Operator health')
  })

  it('shows day detail panel with all builds when a date column is clicked', async () => {
    const payload = JSON.parse(readFileSync(fixturePath, 'utf8'))
    wrapper = mount(NightlyHealthTable, { props: { payload }, ...mountOptions })

    await wrapper.find('.pager-job-select').setValue('example-stream')
    await nextTick()

    const headerBtn = wrapper.findAll('.date-header-btn').find((b) => b.text().includes('Nov 1'))
    expect(headerBtn).toBeTruthy()
    await headerBtn.trigger('click')
    await nextTick()

    expect(document.body.querySelector('.day-panel')).toBeTruthy()
    expect(document.body.textContent).toContain('Runs on 2026-11-01')
    expect(document.body.textContent).toContain('Blocked')
    expect(document.body.textContent).toContain('DSC: failed')
    expect(document.body.textContent).toContain('Jenkins run')
    expect(document.body.textContent).toContain('#101')
    expect(document.body.textContent).toContain('#102')
    expect(document.body.textContent).toContain('RHOAI 3.6.0')
    expect(document.body.textContent).not.toContain('Product under test:')
    expect(document.body.textContent).not.toContain('Selected for column')
    expect(document.body.textContent).not.toContain('Product payload (ODS build)')
    expect(document.body.textContent).not.toContain('Test source:')
    expect(document.body.textContent).not.toContain('Unavailable')

    const items = document.body.querySelectorAll('.run-list-item')
    expect(items[0].textContent).toContain('#102')
    expect(items[0].classList.contains('run-list-item--selected')).toBe(true)
  })

  it('shows Jenkins job filter when multiple stream_key values are present', async () => {
    const payload = {
      schema_version: 1,
      jenkins_jobs: [
        { stream_key: 'job-a', label: 'folder/job-a', jenkins_job: 'folder/job-a' },
        { stream_key: 'job-b', label: 'folder/job-b', jenkins_job: 'folder/job-b' }
      ],
      days: [
        {
          date: '2026-11-02',
          stream_key: 'job-a',
          latest_run_id: 'job-a:1',
          runs: [{
            run_id: 'job-a:1',
            build_number: 1,
            gates: [{ id: 'cluster-health', name: 'Cluster health', source_status: 'passed' }],
            components: [{ id: 'dashboard', name: 'Dashboard', state: 'ready', reason_code: 'ok' }]
          }]
        },
        {
          date: '2026-11-02',
          stream_key: 'job-b',
          latest_run_id: 'job-b:9',
          runs: [{
            run_id: 'job-b:9',
            build_number: 9,
            gates: [{ id: 'cluster-health', name: 'Cluster health', source_status: 'failed' }],
            components: [{ id: 'dashboard', name: 'Dashboard', state: 'blocked', reason_code: 'deployment_failed' }]
          }]
        }
      ]
    }
    wrapper = mount(NightlyHealthTable, { props: { payload }, ...mountOptions })

    expect(wrapper.find('.pager-job-select').exists()).toBe(true)
    expect(wrapper.find('.pager-job-select').element.value).toBe('job-a')
    expect(wrapper.text()).toContain('Passed')

    await wrapper.find('.pager-job-select').setValue('job-b')
    expect(wrapper.text()).toContain('Blocked')
  })

  it('hides Jenkins job filter when only one stream is present', () => {
    const payload = {
      schema_version: 1,
      days: [{
        date: '2026-11-01',
        stream_key: 'only-stream',
        latest_run_id: 'run-a',
        runs: [{
          run_id: 'run-a',
          gates: [{ id: 'cluster-health', name: 'Cluster health', source_status: 'passed' }],
          components: [{ id: 'dashboard', name: 'Dashboard', state: 'ready', reason_code: 'ok' }]
        }]
      }]
    }
    wrapper = mount(NightlyHealthTable, { props: { payload }, ...mountOptions })
    expect(wrapper.find('.pager-job-select').exists()).toBe(false)
  })

  it('uses selected stream row names when streams disagree on component display names', async () => {
    const payload = {
      schema_version: 1,
      jenkins_jobs: [
        { stream_key: 'job-a', label: 'folder/job-a', jenkins_job: 'folder/job-a' },
        { stream_key: 'job-b', label: 'folder/job-b', jenkins_job: 'folder/job-b' }
      ],
      days: [
        {
          date: '2026-11-02',
          stream_key: 'job-a',
          latest_run_id: 'job-a:1',
          runs: [{
            run_id: 'job-a:1',
            gates: [{ id: 'cluster-health', name: 'Cluster health', source_status: 'passed' }],
            components: [{ id: 'dashboard', name: 'Dashboard Alpha', state: 'ready', reason_code: 'ok' }]
          }]
        },
        {
          date: '2026-11-02',
          stream_key: 'job-b',
          latest_run_id: 'job-b:1',
          runs: [{
            run_id: 'job-b:1',
            gates: [{ id: 'cluster-health', name: 'Cluster health', source_status: 'passed' }],
            components: [{ id: 'dashboard', name: 'Dashboard Beta', state: 'ready', reason_code: 'ok' }]
          }]
        }
      ]
    }
    wrapper = mount(NightlyHealthTable, { props: { payload }, ...mountOptions })
    expect(wrapper.text()).toContain('Dashboard Alpha')
    await wrapper.find('.pager-job-select').setValue('job-b')
    expect(wrapper.text()).toContain('Dashboard Beta')
    expect(wrapper.text()).not.toContain('Dashboard Alpha')
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
    wrapper = mount(NightlyHealthTable, { props: { payload }, ...mountOptions })

    await wrapper.find('.date-header-btn').trigger('click')
    await nextTick()
    expect(document.body.querySelector('.selection-error')).toBeTruthy()
    expect(document.body.textContent).toContain('not-in-list')
  })

  it('links component rows to heatmap detail and leaves gate rows plain text', async () => {
    const payload = JSON.parse(readFileSync(fixturePath, 'utf8'))
    const heatmapComponents = [
      { component: 'Dashboard' },
      { component: 'AI Gateway' }
    ]
    wrapper = mount(NightlyHealthTable, {
      props: { payload, heatmapComponents },
      ...mountOptions
    })

    const links = wrapper.findAll('.comp-name a.comp-link')
    expect(links.length).toBeGreaterThanOrEqual(2)
    const linkLabels = links.map((a) => a.text())
    expect(linkLabels).not.toContain('Cluster Health')
    expect(linkLabels).not.toContain('RHOAI Deployment')

    await links[0].trigger('click')
    expect(wrapper.emitted('component-click')?.[0]?.[0]).toBeTruthy()
  })
})
