import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('Commitment Snapshot Creation', () => {
  let mockStorage
  let mockRequest
  let mockResponse
  let routeHandler

  beforeEach(() => {
    // Mock storage
    mockStorage = {
      readFromStorage: vi.fn(),
      writeToStorage: vi.fn()
    }

    // Mock request/response
    mockRequest = { params: {}, user: { email: 'test@redhat.com' } }
    mockResponse = {
      json: vi.fn(),
      status: vi.fn().mockReturnThis()
    }

    // Mock route handler (simplified version)
    routeHandler = function(req, res) {
      const { version, phase } = req.params

      // Validate phase
      const validPhases = ['EA1', 'EA2', 'GA']
      if (!validPhases.includes(phase)) {
        return res.status(400).json({ error: `Invalid phase. Must be one of: ${validPhases.join(', ')}` })
      }

      // Validate version format
      if (!/^\d+\.\d+$/.test(version)) {
        return res.status(400).json({ error: 'Invalid version format. Expected X.Y (e.g., "3.5")' })
      }

      // Load delivery analysis
      const analysisCache = mockStorage.readFromStorage('releases/delivery/analysis-cache.json')
      if (!analysisCache?.data) {
        return res.status(404).json({ error: 'Delivery analysis data not available. Run "Refresh Current Status" first.' })
      }

      // Aggregate matching releases
      const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const versionPattern = new RegExp(`\\b${escaped}\\b`)
      const matchingReleases = analysisCache.data.releases.filter(r => versionPattern.test(r.releaseNumber))

      if (matchingReleases.length === 0) {
        return res.status(404).json({ error: `No releases found matching version ${version}` })
      }

      // Collect Features
      const features = []
      const seenKeys = new Set()
      for (const release of matchingReleases) {
        for (const issue of release.issues || []) {
          if (!seenKeys.has(issue.key) && issue.issueType === 'Feature') {
            features.push({
              key: issue.key,
              summary: issue.summary,
              status: issue.status,
              components: issue.components,
              deliveryOwner: issue.deliveryOwner
            })
            seenKeys.add(issue.key)
          }
        }
      }

      // Create snapshot
      const snapshotData = {
        version,
        phase,
        snapshotAt: new Date().toISOString(),
        snapshotTrigger: 'manual',
        featureKeys: Array.from(seenKeys),
        featureCount: seenKeys.size,
        features
      }

      mockStorage.writeToStorage(`releases/planning/committed-snapshot-${version}-${phase}.json`, snapshotData)

      res.json({
        phase,
        featureCount: seenKeys.size,
        snapshotAt: snapshotData.snapshotAt
      })
    }
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should reject invalid phase', () => {
    mockRequest.params = { version: '3.5', phase: 'INVALID' }
    routeHandler(mockRequest, mockResponse)

    expect(mockResponse.status).toHaveBeenCalledWith(400)
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: 'Invalid phase. Must be one of: EA1, EA2, GA'
    })
  })

  it('should reject invalid version format', () => {
    mockRequest.params = { version: '3', phase: 'EA1' }
    routeHandler(mockRequest, mockResponse)

    expect(mockResponse.status).toHaveBeenCalledWith(400)
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: 'Invalid version format. Expected X.Y (e.g., "3.5")'
    })
  })

  it('should require delivery analysis cache', () => {
    mockRequest.params = { version: '3.5', phase: 'EA1' }
    mockStorage.readFromStorage.mockReturnValue(null)

    routeHandler(mockRequest, mockResponse)

    expect(mockResponse.status).toHaveBeenCalledWith(404)
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: 'Delivery analysis data not available. Run "Refresh Current Status" first.'
    })
  })

  it('should create snapshot with matching features', () => {
    mockRequest.params = { version: '3.5', phase: 'EA1' }

    const mockAnalysisCache = {
      data: {
        releases: [
          {
            releaseNumber: 'rhoai-3.5',
            issues: [
              { key: 'AIPCC-1', summary: 'Feature 1', status: 'Done', issueType: 'Feature', components: ['A'], deliveryOwner: 'user1' },
              { key: 'AIPCC-2', summary: 'Feature 2', status: 'In Progress', issueType: 'Feature', components: ['B'], deliveryOwner: 'user2' },
              { key: 'AIPCC-3', summary: 'Story 1', status: 'Done', issueType: 'Story', components: ['A'], deliveryOwner: 'user1' }
            ]
          },
          {
            releaseNumber: 'rhelai-3.5',
            issues: [
              { key: 'AIPCC-4', summary: 'Feature 3', status: 'To Do', issueType: 'Feature', components: ['C'], deliveryOwner: 'user3' }
            ]
          }
        ]
      }
    }

    mockStorage.readFromStorage.mockReturnValue(mockAnalysisCache)

    routeHandler(mockRequest, mockResponse)

    expect(mockStorage.writeToStorage).toHaveBeenCalledWith(
      'releases/planning/committed-snapshot-3.5-EA1.json',
      expect.objectContaining({
        version: '3.5',
        phase: 'EA1',
        featureCount: 3, // Only Features, not Stories
        featureKeys: expect.arrayContaining(['AIPCC-1', 'AIPCC-2', 'AIPCC-4'])
      })
    )

    expect(mockResponse.json).toHaveBeenCalledWith({
      phase: 'EA1',
      featureCount: 3,
      snapshotAt: expect.any(String)
    })
  })

  it('should handle no matching releases', () => {
    mockRequest.params = { version: '9.9', phase: 'EA1' }

    const mockAnalysisCache = {
      data: {
        releases: [
          { releaseNumber: 'rhoai-3.5', issues: [] }
        ]
      }
    }

    mockStorage.readFromStorage.mockReturnValue(mockAnalysisCache)

    routeHandler(mockRequest, mockResponse)

    expect(mockResponse.status).toHaveBeenCalledWith(404)
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: 'No releases found matching version 9.9'
    })
  })
})
