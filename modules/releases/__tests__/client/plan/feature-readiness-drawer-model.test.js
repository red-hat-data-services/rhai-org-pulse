import { describe, it, expect } from 'vitest'
import { toDrawerFeature } from '../../../client/plan/utils/feature-readiness-drawer-model.js'

describe('toDrawerFeature', function() {
  it('returns null for empty input', function() {
    expect(toDrawerFeature(null)).toBeNull()
    expect(toDrawerFeature(undefined)).toBeNull()
  })

  it('maps PM Hub summary/assignee/linkedRfe into drawer fields', function() {
    var row = toDrawerFeature({
      key: 'RHAISTRAT-1',
      summary: 'From PM Hub',
      assignee: 'Alice',
      linkedRfeKey: 'RHOAIENG-9',
      fixVersions: ['rhoai-3.6'],
      alignmentCategory: 'tv_only',
      fpdor: { items: [] }
    })
    expect(row.title).toBe('From PM Hub')
    expect(row.deliveryOwner).toBe('Alice')
    expect(row.sourceRfe).toBe('RHOAIENG-9')
    expect(row.fixVersion).toBe('rhoai-3.6')
    expect(row.alignmentCategory).toBe('tv_only')
    expect(row.dataSource).toBe('jira')
  })

  it('preserves Features List title and dataSource', function() {
    var row = toDrawerFeature({
      key: 'RHAISTRAT-2',
      title: 'Canonical title',
      summary: 'ignored when title set',
      deliveryOwner: 'Bob',
      dataSource: 'health-pipeline',
      alignmentCategory: 'aligned_on_time'
    })
    expect(row.title).toBe('Canonical title')
    expect(row.deliveryOwner).toBe('Bob')
    expect(row.dataSource).toBe('health-pipeline')
    expect(row.alignmentCategory).toBe('aligned_on_time')
  })
})
