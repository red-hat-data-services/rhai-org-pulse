import { describe, it, expect } from 'vitest'
import { ref, nextTick } from 'vue'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import {
  resolveSelectedRun,
  collectMatrixRowIds,
  dscSourceStatusClass,
  orderDayRunsForPanel,
  cellDisplayStatus,
  statusColorClass,
  cellSourceStatusSubtitle,
  gateIndicatesFailure,
  resolveDisplayMatrixCell,
  listNightlyJenkinsJobOptions,
  jenkinsJobPathFromUrl,
  TEST_RESULTS_SOURCE_QUERY_PARAM,
  streamKeyFromTestResultsSourceQuery,
  testResultsSourceQueryValue,
  cellSourceStatusSubtitlePrefix,
  normalizeHeatmapComponentToNightlyId,
  findMatrixCell,
  readinessCellTone,
  nightlyCellTone,
  formatNightlyStatusLabel,
  titleCaseLabel,
  rowLabel,
  rowLabelTooltip,
  nightlyRowHeatmapLinkTarget,
  useNightlyHealthMatrix,
  NIGHTLY_PAGE_SIZE,
  nightlyColumnsPerPage,
  visibleDayWindow,
  buildComponentIdentityIndex,
  resolveHeatmapComponentToRowId,
  producerRowIdsMatchingHeatmapLabel
} from '../../client/composables/useNightlyHealthMatrix'

const fixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../fixtures/system-health/test-execution/nightly_health.json'
)

describe('useNightlyHealthMatrix helpers', () => {
  it('fixture resolves latest run per day', () => {
    const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'))
    const nov1 = fixture.days.find((d) => d.date === '2026-11-01')
    const { run, error } = resolveSelectedRun(nov1)
    expect(error).toBeNull()
    expect(run.run_id).toBe('example-job:102')
  })

  it('collects gate rows before component ids', () => {
    const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'))
    const ids = collectMatrixRowIds(fixture.days)
    expect(ids[0]).toBe('cluster-health')
    expect(ids[1]).toBe('operator-health')
    expect(ids).toContain('dashboard')
  })

  it('adds heatmap inventory rows missing from nightly JSON', () => {
    const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'))
    const heatmap = [{ component: 'Batch Gateway' }, { component: 'Kserve' }]
    const ids = collectMatrixRowIds(fixture.days, heatmap)
    expect(ids).toContain('batchgateway')
    expect(ids).toContain('kserve')
    const dashIdx = ids.indexOf('dashboard')
    const batchIdx = ids.indexOf('batchgateway')
    expect(batchIdx).toBeGreaterThan(-1)
    expect(dashIdx).toBeGreaterThan(batchIdx)
  })

  it('joins heatmap labels to producer YAML ids via canonical name and jira_component (MR !5 + PR #1855)', () => {
    const days = [
      {
        date: '2026-11-01',
        stream_key: 'promotion-gate',
        latest_run_id: 'promotion-gate-tests:41',
        runs: [
          {
            run_id: 'promotion-gate-tests:41',
            gates: [
              { id: 'cluster-health', source_status: 'passed', state: 'ready' },
              { id: 'operator-health', source_status: 'passed', state: 'ready' }
            ],
            components: [
              {
                id: 'kserve',
                name: 'Serving Orchestration',
                jira_component: 'Serving Orchestration',
                source_status: 'passed',
                state: 'ready'
              },
              {
                id: 'trainer',
                name: 'Training',
                jira_component: 'Training Kubeflow',
                source_status: 'passed',
                state: 'ready'
              }
            ]
          }
        ]
      }
    ]
    const heatmap = [{ component: 'Serving Orchestration' }, { component: 'Training Kubeflow' }]
    const ids = collectMatrixRowIds(days, heatmap)
    expect(ids).not.toContain('servingorchestration')
    expect(ids).not.toContain('training')
    expect(ids).toEqual(['cluster-health', 'operator-health', 'kserve', 'trainer'])

    const run = days[0].runs[0]
    expect(findMatrixCell(run, 'kserve')).toBeTruthy()
    expect(findMatrixCell(run, 'servingorchestration')).toBeNull()
    expect(findMatrixCell(run, 'trainer')).toBeTruthy()

    const kserveCell = resolveDisplayMatrixCell(run, 'kserve')
    const trainerCell = resolveDisplayMatrixCell(run, 'trainer')
    expect(rowLabel('kserve', kserveCell)).toBe('Serving Orchestration')
    expect(rowLabel('trainer', trainerCell)).toBe('Training Kubeflow')
    expect(cellDisplayStatus(kserveCell)).toBe('Passed')
    expect(cellDisplayStatus(trainerCell)).toBe('Passed')
  })

  it('marks shared canonical identity ambiguous in global index (no first-wins row id)', () => {
    const days = [
      {
        date: '2026-11-01',
        runs: [
          {
            run_id: 'a:1',
            components: [
              {
                id: 'trainer',
                name: 'Training',
                jira_component: 'Training Kubeflow',
                source_status: 'passed'
              }
            ]
          }
        ]
      },
      {
        date: '2026-11-02',
        runs: [
          {
            run_id: 'b:1',
            components: [
              {
                id: 'trainingoperator',
                name: 'Training',
                jira_component: 'Training Kubeflow',
                source_status: 'passed'
              }
            ]
          }
        ]
      }
    ]
    const index = buildComponentIdentityIndex(days)
    expect(index.get('training')).toBeNull()
    expect(index.get('trainingkubeflow')).toBeNull()
    expect(resolveHeatmapComponentToRowId('Training', days)).toBeNull()
    expect(resolveHeatmapComponentToRowId('Training Kubeflow', days)).toBeNull()
    expect(producerRowIdsMatchingHeatmapLabel('Training', days).sort()).toEqual([
      'trainer',
      'trainingoperator'
    ])
  })

  it('matches heatmap labels to producer names that differ only by punctuation', () => {
    const days = [{
      date: '2026-11-01',
      runs: [{
        run_id: 'r1',
        components: [{ id: 'aigateway', name: 'AI-Gateway', jira_component: 'AI Gateway' }]
      }]
    }]
    expect(resolveHeatmapComponentToRowId('AI Gateway', days)).toBe('aigateway')
    expect(resolveHeatmapComponentToRowId('AI-Gateway', days)).toBe('aigateway')
  })

  it('collects both producer ids when heatmap label shares canonical name across id change', () => {
    const days = [
      {
        date: '2026-11-01',
        latest_run_id: 'a:1',
        runs: [
          {
            run_id: 'a:1',
            gates: [],
            components: [
              {
                id: 'trainer',
                name: 'Training',
                jira_component: 'Training Kubeflow',
                source_status: 'passed',
                state: 'ready'
              }
            ]
          }
        ]
      },
      {
        date: '2026-11-02',
        latest_run_id: 'b:1',
        runs: [
          {
            run_id: 'b:1',
            gates: [],
            components: [
              {
                id: 'trainingoperator',
                name: 'Training',
                jira_component: 'Training Kubeflow',
                source_status: 'failed',
                state: 'failed'
              }
            ]
          }
        ]
      }
    ]
    const heatmap = [{ component: 'Training Kubeflow' }]
    const ids = collectMatrixRowIds(days, heatmap)
    expect(ids).toContain('trainer')
    expect(ids).toContain('trainingoperator')
    expect(resolveHeatmapComponentToRowId('Training Kubeflow', days, { run: days[0].runs[0] })).toBe(
      'trainer'
    )
    expect(resolveHeatmapComponentToRowId('Training', days, { run: days[1].runs[0] })).toBe(
      'trainingoperator'
    )
  })

  it('nightlyRowHeatmapLinkTarget skips gate rows and resolves heatmap component names', () => {
    const days = [{
      date: '2026-11-01',
      runs: [{
        run_id: 'r1',
        components: [
          { id: 'aigateway', name: 'AI Gateway' },
          { id: 'dashboard', name: 'Dashboard' }
        ]
      }]
    }]
    const heatmap = [{ component: 'AI Gateway' }, { component: 'Dashboard' }]
    expect(nightlyRowHeatmapLinkTarget('cluster-health', heatmap, days)).toBeNull()
    expect(nightlyRowHeatmapLinkTarget('operator-health', heatmap, days)).toBeNull()
    expect(nightlyRowHeatmapLinkTarget('aigateway', heatmap, days)).toBe('AI Gateway')
    expect(nightlyRowHeatmapLinkTarget('dashboard', heatmap, days)).toBe('Dashboard')
    expect(nightlyRowHeatmapLinkTarget('unknown-row', heatmap, days)).toBeNull()
  })

  it('ignores non-array gates when collecting row ids', () => {
    const days = [{
      date: '2026-11-01',
      runs: [{ run_id: 'r1', gates: {}, components: [{ id: 'dashboard' }] }]
    }]
    expect(() => collectMatrixRowIds(days)).not.toThrow()
    expect(collectMatrixRowIds(days)).toEqual([
      'cluster-health',
      'operator-health',
      'dashboard'
    ])
  })

  it('prefers source_status for display', () => {
    expect(cellDisplayStatus({ source_status: 'NotInstalled', state: 'not_applicable' })).toBe('Not Installed')
    expect(cellDisplayStatus({ state: 'ready' })).toBe('Passed')
    expect(statusColorClass('passed')).toBe('green')
    expect(statusColorClass('NotInstalled')).toBe('muted')
    expect(statusColorClass('NotReady')).toBe('red')
    expect(statusColorClass('Not Ready')).toBe('red')
  })

  it('shows Blocked for readiness state even when source_status is failed', () => {
    expect(
      cellDisplayStatus({
        state: 'blocked',
        source_status: 'failed',
        reason_code: 'deployment_failed'
      })
    ).toBe('Blocked')
    expect(statusColorClass('blocked')).toBe('blocked')
  })

  it('uses five-day page size constant', () => {
    expect(NIGHTLY_PAGE_SIZE).toBe(5)
  })

  it('maps DSC source_status to subtitle color classes', () => {
    expect(dscSourceStatusClass('Ready')).toBe('dsc-status-ready')
    expect(dscSourceStatusClass('NotReady')).toBe('dsc-status-not-ready')
    expect(dscSourceStatusClass('Not Ready')).toBe('dsc-status-not-ready')
    expect(dscSourceStatusClass('Unknown')).toBe('')
  })

  it('shows all days on one page when snapshot has at most NIGHTLY_PAGE_SIZE days', () => {
    expect(nightlyColumnsPerPage(4)).toBe(4)
    expect(nightlyColumnsPerPage(5)).toBe(5)
    expect(nightlyColumnsPerPage(6)).toBe(NIGHTLY_PAGE_SIZE)
    expect(nightlyColumnsPerPage(3)).toBe(3)
  })

  it('visible window slice is ascending; UI reverses to newest-first columns', () => {
    const days = [
      { date: '2026-10-26' },
      { date: '2026-10-28' },
      { date: '2026-11-01' },
      { date: '2026-11-02' }
    ]
    const per = nightlyColumnsPerPage(4)
    const window0 = visibleDayWindow(days, 0, per)
    expect(window0.map((d) => d.date)).toEqual([
      '2026-10-26',
      '2026-10-28',
      '2026-11-01',
      '2026-11-02'
    ])
    expect(window0.slice().reverse().map((d) => d.date)).toEqual([
      '2026-11-02',
      '2026-11-01',
      '2026-10-28',
      '2026-10-26'
    ])
  })

  it('derives Blocked for components when RHOAI deployment gate failed (legacy JSON)', () => {
    const run = {
      gates: [
        { id: 'cluster-health', source_status: 'passed' },
        { id: 'operator-health', source_status: 'failed', tests: { passed: 3, failed: 1, skipped: 0 } }
      ],
      components: [
        { id: 'dashboard', name: 'Dashboard', state: 'ready', source_status: 'NotReady' }
      ]
    }
    expect(gateIndicatesFailure(run.gates[1])).toBe(true)
    const cell = resolveDisplayMatrixCell(run, 'dashboard')
    expect(cellDisplayStatus(cell)).toBe('Blocked')
    expect(cellSourceStatusSubtitle(cell)).toBe('NotReady')
  })

  it('uses red tile tone when ready cell label is Not Ready from source_status', () => {
    expect(nightlyCellTone({ state: 'ready', source_status: 'NotReady' })).toBe('red')
  })

  it('orders day panel runs with latest_run_id first', () => {
    const day = {
      latest_run_id: 'run-b',
      runs: [
        { run_id: 'run-a', started_at: '2026-11-01T10:00:00Z', build_number: 101 },
        { run_id: 'run-b', started_at: '2026-11-01T14:00:00Z', build_number: 102 }
      ]
    }
    const ordered = orderDayRunsForPanel(day)
    expect(ordered.map((r) => r.run_id)).toEqual(['run-b', 'run-a'])
  })

  it('orders an older latest_run_id run first with remaining runs ascending', () => {
    const day = {
      latest_run_id: 'run-b',
      runs: [
        { run_id: 'run-a', started_at: '2026-11-01T08:00:00Z', build_number: 101 },
        { run_id: 'run-b', started_at: '2026-11-01T10:00:00Z', build_number: 102 },
        { run_id: 'run-c', started_at: '2026-11-01T14:00:00Z', build_number: 103 }
      ]
    }
    const ordered = orderDayRunsForPanel(day)
    expect(ordered.map((r) => r.run_id)).toEqual(['run-b', 'run-a', 'run-c'])
  })

  it('pageOlder shows the oldest day window in visibleDays', () => {
    const dates = [
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02'
    ]
    const payloadRef = ref({
      schema_version: 1,
      days: dates.map((date) => ({
        date,
        latest_run_id: 'run-a',
        runs: [{ run_id: 'run-a', components: [{ id: 'dashboard', state: 'ready', reason_code: 'ok' }] }]
      }))
    })
    const { visibleDays, pageOlder, maxPageOffset } = useNightlyHealthMatrix(payloadRef)
    expect(maxPageOffset.value).toBe(1)
    expect(visibleDays.value.map((d) => d.date)).toEqual([
      '2026-11-02',
      '2026-11-01',
      '2026-10-31',
      '2026-10-30',
      '2026-10-29'
    ])
    pageOlder()
    expect(visibleDays.value.map((d) => d.date)).toEqual([
      '2026-10-28',
      '2026-10-27',
      '2026-10-26'
    ])
  })

  it('maps readiness to green, amber, and red cell tones', () => {
    expect(readinessCellTone({ state: 'ready', source_status: 'passed' })).toBe('green')
    expect(readinessCellTone({ state: 'blocked', source_status: 'NotReady' })).toBe('amber')
    expect(readinessCellTone({ state: 'failed', source_status: 'failed' })).toBe('red')
    expect(readinessCellTone({ source_status: 'passed' })).toBe('green')
    expect(readinessCellTone({ source_status: 'failed' })).toBe('red')
  })

  it('formats matrix status labels in title case', () => {
    expect(formatNightlyStatusLabel('passed')).toBe('Passed')
    expect(formatNightlyStatusLabel('not ready')).toBe('Not Ready')
    expect(titleCaseLabel('cluster health')).toBe('Cluster Health')
  })

  it('prefers jira_component for matrix row label and tooltip keeps id and canonical name', () => {
    expect(
      rowLabel('trainer', {
        id: 'trainer',
        name: 'Training',
        jira_component: 'Training Kubeflow'
      })
    ).toBe('Training Kubeflow')
    expect(
      rowLabelTooltip('trainer', {
        id: 'trainer',
        name: 'Training',
        jira_component: 'Training Kubeflow'
      })
    ).toBe('id: trainer · dashboard: Training · jira: Training Kubeflow')
  })

  it('maps RHOAI deployment heatmap label case-insensitively', () => {
    expect(normalizeHeatmapComponentToNightlyId('RHOAI deployment')).toBe('operator-health')
    expect(normalizeHeatmapComponentToNightlyId('Cluster Health')).toBe('cluster-health')
    expect(cellSourceStatusSubtitlePrefix('cluster-health')).toBe('Gate')
    expect(cellSourceStatusSubtitlePrefix('dashboard')).toBe('DSC')
  })

  it('lists Jenkins job options from stream_key and jenkins_jobs metadata', () => {
    const payload = {
      schema_version: 1,
      jenkins_jobs: [
        { stream_key: 'gate-a', label: 'devops/promotion-gate-a', jenkins_job: 'devops/promotion-gate-a' },
        { stream_key: 'gate-b', label: 'devops/promotion-gate-b', jenkins_job: 'devops/promotion-gate-b' }
      ],
      days: [
        { date: '2026-11-01', stream_key: 'gate-a', runs: [] },
        { date: '2026-11-01', stream_key: 'gate-b', runs: [] }
      ]
    }
    const options = listNightlyJenkinsJobOptions(payload)
    expect(options.map((o) => o.stream_key)).toEqual(['gate-a', 'gate-b'])
    expect(options[0].label).toBe('devops/promotion-gate-a')
  })

  it('maps test results source query param to stream_key and back', () => {
    expect(TEST_RESULTS_SOURCE_QUERY_PARAM).toBe('source')
    const payload = {
      schema_version: 1,
      jenkins_jobs: [
        { stream_key: 'pg', label: 'devops/promotion-gate-tests', jenkins_job: 'devops/promotion-gate-tests' },
        { stream_key: 'bvt', label: 'devops/nightly-bvt', jenkins_job: 'devops/nightly-bvt' }
      ],
      days: [
        { date: '2026-11-01', stream_key: 'pg', runs: [] },
        { date: '2026-11-01', stream_key: 'bvt', runs: [] }
      ]
    }
    expect(streamKeyFromTestResultsSourceQuery(payload, 'devops/promotion-gate-tests')).toBe('pg')
    expect(streamKeyFromTestResultsSourceQuery(payload, 'pg')).toBe('pg')
    expect(testResultsSourceQueryValue(payload, 'bvt')).toBe('devops/nightly-bvt')
    expect(streamKeyFromTestResultsSourceQuery(payload, 'unknown')).toBeNull()
  })

  it('uses stream_key in source query when jenkins_jobs labels collide', () => {
    const payload = {
      schema_version: 1,
      jenkins_jobs: [
        { stream_key: 'a', label: 'devops/same-label', jenkins_job: 'devops/job-a' },
        { stream_key: 'b', label: 'devops/same-label', jenkins_job: 'devops/job-b' }
      ],
      days: [
        { date: '2026-11-01', stream_key: 'a', runs: [] },
        { date: '2026-11-01', stream_key: 'b', runs: [] }
      ]
    }
    expect(testResultsSourceQueryValue(payload, 'a')).toBe('a')
    expect(testResultsSourceQueryValue(payload, 'b')).toBe('b')
  })

  it('round-trips stream_key when label matches another option field', () => {
    const payload = {
      schema_version: 1,
      jenkins_jobs: [
        { stream_key: 'pg', label: 'devops/promotion-gate', jenkins_job: 'devops/promotion-gate' },
        { stream_key: 'bvt', label: 'pg', jenkins_job: 'devops/bvt' }
      ],
      days: [
        { date: '2026-11-01', stream_key: 'pg', runs: [] },
        { date: '2026-11-02', stream_key: 'bvt', runs: [] }
      ]
    }
    expect(testResultsSourceQueryValue(payload, 'bvt')).toBe('bvt')
    expect(streamKeyFromTestResultsSourceQuery(payload, 'bvt')).toBe('bvt')
    expect(streamKeyFromTestResultsSourceQuery(payload, 'pg')).toBe('pg')
  })

  it('omits jenkins_jobs catalog entries that have no day rows', () => {
    const payload = {
      schema_version: 1,
      jenkins_jobs: [
        { stream_key: 'empty-catalog', label: 'devops/empty', jenkins_job: 'devops/empty' },
        { stream_key: 'gate-a', label: 'devops/promotion-gate-a', jenkins_job: 'devops/promotion-gate-a' }
      ],
      days: [{ date: '2026-11-01', stream_key: 'gate-a', latest_run_id: 'a:1', runs: [] }]
    }
    const options = listNightlyJenkinsJobOptions(payload)
    expect(options.map((o) => o.stream_key)).toEqual(['gate-a'])
  })

  it('keeps numeric Jenkins folder segments in job paths from URLs', () => {
    const url = 'https://jenkins.example/job/devops/job/123/job/nightly/42/'
    expect(jenkinsJobPathFromUrl(url)).toBe('devops/123/nightly')
  })

  it('decodes percent-encoded Jenkins job path segments', () => {
    const url = 'https://jenkins.example/job/devops/job/promotion%20gate/42/'
    expect(jenkinsJobPathFromUrl(url)).toBe('devops/promotion gate')
  })

  it('filters omitted stream_key days under the default option when multiple streams exist', async () => {
    const payloadRef = ref({
      schema_version: 1,
      jenkins_jobs: [
        { stream_key: 'gate-a', label: 'folder/gate-a', jenkins_job: 'folder/gate-a' }
      ],
      days: [
        { date: '2026-11-01', stream_key: 'gate-a', latest_run_id: 'a:1', runs: [] },
        { date: '2026-11-02', latest_run_id: 'd:1', runs: [{ run_id: 'd:1', components: [] }] }
      ]
    })
    const selectedStreamKey = ref('default')
    const { sortedDays, jenkinsJobOptions } = useNightlyHealthMatrix(payloadRef, null, selectedStreamKey)
    expect(jenkinsJobOptions.value.map((o) => o.stream_key).sort()).toEqual(['default', 'gate-a'])
    expect(sortedDays.value.map((d) => d.date)).toEqual(['2026-11-02'])
    selectedStreamKey.value = 'gate-a'
    await nextTick()
    expect(sortedDays.value.map((d) => d.date)).toEqual(['2026-11-01'])
  })

  it('derives Jenkins job label from build URL when metadata is missing', () => {
    const url = 'https://jenkins.example/job/devops/job/nightly-gate/42/'
    expect(jenkinsJobPathFromUrl(url)).toBe('devops/nightly-gate')
    const options = listNightlyJenkinsJobOptions({
      schema_version: 1,
      days: [{
        date: '2026-11-01',
        stream_key: 'nightly-gate',
        runs: [{ run_id: 'nightly-gate:42', jenkins_url: url }]
      }]
    })
    expect(options).toHaveLength(1)
    expect(options[0].label).toBe('devops/nightly-gate')
  })

  it('keeps selected stream_key when payload refreshes if still valid', async () => {
    const payloadRef = ref({
      schema_version: 1,
      generated_at: '2026-11-01T00:00:00Z',
      jenkins_jobs: [
        { stream_key: 'job-a', label: 'folder/job-a', jenkins_job: 'folder/job-a' },
        { stream_key: 'job-b', label: 'folder/job-b', jenkins_job: 'folder/job-b' }
      ],
      days: [
        { date: '2026-11-01', stream_key: 'job-a', latest_run_id: 'a:1', runs: [] },
        { date: '2026-11-01', stream_key: 'job-b', latest_run_id: 'b:1', runs: [] }
      ]
    })
    const selectedStreamKey = ref('job-b')
    useNightlyHealthMatrix(payloadRef, null, selectedStreamKey)
    expect(selectedStreamKey.value).toBe('job-b')
    payloadRef.value = {
      ...payloadRef.value,
      generated_at: '2026-11-02T00:00:00Z'
    }
    await nextTick()
    expect(selectedStreamKey.value).toBe('job-b')
  })
})
