import { describe, it, expect } from 'vitest'
import { ref, nextTick } from 'vue'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import {
  resolveSelectedRun,
  canonicalKeyForRowId,
  collectMatrixRowIds,
  cellDscCaption,
  matrixRowLabel,
  dscSourceStatusClass,
  orderDayRunsForPanel,
  formatRunDuration,
  nightlyColumnHeaderSubline,
  nightlyTestSourceDescription,
  quayBrowserUrlFromImageRef,
  runArtifactPanelEntries,
  runOrgPulsePanelLinks,
  runS3ArtifactsInlineLink,
  runProductUnderTestLabel,
  runOdsBuildUrl,
  quaySha256DigestKey,
  runPromotionGateQuayDigestKeys,
  runOdsBuildLinkLabel,
  shortenDigestForDisplay,
  artifactRefHref,
  cellDisplayStatus,
  statusColorClass,
  cellSourceStatusSubtitle,
  gateIndicatesFailure,
  resolveDisplayMatrixCell,
  listNightlyJenkinsJobOptions,
  jenkinsJobPathFromUrl,
  jenkinsJobBasename,
  humanizeJenkinsJobBasename,
  nightlyTestResultsPanelTitle,
  TEST_RESULTS_SOURCE_QUERY_PARAM,
  testResultsSourceOptionLabel,
  testResultsSourceDropdownLabel,
  streamKeyDisambiguationLabel,
  streamKeyFromTestResultsSourceQuery,
  testResultsSourceQueryValue,
  testResultsSourceQueryValueForUrl,
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

  describe('row identity follows the newest published mapping (promotion-gate #52–#54)', () => {
    const comp = (id, name, jira, status, extra = {}) => ({
      id, name, jira_component: jira, source_status: status,
      state: status === 'Ready' ? 'ready' : status === 'NotInstalled' ? 'not_applicable' : 'failed',
      ...extra
    })
    // Old runs: published before the TRD mapping fix. Newest run: current mapping + dsc_component.
    const days = [
      {
        date: '2026-11-12',
        latest_run_id: 'pg:52',
        runs: [{
          run_id: 'pg:52',
          gates: [],
          components: [
            comp('aigateway', 'AI Gateway', 'AI Gateway', 'Ready'),
            comp('batchgateway', 'Batch Gateway', 'Batch Gateway', 'Ready'),
            comp('ray', 'KubeRay', 'KubeRay', 'Ready'),
            comp('sparkoperator', 'KubeRay', 'KubeRay', 'Ready'),
            comp('ogx', 'OGX', 'OGX Core', 'Ready'),
            comp('llamastackoperator', 'Llama Stack', 'OGX Core', 'NotInstalled'),
            comp('mcplifecycleoperator', 'OGX', 'OGX Core', 'Ready')
          ]
        }]
      },
      {
        date: '2026-11-13',
        latest_run_id: 'pg:54',
        // Producer stores same-day runs newest-first: #54 (new mapping) before #53 (old mapping).
        runs: [{
          run_id: 'pg:54',
          build_number: 54,
          completed_at: '2026-11-13T09:00:00Z',
          gates: [],
          components: [
            comp('aigateway', 'Inference Gateway', 'Inference Gateway', 'Ready', { dsc_component: 'aigateway' }),
            comp('batchgateway', 'llm-d', 'llm-d', 'Ready', { dsc_component: 'aigateway.batchGateway' }),
            comp('ray', 'KubeRay', 'KubeRay', 'Ready', { dsc_component: 'ray' }),
            comp('sparkoperator', 'Kubeflow Spark Operator', 'Kubeflow Spark Operator', 'Ready', { dsc_component: 'sparkoperator' }),
            comp('ogx', 'OGX', 'OGX Core', 'Ready', { dsc_component: 'ogx' }),
            comp('mcplifecycleoperator', 'AI Core Platform', 'AI Core Platform', 'Ready', { dsc_component: 'mcplifecycleoperator' })
          ]
        }, {
          run_id: 'pg:53',
          build_number: 53,
          completed_at: '2026-11-13T05:00:00Z',
          gates: [],
          components: [
            comp('aigateway', 'AI Gateway', 'AI Gateway', 'Ready'),
            comp('sparkoperator', 'KubeRay', 'KubeRay', 'Ready'),
            comp('ogx', 'OGX', 'OGX Core', 'Ready'),
            comp('mcplifecycleoperator', 'OGX', 'OGX Core', 'Ready')
          ]
        }]
      }
    ]
    // Heatmap before regeneration still lists old labels (incl. "Llama Stack" before "OGX").
    const heatmap = ['AI Gateway', 'Batch Gateway', 'KubeRay', 'Llama Stack', 'OGX', 'Platform']
      .map((component) => ({ component }))
    const ids = collectMatrixRowIds(days, heatmap)
    const labels = Object.fromEntries(ids.map((id) => [id, matrixRowLabel(id, days, heatmap)]))

    it('renames rows without adding rows', () => {
      expect(labels.aigateway).toBe('Inference Gateway')
      expect(labels.batchgateway).toBe('llm-d')
      expect(ids.filter((id) => ['aigateway', 'batchgateway'].includes(id))).toHaveLength(2)
    })

    it('gives Kubeflow Spark Operator and AI Core Platform their own rows', () => {
      expect(ids).toContain('ray')
      expect(ids).toContain('sparkoperator')
      expect(labels.sparkoperator).toBe('Kubeflow Spark Operator')
      expect(labels.mcplifecycleoperator).toBe('AI Core Platform')
    })

    it('binds OGX Core to ogx (Ready), not llamastackoperator (Not Installed), on every day', () => {
      expect(ids).toContain('ogx')
      expect(ids).not.toContain('llamastackoperator')
      for (const day of days) {
        expect(findMatrixCell(day.runs[0], 'ogx', days)?.source_status).toBe('Ready')
      }
    })

    it('shows each row only once per published component', () => {
      const componentIds = ids.filter((id) => id !== 'cluster-health' && id !== 'operator-health')
      const published = componentIds.map((id) => labels[id])
      expect(new Set(published).size).toBe(published.length)
    })
  })

  it('joins heatmap labels of folded producer rows (merged_from) instead of adding an empty row', () => {
    const days = [{
      date: '2026-11-13',
      latest_run_id: 'pg:56',
      runs: [{
        run_id: 'pg:56',
        gates: [],
        components: [{
          id: 'ogx',
          name: 'OGX',
          jira_component: 'OGX Core',
          source_status: 'Ready',
          state: 'blocked',
          merged_from: [{ id: 'llamastackoperator', name: 'Llama Stack', source_status: 'NotInstalled' }]
        }]
      }]
    }]
    const heatmap = [{ component: 'Llama Stack' }, { component: 'OGX' }, { component: 'Model Runtimes' }]
    const ids = collectMatrixRowIds(days, heatmap)
    expect(ids).toContain('ogx')
    expect(ids).not.toContain('llamastack')
    expect(ids).not.toContain('llamastackoperator')
    // Heatmap components with no producer data still get their placeholder row.
    expect(ids).toContain('modelruntimes')
  })

  describe('cellDscCaption', () => {
    it('names the DSC component with its status on blocked cells', () => {
      const cell = { state: 'blocked', source_status: 'Ready', dsc_component: 'trustyai' }
      expect(cellDscCaption('ai-guardrails', cell)).toEqual({
        text: 'DSC trustyai: Ready',
        status: 'Ready',
        title: 'DataScienceCluster component "trustyai" is Ready'
      })
    })

    it('names the DSC component on non-blocked cells (status is the main label)', () => {
      expect(cellDscCaption('batchgateway', { state: 'ready', source_status: 'Ready', dsc_component: 'aigateway.batchGateway' })
        ?.text).toBe('DSC aigateway.batchGateway')
    })

    it('keeps the legacy caption without dsc_component and for gate rows', () => {
      expect(cellDscCaption('dashboard', { state: 'blocked', source_status: 'Ready' })?.text).toBe('DSC: Ready')
      expect(cellDscCaption('dashboard', { state: 'ready', source_status: 'Ready' })).toBeNull()
      expect(cellDscCaption('operator-health', { state: 'blocked', source_status: 'failed' })?.text).toBe('Gate: failed')
      expect(cellDscCaption('dashboard', null)).toBeNull()
    })
  })

  it('hides Workload Orchestration, Demos and Other rows from history and heatmap inventory', () => {
    const days = [{
      date: '2026-11-11',
      stream_key: 'promotion-gate',
      latest_run_id: 'r1',
      runs: [{
        run_id: 'r1',
        gates: [],
        components: [
          { id: 'kueue', name: 'Distributed Workloads', jira_component: 'Workload Orchestration', state: 'blocked' },
          { id: 'dashboard', name: 'Dashboard', jira_component: 'AI Core Dashboard', state: 'ready' }
        ]
      }]
    }]
    const heatmap = [
      { component: 'Dashboard' },
      { component: 'Demos' },
      { component: 'Other' },
      { component: 'Workload Orchestration' }
    ]
    const ids = collectMatrixRowIds(days, heatmap)
    expect(ids).toContain('dashboard')
    expect(ids).not.toContain('kueue')
    expect(ids.some((id) => ['demos', 'other', 'workloadorchestration'].includes(id))).toBe(false)
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

  it('uses one matrix row per heatmap label when producer ids change (trainer → trainingoperator)', () => {
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
    // One row, bound to the id the newest run emits; older days resolve via canonical identity.
    expect(ids.filter((id) => id === 'trainer' || id === 'trainingoperator')).toEqual(['trainingoperator'])
    expect(findMatrixCell(days[0].runs[0], 'trainingoperator', days)?.id).toBe('trainer')
    expect(findMatrixCell(days[1].runs[0], 'trainer', days)?.id).toBe('trainingoperator')
    expect(resolveHeatmapComponentToRowId('Training Kubeflow', days, { run: days[0].runs[0] })).toBe(
      'trainer'
    )
    expect(resolveHeatmapComponentToRowId('Training', days, { run: days[1].runs[0] })).toBe(
      'trainingoperator'
    )
  })

  it('dedupes nightly-only rows that share canonical identity with heatmap inventory', () => {
    const days = [{
      date: '2026-11-01',
      latest_run_id: 'r1',
      runs: [{
        run_id: 'r1',
        components: [
          { id: 'trainer', name: 'Training', jira_component: 'Training Kubeflow' },
          { id: 'trainingoperator', name: 'Training', jira_component: 'Training Kubeflow' }
        ]
      }]
    }]
    const heatmap = [{ component: 'Training Kubeflow' }]
    const ids = collectMatrixRowIds(days, heatmap)
    expect(ids).toEqual(['cluster-health', 'operator-health', 'trainer'])
  })

  it('merges component metadata across runs so rows dedupe when jira arrives later', () => {
    const days = [
      {
        date: '2026-11-01',
        runs: [{
          run_id: 'a:1',
          components: [{ id: 'trainer', name: 'Training' }]
        }]
      },
      {
        date: '2026-11-02',
        runs: [{
          run_id: 'b:1',
          components: [
            { id: 'trainer', name: 'Training', jira_component: 'Training Kubeflow' },
            { id: 'trainingoperator', name: 'Training', jira_component: 'Training Kubeflow' }
          ]
        }]
      }
    ]
    expect(canonicalKeyForRowId('trainer', days)).toBe('trainingkubeflow')
    const heatmap = [{ component: 'Training Kubeflow' }]
    const ids = collectMatrixRowIds(days, heatmap)
    expect(ids.filter((id) => id === 'trainer' || id === 'trainingoperator')).toEqual(['trainer'])
  })

  it('keeps nightly-only rows when ids differ only by normalized slug without published names', () => {
    const days = [{
      date: '2026-11-01',
      latest_run_id: 'r1',
      runs: [{
        run_id: 'r1',
        components: [{ id: 'foo-bar' }, { id: 'foobar' }]
      }]
    }]
    expect(collectMatrixRowIds(days)).toEqual([
      'cluster-health',
      'operator-health',
      'foo-bar',
      'foobar'
    ])
  })

  it('returns null from findMatrixCell when alias match is ambiguous in one run', () => {
    const run = {
      components: [
        { id: 'a', jira_component: 'Same Component' },
        { id: 'b', jira_component: 'Same Component' }
      ]
    }
    const days = [{
      date: '2026-11-01',
      runs: [{
        run_id: 'r1',
        components: [
          ...run.components,
          { id: 'matrix-row', jira_component: 'Same Component' }
        ]
      }]
    }]
    expect(findMatrixCell(run, 'matrix-row', days)).toBeNull()
  })

  it('nightlyRowHeatmapLinkTarget never links matrix rows to heatmap drill-down', () => {
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
    expect(nightlyRowHeatmapLinkTarget('aigateway', heatmap, days)).toBeNull()
    expect(nightlyRowHeatmapLinkTarget('dashboard', heatmap, days)).toBeNull()
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

  it('orders an older latest_run_id run first with remaining runs newest first', () => {
    const day = {
      latest_run_id: 'run-b',
      runs: [
        { run_id: 'run-a', started_at: '2026-11-01T08:00:00Z', build_number: 101 },
        { run_id: 'run-b', started_at: '2026-11-01T10:00:00Z', build_number: 102 },
        { run_id: 'run-c', started_at: '2026-11-01T14:00:00Z', build_number: 103 }
      ]
    }
    const ordered = orderDayRunsForPanel(day)
    expect(ordered.map((r) => r.run_id)).toEqual(['run-b', 'run-c', 'run-a'])
  })

  it('orders remaining runs newest first across mixed timestamp formats', () => {
    const day = {
      latest_run_id: 'job:67',
      runs: [
        { run_id: 'job:53', started_at: '2026-11-13T04:59:00.000+00:00', build_number: 53 },
        { run_id: 'job:67', started_at: '2026-11-13T16:10:46Z', build_number: 67 },
        { run_id: 'job:54', started_at: '2026-11-13T06:12:00Z', build_number: 54 },
        { run_id: 'job:60', started_at: '2026-11-13T11:30:00.123Z', build_number: 60 },
        { run_id: 'job:61', build_number: 61 },
        { run_id: 'job:62', started_at: '2026-11-13T11:30:00.123Z', build_number: 62 }
      ]
    }
    const ordered = orderDayRunsForPanel(day)
    expect(ordered.map((r) => r.run_id)).toEqual(['job:67', 'job:62', 'job:60', 'job:54', 'job:53', 'job:61'])
  })

  it('formats run duration from started_at and completed_at', () => {
    const run = {
      started_at: '2026-11-02T08:00:00Z',
      completed_at: '2026-11-02T08:45:00Z'
    }
    expect(formatRunDuration(run)).toBe('45 min')
  })

  it('builds column subline with Run # and product label', () => {
    const run = {
      build_number: 29,
      promotion_gate: { rhoai_version: '3.6.0', update_channel: 'stable-3.x' }
    }
    expect(nightlyColumnHeaderSubline(run)).toBe('Run #29 · RHOAI 3.6.0 · stable-3.x')
    expect(runProductUnderTestLabel(run)).toBe('RHOAI 3.6.0 · stable-3.x')
  })

  it('describes promotion-gate test source from jenkins_jobs catalog', () => {
    const option = {
      stream_key: 'example-stream',
      jenkins_job: 'devops/promotion-gate-tests'
    }
    expect(nightlyTestSourceDescription(option)).toBe(
      'Promotion gate · devops/promotion-gate-tests'
    )
  })

  it('omits artifact panel entries when refs are null', () => {
    const entries = runArtifactPanelEntries({ artifacts: { pod_logs: null, bvt_results: null } })
    expect(entries).toHaveLength(0)
  })

  it('falls back to pod logs when s3_artifacts is not a browser URL', () => {
    const pod = 'https://example.invalid/pod.tgz'
    const entries = runArtifactPanelEntries({
      artifacts: { s3_artifacts: 's3://bucket/prefix/', pod_logs: pod }
    })
    expect(entries).toHaveLength(1)
    expect(entries[0].id).toBe('pod_logs')
    expect(entries[0].href).toBe(pod)
  })

  it('prefers single s3_artifacts folder link when present', () => {
    const href =
      'https://us-east-1.console.aws.amazon.com/s3/buckets/b?region=us-east-1&prefix=ci/4/'
    const entries = runArtifactPanelEntries({ artifacts: { s3_artifacts: href } })
    expect(entries).toHaveLength(1)
    expect(entries[0].label).toBe('S3 Artifacts')
    expect(entries[0].href).toBe(href)
  })

  it('exposes s3_artifacts for inline Jenkins line link', () => {
    const href =
      'https://us-east-1.console.aws.amazon.com/s3/buckets/b?region=us-east-1&prefix=ci/4/'
    const link = runS3ArtifactsInlineLink({ artifacts: { s3_artifacts: href } })
    expect(link).toEqual({ plainPrefix: 'S3', linkText: 'Artifacts', href })
    expect(runS3ArtifactsInlineLink({ artifacts: { pod_logs: href } })).toBeNull()
  })

  it('deduplicates identical org_pulse_links by href', () => {
    const href = 'https://example.invalid/jira/RHOAI-1'
    const links = runOrgPulsePanelLinks({
      org_pulse_links: [
        { label: 'A', href },
        { label: 'B', href },
        { label: 'C', href: 'https://example.invalid/other' }
      ]
    })
    expect(links).toHaveLength(2)
    expect(links[0].href).toBe(href)
    expect(links[1].href).toBe('https://example.invalid/other')
  })

  it('omits org_pulse_links whose href matches an artifact link', () => {
    const href =
      'https://us-east-1.console.aws.amazon.com/s3/buckets/b?region=us-east-1&prefix=ci/4/'
    const other = 'https://example.com/jira/RHOAI-1'
    const links = runOrgPulsePanelLinks({
      artifacts: { s3_artifacts: href },
      org_pulse_links: [
        { label: 'S3', href },
        { label: 'Jira', href: other }
      ]
    })
    expect(links).toHaveLength(1)
    expect(links[0].label).toBe('Jira')
    expect(links[0].href).toBe(other)
  })

  it('resolves artifact URL strings and objects', () => {
    expect(artifactRefHref('https://example.invalid/logs.tgz')).toBe(
      'https://example.invalid/logs.tgz'
    )
    expect(artifactRefHref({ url: 'https://example.invalid/bvt.zip' })).toBe(
      'https://example.invalid/bvt.zip'
    )
    expect(
      artifactRefHref({
        url: 'not-a-browser-url',
        href: 'https://example.invalid/folder/'
      })
    ).toBe('https://example.invalid/folder/')
  })

  it('drops org_pulse_links Image label when promotion_gate ods_build_url is shown', () => {
    const digest =
      'sha256:abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789ab'
    const ods = `https://quay.io/repository/rhoai/bundle/manifest/${digest}`
    const links = runOrgPulsePanelLinks({
      promotion_gate: { ods_build_url: ods },
      org_pulse_links: [
        { label: 'Image', href: `quay.io/rhoai/bundle@${digest}` },
        { label: 'S3', href: 'https://example.invalid/s3/' }
      ]
    })
    expect(links).toHaveLength(1)
    expect(links[0].label).toBe('S3')
  })

  it('drops Image org_pulse_link by digest when operator_image_ref resolves to ODS URL', () => {
    const digest =
      'sha256:8665a96e7b6aba002a922cec435995ffe15355996a255b8b1d3be2e16b1edaf8'
    const links = runOrgPulsePanelLinks({
      promotion_gate: { operator_image_ref: `quay.io/rhoai/rhoai-fbc-fragment@${digest}` },
      org_pulse_links: [
        {
          label: 'Image',
          href: `https://quay.io/repository/rhoai/rhoai-fbc-fragment/manifest/${digest}`
        }
      ]
    })
    expect(links).toHaveLength(0)
    expect(quaySha256DigestKey(digest)).toBe(digest.toLowerCase())
    expect(runPromotionGateQuayDigestKeys({
      promotion_gate: { operator_image_ref: `quay.io/x@${digest}` }
    }).has(digest.toLowerCase())).toBe(true)
  })

  it('keeps Image org_pulse_link when operator_image_ref digest is not shown as ODS URL', () => {
    const digest =
      'sha256:8665a96e7b6aba002a922cec435995ffe15355996a255b8b1d3be2e16b1edaf8'
    const imageHref = `https://registry.example.invalid/rhoai/bundle@${digest}`
    const links = runOrgPulsePanelLinks({
      promotion_gate: { operator_image_ref: `registry.example.invalid/rhoai/bundle@${digest}` },
      org_pulse_links: [{ label: 'Image', href: imageHref }]
    })
    expect(runOdsBuildUrl({ promotion_gate: { operator_image_ref: `registry.example.invalid/rhoai/bundle@${digest}` } })).toBeNull()
    expect(links).toHaveLength(1)
    expect(links[0].href).toBe(imageHref)
  })

  it('resolves ods URL from operator_image_ref when ods_build_url is absent', () => {
    const digest =
      'sha256:8665a96e7b6aba002a922cec435995ffe15355996a255b8b1d3be2e16b1edaf8'
    const run = {
      promotion_gate: { operator_image_ref: `quay.io/rhoai/rhoai-fbc-fragment@${digest}` }
    }
    expect(runOdsBuildUrl(run)).toBe(
      `https://quay.io/repository/rhoai/rhoai-fbc-fragment/manifest/${digest}`
    )
  })

  it('drops org_pulse_links when artifact href matches with different hostname case', () => {
    const href =
      'https://us-east-1.console.aws.amazon.com/s3/buckets/b?region=us-east-1&prefix=ci/4/'
    const otherCasing =
      'https://US-EAST-1.console.aws.amazon.com/s3/buckets/b?region=us-east-1&prefix=ci/4/'
    const jira = 'https://example.invalid/jira/RHOAI-1'
    const links = runOrgPulsePanelLinks({
      artifacts: { s3_artifacts: href },
      org_pulse_links: [
        { label: 'S3 dup', href: otherCasing },
        { label: 'Ticket', href: jira }
      ]
    })
    expect(links).toHaveLength(1)
    expect(links[0].href).toBe(jira)
  })

  it('exposes ods_build_url from promotion_gate for payload link', () => {
    const run = {
      promotion_gate: { ods_build_url: 'https://example.invalid/quay/fixture' }
    }
    expect(runOdsBuildUrl(run)).toBe('https://example.invalid/quay/fixture')
  })

  it('returns null for non-http ods_build_url values', () => {
    const run = {
      promotion_gate: { ods_build_url: 'javascript:alert(1)' }
    }
    expect(runOdsBuildUrl(run)).toBeNull()
  })

  it('maps raw quay pullspec on promotion_gate to browser URL', () => {
    expect(quayBrowserUrlFromImageRef('quay.io/org/repo@sha256:abc')).toBe(
      'https://quay.io/repository/org/repo/manifest/sha256:abc'
    )
    expect(
      quayBrowserUrlFromImageRef(
        'quay.io/rhoai/bundle:v1@sha256:abcdef0123456789deadbeef'
      )
    ).toBe('https://quay.io/repository/rhoai/bundle/manifest/sha256:abcdef0123456789deadbeef')
    const run = {
      promotion_gate: { ods_build_url: 'quay.io/rhoai/bundle:v1' }
    }
    expect(runOdsBuildUrl(run)).toBe('https://quay.io/repository/rhoai/bundle/tag/v1')
    expect(
      quayBrowserUrlFromImageRef('quay.io/org/repo:sha256:abcdef0123456789deadbeef')
    ).toBe('https://quay.io/repository/org/repo/manifest/sha256:abcdef0123456789deadbeef')
  })

  it('uses short hash from query or fragment as ODS link label', () => {
    expect(
      runOdsBuildLinkLabel({
        promotion_gate: {
          ods_build_url: 'https://quay.example/v2/tag/manifests/sha256:abcdef0123456789deadbeef'
        }
      })
    ).toBe('abcdef012345')
    expect(
      runOdsBuildLinkLabel({
        promotion_gate: {
          ods_build_url: 'https://quay.example/build?digest=sha256:feedfacefeedfacefeedfacefeedfacefeedfacefeedfacefeedface'
        }
      })
    ).toBe('feedfacefeed')
    expect(
      runOdsBuildLinkLabel({
        promotion_gate: { ods_build_url: 'https://quay.example/payload#cafebabecafe' }
      })
    ).toBe('cafebabecafe')
    expect(
      runOdsBuildLinkLabel({
        promotion_gate: {
          ods_build_url:
            'https://quay.io/repository/rhoai/rhoai-fbc-fragment/tag/sha256%3Aabcdef0123456789deadbeef'
        }
      })
    ).toBe('abcdef012345')
    expect(
      runOdsBuildLinkLabel({
        promotion_gate: {
          ods_build_url: 'https://quay.io/repository/rhoai/bundle/tag/v2.32.0-2026110901'
        }
      })
    ).toBe('v2.32.0-2026110901')
    expect(
      runOdsBuildLinkLabel({
        promotion_gate: {
          ods_build_url:
            'https://quay.io/repository/rhoai/bundle/tag/bad%ZZ/sha256%3Aabcdef0123456789deadbeef'
        }
      })
    ).toBe('abcdef012345')
  })

  it('shortens raw digest tokens for display', () => {
    expect(shortenDigestForDisplay('sha256:abcdef0123456789')).toBe('abcdef012345')
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
    expect(titleCaseLabel('ai gateway')).toBe('AI Gateway')
    expect(titleCaseLabel('ai-evaluations')).toBe('AI-Evaluations')
  })

  it('preserves producer canonical name casing when jira_component is absent', () => {
    expect(
      rowLabel('ai-evaluations', {
        id: 'ai-evaluations',
        name: 'AI Evaluations'
      })
    ).toBe('AI Evaluations')
    expect(
      rowLabel('aigateway', {
        id: 'aigateway',
        name: 'AI Gateway'
      })
    ).toBe('AI Gateway')
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
    expect(streamKeyFromTestResultsSourceQuery(payload, 'promotion-gate-tests')).toBe('pg')
    expect(streamKeyFromTestResultsSourceQuery(payload, 'pg')).toBe('pg')
    expect(testResultsSourceQueryValue(payload, 'bvt')).toBe('nightly-bvt')
    expect(testResultsSourceQueryValue(payload, 'pg')).toBe('promotion-gate-tests')
    expect(streamKeyFromTestResultsSourceQuery(payload, 'unknown')).toBeNull()
  })

  it('uses filter label in URL not internal stream_key (e.g. rhoai-nightly)', () => {
    const payload = {
      schema_version: 1,
      jenkins_jobs: [
        {
          stream_key: 'rhoai-nightly',
          label: 'rhoai-nightly'
        }
      ],
      days: [
        {
          date: '2026-11-01',
          stream_key: 'rhoai-nightly',
          runs: [
            {
              run_id: 'x:1',
              jenkins_url: 'https://jenkins.example/job/devops/job/promotion-gate-tests/1/'
            }
          ]
        }
      ]
    }
    const options = listNightlyJenkinsJobOptions(payload)
    expect(options[0].label).toBe('devops/promotion-gate-tests')
    expect(testResultsSourceOptionLabel(options[0])).toBe('promotion-gate-tests')
    expect(testResultsSourceQueryValue(payload, 'rhoai-nightly')).toBe('promotion-gate-tests')
    expect(streamKeyFromTestResultsSourceQuery(payload, 'promotion-gate-tests')).toBe('rhoai-nightly')
    expect(streamKeyFromTestResultsSourceQuery(payload, 'rhoai-nightly')).toBe('rhoai-nightly')
  })

  it('testResultsSourceQueryValueForUrl never returns reporting stream ids when job label exists', () => {
    const payload = {
      schema_version: 1,
      jenkins_jobs: [{ stream_key: 'rhoai-nightly', label: 'rhoai-nightly' }],
      days: [
        {
          date: '2026-11-01',
          stream_key: 'rhoai-nightly',
          runs: [
            {
              jenkins_url: 'https://jenkins.example/job/devops/job/promotion-gate-tests/1/'
            }
          ]
        }
      ]
    }
    expect(testResultsSourceQueryValueForUrl(payload, 'rhoai-nightly')).toBe('promotion-gate-tests')
  })

  it('uses stream_key in source query when reporting stream job basename collides', () => {
    const payload = {
      schema_version: 1,
      jenkins_jobs: [
        {
          stream_key: 'rhoai-nightly',
          label: 'devops/promotion-gate-tests',
          jenkins_job: 'devops/promotion-gate-tests'
        },
        {
          stream_key: 'pg',
          label: 'devops/promotion-gate-tests',
          jenkins_job: 'devops/promotion-gate-tests'
        }
      ],
      days: [
        { date: '2026-11-01', stream_key: 'rhoai-nightly', runs: [] },
        { date: '2026-11-01', stream_key: 'pg', runs: [] }
      ]
    }
    expect(testResultsSourceQueryValue(payload, 'rhoai-nightly')).toBe('promotion-gate-tests')
    expect(testResultsSourceQueryValue(payload, 'pg')).toBe('pg')
    expect(testResultsSourceQueryValueForUrl(payload, 'rhoai-nightly')).toBe('promotion-gate-tests')
    expect(testResultsSourceQueryValueForUrl(payload, 'pg')).toBe('pg')
    expect(streamKeyFromTestResultsSourceQuery(payload, 'rhoai-nightly')).toBe('rhoai-nightly')
    expect(streamKeyFromTestResultsSourceQuery(payload, 'pg')).toBe('pg')
  })

  it('builds gates panel title from Jenkins job basename', () => {
    const payload = {
      days: [{ date: '2026-11-01', stream_key: 'pg', runs: [] }],
      jenkins_jobs: [
        { stream_key: 'pg', label: 'devops/promotion-gate-tests', jenkins_job: 'devops/promotion-gate-tests' }
      ]
    }
    expect(nightlyTestResultsPanelTitle(payload, 'pg')).toBe('Promotion Gate Tests Results')
    expect(humanizeJenkinsJobBasename(jenkinsJobBasename('devops/bvt-nightly'))).toBe('Bvt Nightly')
  })

  it('uses job basename in source query when jenkins_jobs labels collide', () => {
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
    expect(testResultsSourceQueryValue(payload, 'a')).toBe('job-a')
    expect(testResultsSourceQueryValue(payload, 'b')).toBe('job-b')
  })

  it('uses stream_key in source query when job basenames collide', () => {
    const payload = {
      schema_version: 1,
      jenkins_jobs: [
        { stream_key: 'a', label: 'devops/folder-a', jenkins_job: 'devops/same-job' },
        { stream_key: 'b', label: 'devops/folder-b', jenkins_job: 'other/same-job' }
      ],
      days: [
        { date: '2026-11-01', stream_key: 'a', runs: [] },
        { date: '2026-11-01', stream_key: 'b', runs: [] }
      ]
    }
    const options = listNightlyJenkinsJobOptions(payload)
    expect(testResultsSourceOptionLabel(options[0])).toBe('same-job')
    expect(testResultsSourceOptionLabel(options[1])).toBe('same-job')
    expect(testResultsSourceDropdownLabel(options[0], options)).toBe('devops/same-job')
    expect(testResultsSourceDropdownLabel(options[1], options)).toBe('other/same-job')
    expect(testResultsSourceQueryValue(payload, 'a')).toBe('a')
    expect(testResultsSourceQueryValue(payload, 'b')).toBe('b')
  })

  it('appends stream_key to dropdown label when jenkins_job paths are identical', () => {
    const payload = {
      schema_version: 1,
      jenkins_jobs: [
        { stream_key: 'a', label: 'devops/shared', jenkins_job: 'devops/shared' },
        { stream_key: 'b', label: 'devops/shared', jenkins_job: 'devops/shared' }
      ],
      days: [
        { date: '2026-11-01', stream_key: 'a', runs: [] },
        { date: '2026-11-01', stream_key: 'b', runs: [] }
      ]
    }
    const options = listNightlyJenkinsJobOptions(payload)
    expect(testResultsSourceDropdownLabel(options[0], options)).toBe('devops/shared (a)')
    expect(testResultsSourceDropdownLabel(options[1], options)).toBe('devops/shared (b)')
  })

  it('does not show reporting stream_key in dropdown disambiguation suffix', () => {
    const payload = {
      schema_version: 1,
      jenkins_jobs: [
        {
          stream_key: 'rhoai-nightly',
          label: 'devops/promotion-gate-tests',
          jenkins_job: 'devops/promotion-gate-tests'
        },
        {
          stream_key: 'pg',
          label: 'devops/promotion-gate-tests',
          jenkins_job: 'devops/promotion-gate-tests'
        }
      ],
      days: [
        { date: '2026-11-01', stream_key: 'rhoai-nightly', runs: [] },
        { date: '2026-11-01', stream_key: 'pg', runs: [] }
      ]
    }
    const options = listNightlyJenkinsJobOptions(payload)
    expect(streamKeyDisambiguationLabel('rhoai-nightly')).toBeNull()
    expect(testResultsSourceDropdownLabel(options[0], options)).toBe('devops/promotion-gate-tests')
    expect(testResultsSourceDropdownLabel(options[1], options)).toBe('devops/promotion-gate-tests (pg)')
  })

  it('resolves findMatrixCell alias using merged metadata from other runs', () => {
    const run = {
      components: [{ id: 'trainingoperator', name: 'Training' }]
    }
    const days = [
      {
        date: '2026-11-01',
        runs: [{
          run_id: 'r1',
          components: [
            { id: 'trainer', name: 'Training', jira_component: 'Training Kubeflow' },
            {
              id: 'trainingoperator',
              name: 'Training',
              jira_component: 'Training Kubeflow'
            }
          ]
        }]
      },
      {
        date: '2026-11-02',
        runs: [{ run_id: 'r2', components: run.components }]
      }
    ]
    expect(findMatrixCell(run, 'trainer', days)?.id).toBe('trainingoperator')
  })

  it('keeps C and C++ as separate matrix rows when names differ only by punctuation', () => {
    const days = [{
      date: '2026-11-01',
      latest_run_id: 'r1',
      runs: [{
        run_id: 'r1',
        components: [
          { id: 'c-lang', name: 'C' },
          { id: 'cpp-lang', name: 'C++' }
        ]
      }]
    }]
    expect(collectMatrixRowIds(days)).toEqual([
      'cluster-health',
      'operator-health',
      'c-lang',
      'cpp-lang'
    ])
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
    expect(testResultsSourceQueryValue(payload, 'pg')).toBe('promotion-gate')
    expect(streamKeyFromTestResultsSourceQuery(payload, 'bvt')).toBe('bvt')
    expect(streamKeyFromTestResultsSourceQuery(payload, 'promotion-gate')).toBe('pg')
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
