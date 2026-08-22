import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const contentDir = path.join(__dirname, '../../server/content')
const resources = JSON.parse(readFileSync(path.join(contentDir, 'resources.json'), 'utf8'))
const playbooks = JSON.parse(readFileSync(path.join(contentDir, 'playbooks.json'), 'utf8'))

const { classifyRfe } = await import('../../server/pipeline-classifier/classify-rfe.js')
const { classifyPipelineStage } = await import('../../server/pipeline-classifier/classify-stage.js')
const {
  computeReadiness,
  deriveViolations
} = await import('../../server/pipeline-classifier/compute-readiness.js')
const { buildPipelineItem, buildStats } = await import('../../server/pipeline-classifier/index.js')

describe('pm-pipeline classifier', () => {
  it('classifies RFE needs-revision', () => {
    const state = classifyRfe({
      labels: ['rfe-creator-needs-attention'],
      linkedFeature: null
    })
    expect(state.id).toBe('needs-revision')
  })

  it('computes readiness failure for missing target version', () => {
    const result = computeReadiness({
      labels: ['strat-creator-human-sign-off'],
      humanReviewStatus: 'approved',
      rubricTotal: 1,
      pmOwner: 'PM',
      deliveryOwner: 'Eng',
      status: 'In Progress',
      targetVersions: [],
      violations: []
    })
    expect(result.isReady).toBe(false)
    expect(result.failedGates.some(g => g.id === 'hasTargetVersion')).toBe(true)
  })

  it('classifies awaiting sign-off stage', () => {
    const stage = classifyPipelineStage({
      type: 'feature',
      labels: ['strat-creator-rubric-pass'],
      status: 'Refinement',
      pmOwner: 'PM',
      deliveryOwner: 'Eng',
      targetVersions: [],
      violations: deriveViolations({ assignee: 'Eng', fixVersions: [], targetVersions: [] })
    })
    expect(stage.id).toBe('strat-awaiting-signoff')
    expect(stage.playbookSection).toBe(6)
    expect(stage.pmActionable).toBe(true)
  })

  it('builds pipeline item with playbook links', () => {
    const item = buildPipelineItem({
      type: 'feature',
      key: 'RHAISTRAT-100',
      summary: 'Test feature',
      status: 'Refinement',
      priority: 'Normal',
      labels: ['strat-creator-human-sign-off', 'strat-creator-rubric-pass'],
      pmOwner: 'PM Alpha',
      assignee: null,
      fixVersions: [],
      targetVersions: [],
      components: ['Serving']
    }, { resources, playbooks, release: '3.5' })

    expect(item.stage.id).toBe('planning-ready-blocked')
    expect(item.playbook.section).toBe(7)
    expect(item.playbook.links.length).toBeGreaterThan(0)
    expect(item.pmActionable).toBe(true)
  })

  it('builds stats from pipeline items', () => {
    const stats = buildStats([
      { pmActionable: true, stage: { phase: 1, id: 'x' } },
      { pmActionable: false, stage: { phase: 2, id: 'y' } },
      { pmActionable: true, stage: { phase: 3, id: 'z' } }
    ])
    expect(stats.needAction).toBe(2)
    expect(stats.total).toBe(3)
  })

  it('validates playbook link refs against resources', () => {
    const resourceIds = new Set(resources.map(r => r.id))
    expect(playbooks).toHaveLength(12)
    for (const pb of playbooks) {
      for (const ref of pb.links || []) {
        expect(resourceIds.has(ref)).toBe(true)
      }
    }
  })
})
