import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { fetchMaturityMapping, applyMaturityMapping, _setFetch, MATURITY_URL } = require('../../../server/rhoai-component-architectures/maturity-mapping')

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

// The mapping is built from the component-level `images` array (the
// authoritative superset). `deliverables[].images[]` is a subset and is
// intentionally NOT used for mapping — see maturity-mapping.js for rationale.
const SAMPLE_COMPONENTS = [
  {
    name: 'Serving Orchestration',
    id: 'serving-orchestration',
    images: [
      'registry.access.redhat.com/rhoai/odh-kserve-controller-rhel9',
      'quay.io/rhoai/odh-kserve-controller-rhel9',
      'quay.io/rhoai/odh-model-controller-rhel9'
    ]
  },
  {
    name: 'AI Pipelines',
    id: 'ai-pipelines',
    images: [
      'quay.io/rhoai/odh-data-science-pipelines-operator-controller-rhel9'
    ]
  },
  {
    name: 'Data Connect Hub',
    id: 'data-connect-hub',
    images: []
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
        images: ['quay.io/rhoai/odh-kserve-controller-rhel9']
      },
      {
        name: 'AI Pipelines',
        id: 'pipelines',
        images: ['quay.io/rhoai/odh-dsp-rhel9']
      }
    ]))

    const result = await fetchMaturityMapping('test-token')
    expect(result.allProductComponents).toEqual([
      { name: 'AI Pipelines', owner: null, team: null },
      { name: 'Serving Orchestration', owner: 'jdoe', team: 'Model Serving' }
    ])
  })

  it('fetches without Authorization header when no token is provided', async () => {
    mockFetch.mockResolvedValueOnce(makeMaturityResponse(SAMPLE_COMPONENTS))

    const result = await fetchMaturityMapping()

    const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1]
    expect(lastCall[0]).toBe(MATURITY_URL)
    expect(lastCall[1].headers).toBeUndefined()
    expect(result.mapping['odh-kserve-controller-rhel9']).toBe('Serving Orchestration')
  })

  it('sends Authorization header when token is provided', async () => {
    mockFetch.mockResolvedValueOnce(makeMaturityResponse(SAMPLE_COMPONENTS))

    await fetchMaturityMapping('my-token')

    const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1]
    expect(lastCall[1].headers).toEqual({ 'Authorization': 'Bearer my-token' })
  })

  it('extracts image short name from full registry path', async () => {
    mockFetch.mockResolvedValueOnce(makeMaturityResponse([
      {
        name: 'Test Component',
        id: 'test',
        images: ['registry.access.redhat.com/rhoai/odh-dashboard-rhel8']
      }
    ]))

    const result = await fetchMaturityMapping('test-token')
    expect(result.mapping['odh-dashboard-rhel8']).toBe('Test Component')
  })

  it('maps component-level images not wired to any deliverable', async () => {
    // Mirrors the real report: "AI Core Platform" lists odh-cli-rhel9 only in
    // its component-level `images` array, not under any deliverable. The
    // maturity tool accepts these ("evaluation-target-not-in-deliverable").
    mockFetch.mockResolvedValueOnce(makeMaturityResponse([
      {
        name: 'AI Core Platform',
        id: 'ai-core-platform',
        images: [
          'registry.access.redhat.com/rhoai/odh-kube-auth-proxy-rhel9',
          'quay.io/rhoai/odh-cli-rhel9'
        ],
        // Deliverables intentionally omit odh-cli — proves we do NOT rely on them.
        deliverables: [
          { images: ['quay.io/rhoai/odh-kube-auth-proxy-rhel9'], shipped: 'shipped' }
        ]
      }
    ]))

    const result = await fetchMaturityMapping('test-token')
    expect(result.mapping['odh-cli-rhel9']).toBe('AI Core Platform')
    expect(result.mapping['odh-kube-auth-proxy-rhel9']).toBe('AI Core Platform')
  })

  it('throws on 401 response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 })
    await expect(fetchMaturityMapping('bad-token')).rejects.toThrow('authentication failed')
  })

  it('throws on 404 response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 })
    await expect(fetchMaturityMapping('token')).rejects.toThrow('not found')
  })

  it('throws a generic message for other non-200 statuses', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 })
    await expect(fetchMaturityMapping('token')).rejects.toThrow('GitLab API returned 500')
  })

  it('skips non-string entries inside images arrays', async () => {
    mockFetch.mockResolvedValueOnce(makeMaturityResponse([
      { name: 'Mixed', id: 'mixed', images: ['quay.io/ns/mixed-rhel9', 42, null] }
    ]))

    const result = await fetchMaturityMapping('token')
    expect(Object.keys(result.mapping)).toEqual(['mixed-rhel9'])
    expect(result.mapping['mixed-rhel9']).toBe('Mixed')
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

  it('skips malformed images gracefully', async () => {
    mockFetch.mockResolvedValueOnce(makeMaturityResponse([
      {
        name: 'Good',
        id: 'good',
        images: ['quay.io/ns/good-image']
      },
      {
        name: 'Bad Images',
        id: 'bad',
        images: 'not-an-array'
      },
      {
        name: 'Missing Images',
        id: 'bad2'
      },
      {
        name: '',
        images: ['quay.io/ns/unnamed']
      }
    ]))

    const result = await fetchMaturityMapping('token')
    expect(result.mapping['good-image']).toBe('Good')
    expect(Object.keys(result.mapping)).toHaveLength(1)
    expect(result.allProductComponents).toEqual([
      { name: 'Bad Images', owner: null, team: null },
      { name: 'Good', owner: null, team: null },
      { name: 'Missing Images', owner: null, team: null }
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
