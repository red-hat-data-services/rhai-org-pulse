import { describe, it, expect, beforeAll } from 'vitest';
const express = require('express');
const request = require('supertest');
const demoStorage = require('../../../shared/server/demo-storage');

describe('org-lens routes', () => {
  let app;

  beforeAll(() => {
    process.env.DEMO_MODE = 'true';

    app = express();
    app.use(express.json());

    const router = express.Router();
    const registerRoutes = require('../server/index');

    const context = {
      storage: demoStorage,
      secrets: {},
      resolveSecret: () => undefined,
      requireAuth: (_req, _res, next) => next(),
      requireAdmin: (_req, _res, next) => next(),
      requireScope: () => (_req, _res, next) => next(),
      registerScopes: () => {},
      registerDiagnostics: () => {},
    };

    registerRoutes(router, context);
    app.use('/api/modules/org-lens', router);
  });

  describe('POST /chat', () => {
    it('returns SSE stream in demo mode', async () => {
      const res = await request(app)
        .post('/api/modules/org-lens/chat')
        .send({ message: 'Hello', history: [] })
        .expect(200);

      expect(res.headers['content-type']).toContain('text/event-stream');
      expect(res.text).toContain('event: chunk');
      expect(res.text).toContain('event: done');
    });

    it('returns 400 for missing message', async () => {
      await request(app)
        .post('/api/modules/org-lens/chat')
        .send({ history: [] })
        .expect(400);
    });
  });

  describe('GET /datasets', () => {
    it('returns available datasets', async () => {
      const res = await request(app)
        .get('/api/modules/org-lens/datasets')
        .expect(200);

      expect(res.body.datasets).toBeDefined();
      expect(Array.isArray(res.body.datasets)).toBe(true);
    });
  });

  describe('POST /datasets/:scopeId', () => {
    const validSummaries = {
      metadata: { scope: 'test_upload', generated: '2026-06-21' },
      people_summaries: [
        { name: 'Alice Test', uid: 'atest', title: 'Engineer', technologies: ['Go'], products: [] },
        { name: 'Bob Test', uid: 'btest', title: 'SRE', technologies: ['Python'], products: [] },
      ],
    };

    it('accepts valid upload with people_summaries', async () => {
      const res = await request(app)
        .post('/api/modules/org-lens/datasets/test_upload')
        .send({ people_summaries: validSummaries })
        .expect(200);

      expect(res.body.status).toBe('ok');
      expect(res.body.scopeId).toBe('test_upload');
      expect(res.body.headcount).toBe(2);
    });

    it('returns 400 when people_summaries is missing', async () => {
      const res = await request(app)
        .post('/api/modules/org-lens/datasets/bad_payload')
        .send({ projects: {} })
        .expect(400);

      expect(res.body.error).toContain('people_summaries');
    });

    it('returns 400 for invalid scopeId with path traversal', async () => {
      await request(app)
        .post('/api/modules/org-lens/datasets/..%2Fetc')
        .send({ people_summaries: validSummaries })
        .expect(400);
    });

    it('returns 400 for scopeId with special characters', async () => {
      await request(app)
        .post('/api/modules/org-lens/datasets/scope%20with%20spaces')
        .send({ people_summaries: validSummaries })
        .expect(400);
    });

    it('accepts upload with all three fields', async () => {
      const categories = { categories: [{ name: 'Platform', people: ['atest'] }] };
      const projects = { projects: [{ key: 'TST', name: 'Test Project' }] };

      const res = await request(app)
        .post('/api/modules/org-lens/datasets/full_upload')
        .send({
          people_summaries: validSummaries,
          people_categories: categories,
          projects: projects,
        })
        .expect(200);

      expect(res.body.status).toBe('ok');
      expect(res.body.headcount).toBe(2);
    });

    it('makes uploaded dataset visible in GET /datasets', async () => {
      await request(app)
        .post('/api/modules/org-lens/datasets/visible_test')
        .send({ people_summaries: validSummaries })
        .expect(200);

      const res = await request(app)
        .get('/api/modules/org-lens/datasets')
        .expect(200);

      const names = res.body.datasets.map(d => d.name);
      expect(names).toContain('visible_test');
    });
  });
});
