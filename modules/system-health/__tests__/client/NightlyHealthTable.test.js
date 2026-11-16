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

  it('puts S3 Artifacts link on the Jenkins line in the day panel', async () => {
    const s3Href =
      'https://us-east-1.console.aws.amazon.com/s3/buckets/b?region=us-east-1&prefix=ci/7/'
    const payload = {
      schema_version: 1,
      days: [{
        date: '2026-11-08',
        latest_run_id: 'job:7',
        runs: [{
          run_id: 'job:7',
          build_number: 7,
          jenkins_url: 'https://jenkins.example/job/1/7/',
          promotion_gate: { status: 'passed' },
          artifacts: { s3_artifacts: s3Href },
          gates: [],
          components: []
        }]
      }]
    }
    wrapper = mount(NightlyHealthTable, { props: { payload }, ...mountOptions })
    await wrapper.find('.date-header-btn').trigger('click')
    await nextTick()

    const item = document.body.querySelector('.run-list-item')
    expect(item).toBeTruthy()
    const line = item.querySelector('.run-line')
    expect(line.textContent).toContain('Jenkins run')
    expect(line.textContent).toContain('#7')
    expect(line.textContent).toContain('S3 Artifacts')
    expect(line.textContent).not.toContain('passed')
    expect(line.textContent).not.toContain('Open')
    const s3Anchor = Array.from(line.querySelectorAll('a')).find((a) => a.textContent === 'Artifacts')
    expect(s3Anchor?.getAttribute('href')).toBe(s3Href)
    const jenkinsAnchor = line.querySelector('a.run-inline-link')
    expect(jenkinsAnchor?.textContent).toContain('Jenkins run')
    expect(jenkinsAnchor?.textContent).not.toBe('Artifacts')
  })

  it('shows S3 Artifacts without Jenkins label when Jenkins metadata is absent', async () => {
    const s3Href =
      'https://us-east-1.console.aws.amazon.com/s3/buckets/b?region=us-east-1&prefix=ci/9/'
    const payload = {
      schema_version: 1,
      days: [{
        date: '2026-11-09',
        latest_run_id: 'job:9',
        runs: [{
          run_id: 'job:9',
          artifacts: { s3_artifacts: s3Href },
          gates: [],
          components: []
        }]
      }]
    }
    wrapper = mount(NightlyHealthTable, { props: { payload }, ...mountOptions })
    await wrapper.find('.date-header-btn').trigger('click')
    await nextTick()

    const item = document.body.querySelector('.run-list-item')
    const line = item.querySelector('.run-line')
    expect(line.textContent).not.toContain('Jenkins')
    expect(line.textContent).toContain('S3 Artifacts')
    const s3Anchor = line.querySelector('a.run-inline-link')
    expect(s3Anchor?.getAttribute('href')).toBe(s3Href)
    expect(s3Anchor?.textContent).toBe('Artifacts')
  })

  it('renders org_pulse_links in the day panel', async () => {
    const ticketHref = 'https://example.invalid/notes/999'
    const payload = {
      schema_version: 1,
      days: [{
        date: '2026-11-09',
        latest_run_id: 'job:1',
        runs: [{
          run_id: 'job:1',
          build_number: 1,
          jenkins_url: 'https://jenkins.example/job/1/1/',
          org_pulse_links: [{ label: 'Release notes', href: ticketHref }],
          gates: [],
          components: []
        }]
      }]
    }
    wrapper = mount(NightlyHealthTable, { props: { payload }, ...mountOptions })
    await wrapper.find('.date-header-btn').trigger('click')
    await nextTick()

    const anchors = Array.from(document.body.querySelectorAll('.run-list-item a.run-inline-link'))
    const ticketAnchor = anchors.find((a) => a.getAttribute('href') === ticketHref)
    expect(ticketAnchor).toBeTruthy()
    expect(ticketAnchor?.textContent).toBe('Open')
    expect(document.body.textContent).toContain('Release notes')
  })

  function mountSingleRun(run) {
    const payload = {
      schema_version: 1,
      days: [{
        date: '2026-11-09',
        latest_run_id: 'job:1',
        runs: [{
          run_id: 'job:1',
          build_number: 1,
          jenkins_url: 'https://jenkins.example/job/1/1/',
          gates: [],
          components: [],
          ...run
        }]
      }]
    }
    wrapper = mount(NightlyHealthTable, { props: { payload }, ...mountOptions })
    return wrapper.find('.date-header-btn').trigger('click').then(() => nextTick())
  }

  it('opens and closes the S3 access help popover from the Runs on header', async () => {
    await mountSingleRun({})
    const btn = document.body.querySelector('.s3-help-btn')
    expect(btn).toBeTruthy()
    expect(btn.textContent).toContain('S3 access help')
    expect(btn.getAttribute('aria-expanded')).toBe('false')
    expect(document.body.querySelector('.s3-help-popover')).toBeNull()

    btn.click()
    await nextTick()
    const pop = document.body.querySelector('.s3-help-popover')
    expect(pop).toBeTruthy()
    expect(btn.getAttribute('aria-expanded')).toBe('true')
    expect(pop.getAttribute('id')).toBe(btn.getAttribute('aria-controls'))
    expect(pop.textContent).toContain('qe-rhods-general')
    expect(pop.textContent).toContain('rhoai-testops')
    expect(pop.textContent).toContain('#rhoai-devtestops-requests')
    const login = pop.querySelector('a')
    expect(login.getAttribute('href')).toBe('https://auth.redhat.com/auth/realms/EmployeeIDP/protocol/saml/clients/itaws')
    expect(login.getAttribute('target')).toBe('_blank')

    pop.querySelector('.s3-help-close').click()
    await nextTick()
    expect(document.body.querySelector('.s3-help-popover')).toBeNull()
  })

  it('renders Jira keys as hyperlinks with created/reused action', async () => {
    const href1 = 'https://redhat.atlassian.net/browse/RHOAIENG-1'
    const href2 = 'https://redhat.atlassian.net/browse/RHOAIENG-2'
    await mountSingleRun({
      jira: {
        status: 'live',
        issues: [
          { key: 'RHOAIENG-1', href: href1, action: 'created' },
          { key: 'RHOAIENG-2', href: href2, action: 'reused' }
        ]
      }
    })
    const line = document.body.querySelector('[data-testid="run-jira-line"]')
    expect(line.textContent.replace(/\s+/g, ' ')).toContain('Jira: RHOAIENG-1 (created) · RHOAIENG-2 (reused)')
    const anchors = Array.from(line.querySelectorAll('a'))
    expect(anchors.map((a) => a.getAttribute('href'))).toEqual([href1, href2])
    expect(anchors.map((a) => a.textContent)).toEqual(['RHOAIENG-1', 'RHOAIENG-2'])
    expect(anchors[0].getAttribute('target')).toBe('_blank')
    expect(anchors[0].getAttribute('rel')).toContain('noopener')
  })

  it('shows "No Jira tied in this run" when there are no tickets', async () => {
    await mountSingleRun({ jira: { status: 'live', issues: [] } })
    const line = document.body.querySelector('[data-testid="run-jira-line"]')
    expect(line.textContent.trim()).toBe('No Jira tied in this run')
    expect(line.querySelector('a')).toBeNull()
  })

  it('notes dry-run mode when no Jira tickets were created', async () => {
    await mountSingleRun({ jira: { status: 'dry_run', issues: [] } })
    const line = document.body.querySelector('[data-testid="run-jira-line"]')
    expect(line.textContent).toContain('No Jira tied in this run')
    expect(line.textContent).toContain('dry-run')
  })

  it('falls back to legacy Jira links in org_pulse_links', async () => {
    const href = 'https://redhat.atlassian.net/browse/RHOAIENG-77'
    await mountSingleRun({ org_pulse_links: [{ label: 'RHOAIENG-77', href }] })
    const line = document.body.querySelector('[data-testid="run-jira-line"]')
    expect(line.querySelector('a')?.getAttribute('href')).toBe(href)
    const openAnchors = Array.from(document.body.querySelectorAll('.run-list-item a.run-inline-link'))
      .filter((a) => a.textContent === 'Open')
    expect(openAnchors).toHaveLength(0)
  })

  it('renders component rows as plain text without heatmap drill-down links', async () => {
    const payload = JSON.parse(readFileSync(fixturePath, 'utf8'))
    const heatmapComponents = [
      { component: 'Dashboard' },
      { component: 'AI Gateway' }
    ]
    wrapper = mount(NightlyHealthTable, {
      props: { payload, heatmapComponents },
      ...mountOptions
    })

    expect(wrapper.findAll('.comp-name a.comp-link')).toHaveLength(0)
    expect(wrapper.findAll('.comp-name span.comp-label').length).toBeGreaterThanOrEqual(2)
    expect(wrapper.emitted('component-click')).toBeFalsy()
  })
})
