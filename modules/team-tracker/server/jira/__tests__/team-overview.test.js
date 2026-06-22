import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock storage
const mockStorage = {}

vi.mock('../../../../../shared/server/storage', () => ({
  readFromStorage: vi.fn((key) => mockStorage[key] || null),
  writeToStorage: vi.fn((key, data) => { mockStorage[key] = data }),
  DATA_DIR: '/tmp/test-data'
}))

// Mock other deps so the server module loads
vi.mock('../jira-client', () => ({
  createJiraClient: () => ({})
}))
vi.mock('../orchestration', () => ({
  discoverBoards: vi.fn(),
  performRefresh: vi.fn()
}))

// We need to test the Express routes directly
import express from 'express'
import { readFromStorage, writeToStorage } from '../../../../../shared/server/storage'

function createTestApp() {
  const app = express()
  app.use(express.json())
  app.use((req, res, next) => {
    req.userEmail = 'test@redhat.com'
    next()
  })

  // GET annotations
  app.get('/api/sprints/:sprintId/annotations', (req, res) => {
    const { sprintId } = req.params
    const data = readFromStorage(`annotations/${sprintId}.json`)
    res.json(data || { annotations: {} })
  })

  // PUT annotations
  app.put('/api/sprints/:sprintId/annotations', (req, res) => {
    const { sprintId } = req.params
    const { assignee, text } = req.body
    if (!assignee || !text) {
      return res.status(400).json({ error: 'assignee and text are required' })
    }

    const data = readFromStorage(`annotations/${sprintId}.json`) || { annotations: {} }
    if (!data.annotations[assignee]) {
      data.annotations[assignee] = []
    }

    const annotation = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      text,
      author: req.userEmail,
      createdAt: new Date().toISOString()
    }

    data.annotations[assignee].push(annotation)
    writeToStorage(`annotations/${sprintId}.json`, data)
    res.json(annotation)
  })

  // DELETE annotation
  app.delete('/api/sprints/:sprintId/annotations/:assignee/:annotationId', (req, res) => {
    const { sprintId, assignee, annotationId } = req.params
    const data = readFromStorage(`annotations/${sprintId}.json`)
    if (!data?.annotations?.[assignee]) {
      return res.status(404).json({ error: 'Annotation not found' })
    }

    const before = data.annotations[assignee].length
    data.annotations[assignee] = data.annotations[assignee].filter(a => a.id !== annotationId)

    if (data.annotations[assignee].length === before) {
      return res.status(404).json({ error: 'Annotation not found' })
    }

    if (data.annotations[assignee].length === 0) {
      delete data.annotations[assignee]
    }

    writeToStorage(`annotations/${sprintId}.json`, data)
    res.json({ success: true })
  })

  return app
}

// Use supertest-style testing with node http
import http from 'http'

function request(app, method, path, body) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app)
    server.listen(0, () => {
      const port = server.address().port
      const options = {
        hostname: 'localhost',
        port,
        path,
        method,
        headers: { 'Content-Type': 'application/json' }
      }

      const req = http.request(options, (res) => {
        let data = ''
        res.on('data', chunk => { data += chunk })
        res.on('end', () => {
          server.close()
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) })
          } catch {
            resolve({ status: res.statusCode, body: data })
          }
        })
      })

      req.on('error', (err) => {
        server.close()
        reject(err)
      })

      if (body) {
        req.write(JSON.stringify(body))
      }
      req.end()
    })
  })
}

describe('Annotations API', () => {
  let app

  beforeEach(() => {
    // Clear mock storage
    Object.keys(mockStorage).forEach(k => delete mockStorage[k])
    vi.clearAllMocks()
    app = createTestApp()
  })

  describe('GET /api/sprints/:sprintId/annotations', () => {
    it('returns empty annotations when none exist', async () => {
      const res = await request(app, 'GET', '/api/sprints/123/annotations')
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ annotations: {} })
    })

    it('returns stored annotations', async () => {
      mockStorage['annotations/123.json'] = {
        annotations: {
          'Alice': [{ id: 'a1', text: 'On PTO', author: 'test@redhat.com', createdAt: '2026-02-25T00:00:00Z' }]
        }
      }

      const res = await request(app, 'GET', '/api/sprints/123/annotations')
      expect(res.status).toBe(200)
      expect(res.body.annotations.Alice).toHaveLength(1)
      expect(res.body.annotations.Alice[0].text).toBe('On PTO')
    })
  })

  describe('PUT /api/sprints/:sprintId/annotations', () => {
    it('creates a new annotation', async () => {
      const res = await request(app, 'PUT', '/api/sprints/123/annotations', {
        assignee: 'Alice',
        text: 'On PTO this sprint'
      })

      expect(res.status).toBe(200)
      expect(res.body.text).toBe('On PTO this sprint')
      expect(res.body.author).toBe('test@redhat.com')
      expect(res.body.id).toBeTruthy()
      expect(res.body.createdAt).toBeTruthy()
      expect(writeToStorage).toHaveBeenCalledWith('annotations/123.json', expect.any(Object))
    })

    it('returns 400 when assignee is missing', async () => {
      const res = await request(app, 'PUT', '/api/sprints/123/annotations', {
        text: 'On PTO'
      })
      expect(res.status).toBe(400)
    })

    it('returns 400 when text is missing', async () => {
      const res = await request(app, 'PUT', '/api/sprints/123/annotations', {
        assignee: 'Alice'
      })
      expect(res.status).toBe(400)
    })

    it('appends to existing annotations', async () => {
      mockStorage['annotations/123.json'] = {
        annotations: {
          'Alice': [{ id: 'a1', text: 'First note', author: 'test@redhat.com', createdAt: '2026-02-25T00:00:00Z' }]
        }
      }

      await request(app, 'PUT', '/api/sprints/123/annotations', {
        assignee: 'Alice',
        text: 'Second note'
      })

      const written = writeToStorage.mock.calls[0][1]
      expect(written.annotations.Alice).toHaveLength(2)
      expect(written.annotations.Alice[1].text).toBe('Second note')
    })
  })

  describe('DELETE /api/sprints/:sprintId/annotations/:assignee/:annotationId', () => {
    it('deletes an existing annotation', async () => {
      mockStorage['annotations/123.json'] = {
        annotations: {
          'Alice': [
            { id: 'a1', text: 'Note 1', author: 'test@redhat.com', createdAt: '2026-02-25T00:00:00Z' },
            { id: 'a2', text: 'Note 2', author: 'test@redhat.com', createdAt: '2026-02-25T00:00:00Z' }
          ]
        }
      }

      const res = await request(app, 'DELETE', '/api/sprints/123/annotations/Alice/a1')
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)

      const written = writeToStorage.mock.calls[0][1]
      expect(written.annotations.Alice).toHaveLength(1)
      expect(written.annotations.Alice[0].id).toBe('a2')
    })

    it('removes assignee key when last annotation is deleted', async () => {
      mockStorage['annotations/123.json'] = {
        annotations: {
          'Alice': [{ id: 'a1', text: 'Only note', author: 'test@redhat.com', createdAt: '2026-02-25T00:00:00Z' }]
        }
      }

      await request(app, 'DELETE', '/api/sprints/123/annotations/Alice/a1')

      const written = writeToStorage.mock.calls[0][1]
      expect(written.annotations.Alice).toBeUndefined()
    })

    it('returns 404 for non-existent annotation', async () => {
      mockStorage['annotations/123.json'] = {
        annotations: {
          'Alice': [{ id: 'a1', text: 'Note', author: 'test@redhat.com', createdAt: '2026-02-25T00:00:00Z' }]
        }
      }

      const res = await request(app, 'DELETE', '/api/sprints/123/annotations/Alice/nonexistent')
      expect(res.status).toBe(404)
    })

    it('returns 404 for non-existent assignee', async () => {
      const res = await request(app, 'DELETE', '/api/sprints/123/annotations/Nobody/a1')
      expect(res.status).toBe(404)
    })
  })
})
