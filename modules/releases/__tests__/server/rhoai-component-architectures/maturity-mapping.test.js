import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { fetchMaturityMapping, applyMaturityMapping, _setFetch } = require('../../../server/rhoai-component-architectures/maturity-mapping')

const mockFetch = vi.fn()

beforeEach(() => {
  _setFetch(mockFetch)
})

afterEach(() => {
  _setFetch(globalThis.fetch)
  vi.restoreAllMocks()
})

function makeMaturityResponse(components) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ components })
  }
}

const SAMPLE_COMPONENTS = [
  {
    name: 'Serving Orchestration',
    id: 'serving-orchestration',
    deliverables: [
      {
        images: [
          'registry.access.redhat.com/rhoai/odh-kserve-controller-rhel9',
          'quay.io/rhoai/odh-kserve-controller-rhel9',
          'quay.io/rhoai/odh-model-controller-rhel9'
        ],
        shipped: 'shipped'
      }
    ]
  },
  {
    name: 'AI Pipelines',
    id: 'ai-pipelines',
    deliverables: [
      {
        images: [
          'quay.io/rhoai/odh-data-science-pipelines-operator-controller-rhel9'
        ],
        shipped: 'shipped'
      }
    ]
  },
  {
    name: 'Data Connect Hub',
    id: 'data-connect-hub',
    deliverables: []
  }
]

describe('fetchMaturityMapping', () => {
  it('returns correct mapping and allProductComponents on success', async () => {
    mockFetch.mockResolvedValueOnce(makeMaturityResponse(SAMPLE_COMPONENTS))

    const result = await fetchMaturityMapping('test-token')

    expect(result.mapping['odh-kserve-controller-rhel9']).toBe('Serving Orchestration')
    expect(result.mapping['odh-model-controller-rhel9']).toBe('Serving Orchestration')
    expect(result.mapping['odh-data-science-pipelines-operator-controller-rhel9']).toBe('AI Pipelines')
    expect(result.allProductComponents).toEqual([
      { name: 'AI Pipelines', owner: null, team: null },
      { name: 'Data Connect Hub', owner: null, team: null },
      { name: 'Serving Orchestration', owner: null, team: null }
    ])
  })

  it('includes owner/team when present in source data', async () => {
    mockFetch.mockResolvedValueOnce(makeMaturityResponse([
      {
        name: 'Serving Orchestration',
        id: 'serving',
        owner: 'jdoe',
        team: 'Model Serving',
        deliverables: [{ images: ['quay.io/rhoai/odh-kserve-controller-rhel9'] }]
      },
      {
        name: 'AI Pipelines',
        id: 'pipelines',
        deliverables: [{ images: ['quay.io/rhoai/odh-dsp-rhel9'] }]
      }
    ]))

    const result = await fetchMaturityMapping('test-token')
    expect(result.allProductComponents).toEqual([
      { name: 'AI Pipelines', owner: null, team: null },
      { name: 'Serving Orchestration', owner: 'jdoe', team: 'Model Serving' }
    ])
  })

  it('extracts image short name from full registry path', async () => {
    mockFetch.mockResolvedValueOnce(makeMaturityResponse([
      {
        name: 'Test Component',
        id: 'test',
        deliverables: [{
          images: ['registry.access.redhat.com/rhoai/odh-dashboard-rhel8']
        }]
      }
    ]))

    const result = await fetchMaturityMapping('test-token')
    expect(result.mapping['odh-dashboard-rhel8']).toBe('Test Component')
  })

  it('throws on 401 response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 })
    await expect(fetchMaturityMapping('bad-token')).rejects.toThrow('authentication failed')
  })

  it('throws on 404 response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 })
    await expect(fetchMaturityMapping('token')).rejects.toThrow('not found')
  })

  it('throws on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network unreachable'))
    await expect(fetchMaturityMapping('token')).rejects.toThrow('Network unreachable')
  })

  it('throws on unexpected format (missing components array)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ noComponentsHere: true })
    })
    await expect(fetchMaturityMapping('token')).rejects.toThrow('missing components array')
  })

  it('skips malformed deliverables gracefully', async () => {
    mockFetch.mockResolvedValueOnce(makeMaturityResponse([
      {
        name: 'Good',
        id: 'good',
        deliverables: [{ images: ['quay.io/ns/good-image'] }]
      },
      {
        name: 'Bad Deliverables',
        id: 'bad',
        deliverables: 'not-an-array'
      },
      {
        name: 'Bad Images',
        id: 'bad2',
        deliverables: [{ images: 'not-an-array' }]
      },
      {
        name: '',
        deliverables: [{ images: ['quay.io/ns/unnamed'] }]
      }
    ]))

    const result = await fetchMaturityMapping('token')
    expect(result.mapping['good-image']).toBe('Good')
    expect(Object.keys(result.mapping)).toHaveLength(1)
    expect(result.allProductComponents).toEqual([
      { name: 'Bad Deliverables', owner: null, team: null },
      { name: 'Bad Images', owner: null, team: null },
      { name: 'Good', owner: null, team: null }
    ])
  })
})

describe('applyMaturityMapping', () => {
  const mapping = {
    'odh-kserve-controller-rhel9': 'Serving Orchestration',
    'odh-dashboard-rhel9': 'AI Core Dashboard'
  }

  it('sets productComponent on matching components', () => {
    const branchData = {
      components: [
        { name: 'odh-kserve-controller', imageName: 'odh-kserve-controller-rhel9' },
        { name: 'odh-dashboard', imageName: 'odh-dashboard-rhel9' }
      ]
    }

    applyMaturityMapping(branchData, mapping)

    expect(branchData.components[0].productComponent).toBe('Serving Orchestration')
    expect(branchData.components[1].productComponent).toBe('AI Core Dashboard')
  })

  it('sets null for unmatched components', () => {
    const branchData = {
      components: [
        { name: 'odh-unknown', imageName: 'odh-unknown-rhel9' }
      ]
    }

    applyMaturityMapping(branchData, mapping)
    expect(branchData.components[0].productComponent).toBeNull()
  })

  it('handles empty mapping', () => {
    const branchData = {
      components: [
        { name: 'odh-kserve-controller', imageName: 'odh-kserve-controller-rhel9' }
      ]
    }

    applyMaturityMapping(branchData, {})
    expect(branchData.components[0].productComponent).toBeNull()
  })

  it('handles missing components array', () => {
    const branchData = {}
    const result = applyMaturityMapping(branchData, mapping)
    expect(result).toBe(branchData)
  })

  it('handles null branchData', () => {
    const result = applyMaturityMapping(null, mapping)
    expect(result).toBeNull()
  })
})
