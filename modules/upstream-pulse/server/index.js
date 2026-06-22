const { getAllPeople } = require('../../../shared/server/roster');

const DEFAULT_BASE_URL = 'http://backend.ambient-code--upstream-pulse.svc.cluster.local:3000';
const PROXY_TIMEOUT = 90_000;
const CACHE_TTL = 3 * 60 * 1000;

const responseCache = new Map();

function getBaseUrl() {
  return (process.env.UPSTREAM_PULSE_API_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

function getCacheKey(path, query) {
  const sorted = Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  return `${path}?${sorted}`;
}

async function proxyRequest(path, query = {}) {
  const cacheKey = getCacheKey(path, query);
  const cached = responseCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.data;
  }

  const base = getBaseUrl();
  const url = new URL(path, base);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url.toString(), {
    signal: AbortSignal.timeout(PROXY_TIMEOUT),
    headers: { 'Accept': 'application/json' }
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    const err = new Error(`Upstream Pulse returned ${response.status}: ${body.slice(0, 200)}`);
    err.upstreamStatus = response.status;
    throw err;
  }

  const data = await response.json();
  responseCache.set(cacheKey, { data, ts: Date.now() });

  if (responseCache.size > 100) {
    const oldest = [...responseCache.entries()].sort((a, b) => a[1].ts - b[1].ts);
    for (let i = 0; i < 20; i++) responseCache.delete(oldest[i][0]);
  }

  return data;
}

function buildIdentityHeaders(req) {
  const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
  // Forward gateway identity headers when present (production behind OAuth proxy).
  // In dev, these headers are absent so the standalone backend uses its own DEV_IDENTITY.
  if (req.headers?.['x-forwarded-email']) headers['x-forwarded-email'] = req.headers['x-forwarded-email'];
  if (req.headers?.['x-forwarded-user']) headers['x-forwarded-user'] = req.headers['x-forwarded-user'];
  if (req.headers?.['x-forwarded-groups']) headers['x-forwarded-groups'] = req.headers['x-forwarded-groups'];
  return headers;
}

async function proxyMutatingRequest(path, body, req) {
  const base = getBaseUrl();
  const url = new URL(path, base);
  const headers = buildIdentityHeaders(req);

  const response = await fetch(url.toString(), {
    method: 'POST',
    signal: AbortSignal.timeout(PROXY_TIMEOUT),
    headers,
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const err = new Error(data.error || `Upstream Pulse returned ${response.status}`);
    err.upstreamStatus = response.status;
    err.upstreamBody = data;
    throw err;
  }

  return data;
}

async function proxyAdminGet(path, query, req) {
  const base = getBaseUrl();
  const url = new URL(path, base);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  }
  const headers = buildIdentityHeaders(req);

  const response = await fetch(url.toString(), {
    signal: AbortSignal.timeout(PROXY_TIMEOUT),
    headers,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    const err = new Error(`Upstream Pulse returned ${response.status}: ${body.slice(0, 200)}`);
    err.upstreamStatus = response.status;
    throw err;
  }

  return response.json();
}

async function checkConnection() {
  try {
    const base = getBaseUrl();
    const response = await fetch(`${base}/health`, { signal: AbortSignal.timeout(5000) });
    return { reachable: true, status: response.status };
  } catch (err) {
    return { reachable: false, error: err.message };
  }
}

// PyTorch uses GitHub repo permission levels (write/triage) as its governance model
// instead of CODEOWNERS or maintainer files. This data is precomputed externally and
// stored in a GitLab project file. We fetch it directly here because the upstream-pulse
// backend is open-source and can't have this org-specific integration.
let _moduleSecrets = null;
function getGitlabProjectId() {
  return (_moduleSecrets && _moduleSecrets.GITLAB_TEAM_DATA_PROJECT_ID) || '82624331';
}
const GITLAB_DATA_FILE_PATH = encodeURIComponent('github-access.json');
const GITLAB_DATA_CACHE_TTL = 30 * 60 * 1000;
let _gitlabDataCache = null;

async function fetchPytorchAccess() {
  if (_gitlabDataCache && Date.now() - _gitlabDataCache.ts < GITLAB_DATA_CACHE_TTL) {
    return _gitlabDataCache.data;
  }

  const token = _moduleSecrets && _moduleSecrets.GITLAB_TOKEN;
  if (!token) return null;

  const url = `https://gitlab.com/api/v4/projects/${getGitlabProjectId()}/repository/files/${GITLAB_DATA_FILE_PATH}/raw?ref=main`;
  const resp = await fetch(url, {
    signal: AbortSignal.timeout(10000),
    headers: { 'PRIVATE-TOKEN': token, 'Accept': 'application/json' },
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`GitLab returned ${resp.status}: ${body.slice(0, 200)}`);
  }

  const data = await resp.json();
  if (data.write == null || data.total == null) {
    throw new Error('GitLab data missing required fields (write, total)');
  }
  _gitlabDataCache = { data, ts: Date.now() };
  return data;
}

const ROSTER_PUSH_SOURCE = 'org_pulse_roster';
const ROSTER_PUSH_REPLACES = ['github_org_sync'];
const ROSTER_PUSH_INTERVAL = 2 * 60 * 60 * 1000; // 2 hours
const ROSTER_PUSH_STARTUP_DELAY = 2 * 60 * 1000; // 2 minutes
const ROSTER_PUSH_TIMEOUT = 5 * 60 * 1000; // 5 minutes (bulk sync processes hundreds of members)

let _lastPushGeneratedAt = null;

function getServiceIdentityHeaders() {
  const serviceUser = process.env.UPSTREAM_SYNC_SERVICE_USER || 'roster-sync-service';
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'x-forwarded-user': serviceUser,
    'x-forwarded-email': serviceUser + '@internal'
  };
}

async function pushRosterToUpstream(storage) {
  const allPeople = getAllPeople(storage);

  const people = [];
  for (const p of allPeople) {
    if (!p.github || !p.github.username) continue;
    people.push({
      name: p.name,
      email: p.email || null,
      githubUsername: p.github.username,
      employeeId: p.uid || null,
      department: p._teamGrouping || p.miroTeam || null,
      role: p.title || null
    });
  }

  if (people.length === 0) {
    console.log('[upstream-pulse] Roster push skipped: no people with GitHub usernames');
    return { skipped: true, reason: 'no_people' };
  }

  const base = getBaseUrl();
  const url = base + '/api/admin/team-members/sync';
  const body = {
    source: ROSTER_PUSH_SOURCE,
    replacesSources: ROSTER_PUSH_REPLACES,
    people: people
  };

  console.log('[upstream-pulse] Pushing ' + people.length + ' roster members to ' + url);
  const response = await fetch(url, {
    method: 'POST',
    signal: AbortSignal.timeout(ROSTER_PUSH_TIMEOUT),
    headers: getServiceIdentityHeaders(),
    body: JSON.stringify(body)
  });

  const data = await response.json().catch(function() { return {}; });
  if (!response.ok) {
    throw new Error('Roster push failed (' + response.status + '): ' + (data.error || 'unknown'));
  }

  console.log('[upstream-pulse] Roster push complete:', JSON.stringify(data));
  return data;
}

function startPeriodicRosterPush(storage) {
  if (process.env.DEMO_MODE === 'true') return;

  function checkAndPush() {
    try {
      const registry = storage.readFromStorage('team-data/registry.json');
      if (!registry || !registry.meta || !registry.meta.generatedAt) return;

      const generatedAt = registry.meta.generatedAt;
      if (_lastPushGeneratedAt === generatedAt) return;

      pushRosterToUpstream(storage).then(function(result) {
        if (!result.skipped) {
          _lastPushGeneratedAt = generatedAt;
        }
      }).catch(function(err) {
        console.warn('[upstream-pulse] Periodic roster push failed:', err.message);
      });
    } catch (err) {
      console.warn('[upstream-pulse] Periodic roster push check failed:', err.message);
    }
  }

  const startupTimer = setTimeout(checkAndPush, ROSTER_PUSH_STARTUP_DELAY);
  if (startupTimer.unref) startupTimer.unref();
  const intervalTimer = setInterval(checkAndPush, ROSTER_PUSH_INTERVAL);
  if (intervalTimer.unref) intervalTimer.unref();
}

module.exports = function registerRoutes(router, context) {
  const { requireScope, secrets } = context;
  _moduleSecrets = secrets;
  const DEMO_MODE = process.env.DEMO_MODE === 'true';

  // Register module scopes
  context.registerScopes([
    { key: 'upstream-pulse:read', label: 'Upstream Pulse (Read)', description: 'Read upstream pulse data', category: 'Upstream Pulse' },
    { key: 'upstream-pulse:write', label: 'Upstream Pulse (Write)', description: 'Mutate upstream pulse data', category: 'Upstream Pulse' }
  ]);

  function handleProxyError(res, err) {
    const status = err.upstreamStatus || 502;
    console.error('[upstream-pulse]', err.message);
    res.status(status).json({
      error: 'Upstream Pulse request failed',
      message: err.message
    });
  }

  // Demo mode stub data
  function getDemoData(endpoint) {
    if (endpoint === 'dashboard') {
      return {
        contributions: {
          all: { team: 1250, total: 5000, teamPercent: 25 },
          commits: { team: 500, total: 2000, teamPercent: 25 },
          pullRequests: { team: 300, total: 1200, teamPercent: 25 },
          reviews: { team: 250, total: 1000, teamPercent: 25 },
          issues: { team: 200, total: 800, teamPercent: 25 }
        },
        summary: {
          activeContributors: 42,
          trackedProjects: 6,
          periodStart: '2024-01-01',
          periodEnd: '2024-01-31'
        },
        topContributors: [
          { id: '1', name: 'Alice Johnson', githubUsername: 'alicecodes', total: 450, commits: 200, prs: 100, reviews: 100, issues: 50 },
          { id: '2', name: 'Bob Smith', githubUsername: 'bobsmith', total: 380, commits: 180, prs: 80, reviews: 80, issues: 40 }
        ],
        orgActivity: [
          { org: 'kubernetes', orgName: 'Kubernetes', total: 500, totalContributions: 2000, teamSharePercent: 25, percentChange: 15, activeTeamMembers: 10, leadershipCount: 3, maintainerCount: 2 },
          { org: 'kubeflow', orgName: 'Kubeflow', total: 300, totalContributions: 1200, teamSharePercent: 25, percentChange: 10, activeTeamMembers: 8, leadershipCount: 2, maintainerCount: 1 },
          { org: 'kserve', orgName: 'KServe', total: 250, totalContributions: 1000, teamSharePercent: 25, percentChange: 8, activeTeamMembers: 7, leadershipCount: 1, maintainerCount: 1 },
          { org: 'ray-project', orgName: 'Ray Project', total: 200, totalContributions: 800, teamSharePercent: 25, percentChange: 5, activeTeamMembers: 6, leadershipCount: 0, maintainerCount: 0 }
        ],
        dailyBreakdown: [
          { date: '2024-01-01', team: 25, total: 100 },
          { date: '2024-01-02', team: 30, total: 120 },
          { date: '2024-01-03', team: 28, total: 110 }
        ],
        topProjects: [
          { id: '1', name: 'kubernetes', githubOrg: 'kubernetes', githubRepo: 'kubernetes', contributions: 450, activeContributors: 15 },
          { id: '2', name: 'kubeflow', githubOrg: 'kubeflow', githubRepo: 'kubeflow', contributions: 320, activeContributors: 12 },
          { id: '3', name: 'kserve', githubOrg: 'kserve', githubRepo: 'kserve', contributions: 280, activeContributors: 10 },
          { id: '4', name: 'ray-project', githubOrg: 'ray-project', githubRepo: 'ray', contributions: 200, activeContributors: 8 }
        ],
        trends: {},
        leadership: {
          byOrg: [
            {
              orgName: 'Kubernetes',
              positions: [
                {
                  positionType: 'steering_committee',
                  roleTitle: 'Steering Committee',
                  teamCount: 2,
                  members: [
                    { id: 'leader1', name: 'Sarah Chen', githubUsername: 'sarahchen', avatarUrl: 'https://github.com/sarahchen.png' },
                    { id: 'leader2', name: 'Mike Rodriguez', githubUsername: 'mikerodriguez', avatarUrl: 'https://github.com/mikerodriguez.png' }
                  ]
                }
              ]
            }
          ]
        }
      };
    } else if (endpoint === 'contributors') {
      return {
        contributors: [
          { id: '1', name: 'Alice Johnson', githubUsername: 'alicecodes', total: 450, commits: 200, prs: 100, reviews: 100, issues: 50 },
          { id: '2', name: 'Bob Smith', githubUsername: 'bobsmith', total: 380, commits: 180, prs: 80, reviews: 80, issues: 40 }
        ]
      };
    } else if (endpoint === 'leadership') {
      return {
        summary: {
          codeOwnerFiles: 15,
          totalCodeOwnerFiles: 50,
          ownerPositions: 8,
          totalOwnerPositions: 25,
          projectLeadPositions: 5,
          totalProjectLeadPositions: 20,
          reviewerPositions: 12,
          totalReviewerPositions: 40,
          projectsWithTeamLeadership: 4
        },
        members: [
          {
            id: 'm1',
            name: 'Alex Thompson',
            githubUsername: 'alexthompson',
            roles: [
              { projectId: 'p1', projectName: 'kubernetes', role: 'Owner' },
              { projectId: 'p2', projectName: 'kubeflow', role: 'Reviewer' }
            ]
          },
          {
            id: 'm2',
            name: 'Jordan Lee',
            githubUsername: 'jordanlee',
            roles: [
              { projectId: 'p3', projectName: 'kserve', role: 'Owner' },
              { projectId: 'p4', projectName: 'ray-project', role: 'Reviewer' }
            ]
          }
        ],
        byOrg: []
      };
    } else if (endpoint === 'projects') {
      return {
        projects: [
          { id: '1', name: 'kubernetes', githubOrg: 'kubernetes', githubRepo: 'kubernetes', contributions: 450, activeContributors: 15 },
          { id: '2', name: 'kubeflow', githubOrg: 'kubeflow', githubRepo: 'kubeflow', contributions: 320, activeContributors: 12 }
        ]
      };
    } else if (endpoint === 'orgs') {
      return {
        orgs: [
          { org: 'kubernetes', orgName: 'Kubernetes', total: 500, totalContributions: 2000, teamSharePercent: 25, activeTeamMembers: 10 },
          { org: 'kubeflow', orgName: 'Kubeflow', total: 300, totalContributions: 1200, teamSharePercent: 25, activeTeamMembers: 8 }
        ],
        summary: {
          totalContributions: 800,
          activeMembers: 18,
          activeOrgs: 2,
          avgTeamShare: 25.0
        }
      };
    }
    return {};
  }

  router.get('/config', requireScope('upstream-pulse:read'), async function(req, res) {
    try {
      if (DEMO_MODE) {
        return res.json({
          baseUrl: 'http://demo-upstream-pulse',
          configured: true,
          connection: { reachable: true, status: 200 }
        });
      }
      const connection = await checkConnection();
      res.json({
        baseUrl: getBaseUrl(),
        configured: !!process.env.UPSTREAM_PULSE_API_URL,
        connection
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/dashboard', requireScope('upstream-pulse:read'), async function(req, res) {
    try {
      if (DEMO_MODE) {
        return res.json(getDemoData('dashboard'));
      }
      const data = await proxyRequest('/api/metrics/dashboard', {
        days: req.query.days,
        githubOrg: req.query.githubOrg,
        projectId: req.query.projectId
      });
      res.json(data);
    } catch (err) {
      handleProxyError(res, err);
    }
  });

  router.get('/contributors', requireScope('upstream-pulse:read'), async function(req, res) {
    try {
      if (DEMO_MODE) {
        return res.json(getDemoData('contributors'));
      }
      const data = await proxyRequest('/api/metrics/contributors', {
        days: req.query.days,
        limit: req.query.limit,
        githubOrg: req.query.githubOrg,
        projectId: req.query.projectId
      });
      res.json(data);
    } catch (err) {
      handleProxyError(res, err);
    }
  });

  router.get('/leadership', requireScope('upstream-pulse:read'), async function(req, res) {
    try {
      if (DEMO_MODE) {
        return res.json(getDemoData('leadership'));
      }
      const data = await proxyRequest('/api/metrics/leadership', {
        githubOrg: req.query.githubOrg,
        projectId: req.query.projectId,
      });
      res.json(data);
    } catch (err) {
      handleProxyError(res, err);
    }
  });

  router.get('/projects', requireScope('upstream-pulse:read'), async function(req, res) {
    try {
      if (DEMO_MODE) {
        return res.json(getDemoData('projects'));
      }
      const data = await proxyRequest('/api/projects', {
        githubOrg: req.query.githubOrg
      });
      res.json(data);
    } catch (err) {
      handleProxyError(res, err);
    }
  });

  router.get('/orgs', requireScope('upstream-pulse:read'), async function(req, res) {
    try {
      if (DEMO_MODE) {
        return res.json(getDemoData('orgs'));
      }
      const data = await proxyRequest('/api/orgs', {
        days: req.query.days
      });
      res.json(data);
    } catch (err) {
      handleProxyError(res, err);
    }
  });

  /**
   * @openapi
   * /api/modules/upstream-pulse/github-access:
   *   get:
   *     tags: [Upstream Pulse]
   *     summary: PyTorch repo access level counts
   *     responses:
   *       200:
   *         description: Access level counts sourced from GitLab team data
   *       503:
   *         description: GitLab token not configured
   */
  router.get('/github-access', requireScope('upstream-pulse:read'), async function(req, res) {
    try {
      if (DEMO_MODE) {
        return res.json({ write: 12, triage: 8, total: 45 });
      }
      const data = await fetchPytorchAccess();
      if (!data) {
        return res.status(503).json({ error: 'GitLab token not configured' });
      }
      res.json(data);
    } catch (err) {
      console.error('[upstream-pulse] PyTorch access fetch failed:', err.message);
      res.status(502).json({ error: 'Failed to fetch access data' });
    }
  });

  router.get('/project-jobs', requireScope('upstream-pulse:read'), async function(req, res) {
    try {
      if (DEMO_MODE) {
        return res.json({
          jobs: [
            {
              id: 'job-1',
              projectId: req.query.projectId,
              status: 'completed',
              startedAt: '2026-01-15T10:00:00Z',
              completedAt: '2026-01-15T10:05:00Z',
              message: 'Sync completed successfully',
              itemsProcessed: 1250
            },
            {
              id: 'job-2',
              projectId: req.query.projectId,
              status: 'completed',
              startedAt: '2026-01-14T10:00:00Z',
              completedAt: '2026-01-14T10:03:00Z',
              message: 'Sync completed successfully',
              itemsProcessed: 1180
            }
          ]
        });
      }
      const projectId = req.query.projectId;
      if (!projectId) {
        return res.status(400).json({ error: 'projectId query param is required' });
      }
      const base = getBaseUrl();
      const response = await fetch(`${base}/api/system/status`, {
        signal: AbortSignal.timeout(PROXY_TIMEOUT),
        headers: { 'Accept': 'application/json' },
      });
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        const err = new Error(`Upstream Pulse returned ${response.status}: ${body.slice(0, 200)}`);
        err.upstreamStatus = response.status;
        throw err;
      }
      const data = await response.json();
      const jobs = (data.recentJobs || []).filter(j => j.projectId === projectId);
      res.json({ jobs });
    } catch (err) {
      handleProxyError(res, err);
    }
  });

  // ── Admin routes (require team-tracker admin) ──────────────────

  const { requireAdmin } = context;

  router.get('/repo-info', requireAdmin, requireScope('upstream-pulse:write'), async function(req, res) {
    try {
      if (DEMO_MODE) {
        return res.json({
          org: req.query.org,
          repo: req.query.repo,
          exists: true,
          visibility: 'public'
        });
      }
      const data = await proxyAdminGet('/api/github/repo-info', {
        org: req.query.org,
        repo: req.query.repo,
      }, req);
      res.json(data);
    } catch (err) {
      handleProxyError(res, err);
    }
  });

  router.post('/projects', requireAdmin, requireScope('upstream-pulse:write'), async function(req, res) {
    try {
      const data = await proxyMutatingRequest('/api/projects', req.body, req);
      for (const key of responseCache.keys()) {
        if (key.startsWith('/api/projects') || key.startsWith('/api/metrics/dashboard') || key.startsWith('/api/orgs')) {
          responseCache.delete(key);
        }
      }
      res.json(data);
    } catch (err) {
      const status = err.upstreamStatus || 502;
      console.error('[upstream-pulse] POST /projects:', err.message);
      res.status(status).json(err.upstreamBody || {
        error: 'Upstream Pulse request failed',
        message: err.message,
      });
    }
  });

  // ── Roster push (sync org-pulse team data to upstream-pulse) ──

  router.post('/roster-push', requireAdmin, requireScope('upstream-pulse:write'), async function(req, res) {
    try {
      const result = await pushRosterToUpstream(context.storage);
      if (!result.skipped) {
        const registry = context.storage.readFromStorage('team-data/registry.json');
        if (registry && registry.meta) _lastPushGeneratedAt = registry.meta.generatedAt;
      }
      res.json(result);
    } catch (err) {
      console.error('[upstream-pulse] Manual roster push failed:', err.message);
      res.status(502).json({ error: 'Roster push failed', message: err.message });
    }
  });

  // Start periodic roster push (checks registry.json for changes)
  startPeriodicRosterPush(context.storage);

  if (context.registerDiagnostics) {
    context.registerDiagnostics(async function() {
      const connection = await checkConnection();
      return {
        baseUrl: getBaseUrl(),
        configured: !!process.env.UPSTREAM_PULSE_API_URL,
        connection,
        rosterPush: {
          lastPushGeneratedAt: _lastPushGeneratedAt,
          serviceUser: process.env.UPSTREAM_SYNC_SERVICE_USER || 'roster-sync-service'
        }
      };
    });
  }
};
