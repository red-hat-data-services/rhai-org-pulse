'use strict';

const { loadAllDatasets, resolveDataset } = require('./dataset-loader');
const { DatasetIndex } = require('./dataset-index');
const { createGeminiClient, buildSystemPrompt, processChat } = require('./gemini');
const { getToolDeclarations, executeToolCall } = require('./tool-definitions');

const MAX_HISTORY_MESSAGES = 20;
const DEMO_RESPONSES = [
  'Based on the data, I can see there are **10 people** in this dataset across various engineering disciplines including Kubernetes, AI/ML, networking, storage, and security.',
  'I found several people working on that topic. Let me share their profiles with you.',
  'Great question! Let me look that up in the dataset.',
];

module.exports = function registerRoutes(router, context) {
  const DEMO_MODE = process.env.DEMO_MODE === 'true';
  const { storage, requireAuth, requireScope } = context;

  if (context.registerScopes) {
    context.registerScopes([
      { key: 'org-lens:read', label: 'Org Lens (Read)', description: 'Query Org Lens data', category: 'Org Lens' },
    ]);
  }

  const datasets = loadAllDatasets(storage);

  let geminiModel = null;

  function getGeminiModel() {
    if (geminiModel) return geminiModel;
    const apiKey = (context.secrets && context.secrets.GEMINI_API_KEY)
      || (context.resolveSecret && context.resolveSecret('GEMINI_API_KEY'));
    if (!apiKey) return null;
    const modelName = process.env.ORG_LENS_MODEL || undefined;
    geminiModel = createGeminiClient(apiKey, modelName);
    return geminiModel;
  }

  function sendSSE(res, event, data) {
    res.write('event: ' + event + '\n');
    res.write('data: ' + JSON.stringify(data) + '\n\n');
  }

  /**
   * @openapi
   * /api/modules/org-lens/chat:
   *   post:
   *     tags: [Org Lens]
   *     summary: Chat with the Org Lens dataset
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [message]
   *             properties:
   *               message:
   *                 type: string
   *               history:
   *                 type: array
   *               dataset:
   *                 type: string
   *     responses:
   *       200:
   *         description: SSE stream of chat response chunks
   *         content:
   *           text/event-stream: {}
   *       400:
   *         description: Missing message
   *       503:
   *         description: Gemini API key not configured
   */
  router.post('/chat', requireAuth, requireScope('org-lens:read'), function(req, res) {
    const { message, history, dataset } = req.body || {};

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message is required' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    let index;
    try {
      index = resolveDataset(datasets, dataset || null);
    } catch (err) {
      sendSSE(res, 'error', { error: err.message });
      sendSSE(res, 'done', {});
      return res.end();
    }

    const model = getGeminiModel();
    if (!model) {
      if (DEMO_MODE) {
        const idx = Math.abs(hashCode(message)) % DEMO_RESPONSES.length;
        const response = DEMO_RESPONSES[idx];
        const words = response.split(' ');
        for (let i = 0; i < words.length; i++) {
          const text = (i === 0 ? '' : ' ') + words[i];
          sendSSE(res, 'chunk', { text });
        }
        sendSSE(res, 'done', {});
        return res.end();
      }
      sendSSE(res, 'error', { error: 'GEMINI_API_KEY not configured' });
      sendSSE(res, 'done', {});
      return res.end();
    }

    const trimmedHistory = (history || []).slice(-MAX_HISTORY_MESSAGES);
    const geminiHistory = trimmedHistory.map(function(msg) {
      return {
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      };
    });

    const systemPrompt = buildSystemPrompt(index);

    processChat(model, message, geminiHistory, getToolDeclarations(), {
      onChunk: function(text) {
        sendSSE(res, 'chunk', { text });
      },
      executeToolCall: function(name, args) {
        return executeToolCall(index, name, args);
      },
      systemPrompt: systemPrompt,
    }).then(function() {
      sendSSE(res, 'done', {});
      res.end();
    }).catch(function(err) {
      console.error('[org-lens] Chat error:', err.message);
      sendSSE(res, 'error', { error: 'Chat processing failed' });
      sendSSE(res, 'done', {});
      res.end();
    });
  });

  /**
   * @openapi
   * /api/modules/org-lens/datasets:
   *   get:
   *     tags: [Org Lens]
   *     summary: List available datasets
   *     responses:
   *       200:
   *         description: List of loaded datasets
   */
  router.get('/datasets', requireAuth, requireScope('org-lens:read'), function(req, res) {
    const datasetList = Object.keys(datasets).map(function(name) {
      const idx = datasets[name];
      return {
        name: name,
        headcount: idx.people.length,
        metadata: idx.metadata,
      };
    });
    res.json({ datasets: datasetList });
  });

  /**
   * @openapi
   * /api/modules/org-lens/datasets/{scopeId}:
   *   post:
   *     tags: [Org Lens]
   *     summary: Upload dataset from pipeline
   *     parameters:
   *       - in: path
   *         name: scopeId
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [people_summaries]
   *             properties:
   *               people_summaries:
   *                 type: object
   *               people_categories:
   *                 type: object
   *               projects:
   *                 type: object
   *     responses:
   *       200:
   *         description: Dataset uploaded and loaded
   *       400:
   *         description: Invalid request
   */
  router.post('/datasets/:scopeId', function(req, res) {
    var scopeId = req.params.scopeId;

    if (!/^[a-zA-Z0-9_-]+$/.test(scopeId)) {
      return res.status(400).json({ error: 'Invalid scopeId format' });
    }

    var body = req.body || {};
    var summaries = body.people_summaries;
    var categories = body.people_categories || null;
    var projects = body.projects || null;

    if (!summaries || typeof summaries !== 'object') {
      return res.status(400).json({ error: 'people_summaries is required' });
    }

    storage.writeToStorage('org-lens/' + scopeId + '/people_summaries_' + scopeId + '.json', summaries);
    if (categories) {
      storage.writeToStorage('org-lens/' + scopeId + '/people_categories_' + scopeId + '.json', categories);
    }
    if (projects) {
      storage.writeToStorage('org-lens/' + scopeId + '/projects_' + scopeId + '.json', projects);
    }

    datasets[scopeId] = new DatasetIndex(scopeId, summaries, categories, projects);

    res.json({
      status: 'ok',
      scopeId: scopeId,
      headcount: datasets[scopeId].people.length,
    });
  });

  if (context.registerDiagnostics) {
    context.registerDiagnostics(function() {
      return {
        datasets: Object.keys(datasets).map(function(name) {
          return { name: name, headcount: datasets[name].people.length };
        }),
        geminiConfigured: !!getGeminiModel(),
        demoMode: DEMO_MODE,
      };
    });
  }
};

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return hash;
}
