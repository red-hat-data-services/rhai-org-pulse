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
});
