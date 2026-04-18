module.exports = function registerRoutes(router, context) {
  const { storage, requireAdmin } = context;
  const { readFromStorage, writeToStorage, listStorageFiles, deleteStorageDirectory } = storage;

  const DEMO_MODE = process.env.DEMO_MODE === 'true';
  const { JIRA_HOST, jiraRequest } = require('../../../shared/server/jira');

  // Module-specific server imports
  const { fetchPersonMetrics } = require('./jira/person-metrics');
  const { fetchGithubData } = require('./github/contributions');
  const { fetchGitlabData } = require('./gitlab/contributions');
  const rosterSync = require('../../../shared/server/roster-sync');
  const rosterSyncConfig = require('../../../shared/server/roster-sync/config');
  const { readRosterFull: sharedReadRosterFull } = require('../../../shared/server/roster');
  const jiraSyncConfig = require('./jira/config');
  const { RESERVED_KEYS, DEFAULT_EXCLUDED_TITLES } = require('../../../shared/server/roster-sync/constants');
  const sheetsModule = require('../../../shared/server/roster-sync/sheets');
  const snapshots = require('./snapshots');

  // ─── Unified Sync State ───

  const STALENESS_THRESHOLD_MS = 48 * 60 * 60 * 1000;
  const unifiedSyncState = {
    inProgress: false,
    currentPhase: null,
    phaseLabel: null
  };

  // ─── Refresh State Tracker ───

  const refreshState = {
    running: false,
    scope: null,
    progress: { completed: 0, total: 0, errors: 0 },
    sources: { jira: null, github: null, gitlab: null },
    startedAt: null
  };

  // ─── Jira API helpers ───

  // ─── Cache paths & helpers ───

  const GITHUB_CACHE_PATH = 'github-contributions.json';
  const GITHUB_HISTORY_CACHE_PATH = 'github-history.json';
  const GITLAB_CACHE_PATH = 'gitlab-contributions.json';
  const GITLAB_HISTORY_CACHE_PATH = 'gitlab-history.json';

  function readGithubCache() {
    return readFromStorage(GITHUB_CACHE_PATH) || { users: {}, fetchedAt: null };
  }

  function readGithubHistoryCache() {
    return readFromStorage(GITHUB_HISTORY_CACHE_PATH) || { users: {}, fetchedAt: null };
  }

  function readGitlabCache() {
    return readFromStorage(GITLAB_CACHE_PATH) || { users: {}, fetchedAt: null };
  }

  function readGitlabHistoryCache() {
    return readFromStorage(GITLAB_HISTORY_CACHE_PATH) || { users: {}, fetchedAt: null };
  }

  function writeSinglePassResults(results, contribCachePath, historyCachePath) {
    const contribCache = readFromStorage(contribCachePath) || { users: {}, fetchedAt: null };
    const historyCache = readFromStorage(historyCachePath) || { users: {}, fetchedAt: null };
    const now = new Date().toISOString();

    for (const [username, data] of Object.entries(results)) {
      if (data) {
        contribCache.users[username] = data;
        historyCache.users[username] = { months: data.months || {}, fetchedAt: data.fetchedAt };
      }
    }

    contribCache.fetchedAt = now;
    historyCache.fetchedAt = now;
    writeToStorage(contribCachePath, contribCache);
    writeToStorage(historyCachePath, historyCache);
  }

  // ─── Jira Name Resolution Cache ───

  let jiraNameCache = readFromStorage('jira-name-map.json') || {};

  function persistNameCache() {
    writeToStorage('jira-name-map.json', jiraNameCache);
  }

  // ─── Helper functions ───

  function sanitizeFilename(name) {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '_');
  }

  function saveLastRefreshed() {
    writeToStorage('last-refreshed.json', { timestamp: new Date().toISOString() });
  }

  function readRosterFull() {
    return sharedReadRosterFull(storage);
  }

  function getOrgDisplayNames() {
    const fromConfig = rosterSyncConfig.getOrgDisplayNames(storage);
    if (Object.keys(fromConfig).length > 0) return fromConfig;
    return {};
  }

  function deriveRoster() {
    const full = readRosterFull();
    const orgs = [];

    const orgDisplayNames = getOrgDisplayNames();
    const liveConfig = rosterSyncConfig.loadConfig(storage);
    const teamStructure = liveConfig?.teamStructure || null;

    let visibleFields = [];
    let primaryDisplayField = null;
    if (teamStructure && Array.isArray(teamStructure.customFields)) {
      visibleFields = teamStructure.customFields
        .filter(f => f.visible)
        .map(f => ({ key: f.key, label: f.displayLabel || f.key }));
      const primary = teamStructure.customFields.find(f => f.primaryDisplay);
      if (primary) primaryDisplayField = primary.key;
    }

    for (const [orgKey, orgData] of Object.entries(full.orgs)) {
      const teamMap = {};
      const allMembers = [orgData.leader, ...orgData.members];

      for (const person of allMembers) {
        const groupingValue = teamStructure
          ? (person._teamGrouping || person.miroTeam || null)
          : (person.miroTeam || null);
        const teamNames = groupingValue
          ? groupingValue.split(',').map(t => t.trim()).filter(Boolean)
          : ['_unassigned'];

        const memberEntry = {
          name: person.name,
          jiraDisplayName: person.name,
          uid: person.uid,
          email: person.email,
          title: person.title,
          manager: person.managerUid || null,
          githubUsername: person.githubUsername || null,
          gitlabUsername: person.gitlabUsername || null,
          geo: person.geo || null,
          location: person.location || null,
          country: person.country || null,
          city: person.city || null,
          engineeringSpeciality: person.engineeringSpeciality || null,
          customFields: {}
        };

        if (teamStructure && Array.isArray(teamStructure.customFields)) {
          for (const field of teamStructure.customFields) {
            memberEntry.customFields[field.key] = person[field.key] || null;
          }
        } else {
          memberEntry.customFields.specialty = person.specialty || null;
          memberEntry.customFields.jiraComponent = person.jiraComponent || null;
        }

        for (const teamName of teamNames) {
          if (!teamMap[teamName]) {
            teamMap[teamName] = {
              displayName: teamName === '_unassigned' ? 'Unassigned' : teamName,
              members: []
            };
          }
          teamMap[teamName].members.push(memberEntry);
        }
      }

      orgs.push({
        key: orgKey,
        displayName: orgDisplayNames[orgKey] || orgData.leader.name,
        leader: {
          name: orgData.leader.name,
          uid: orgData.leader.uid,
          title: orgData.leader.title
        },
        teams: teamMap
      });
    }

    // ─── Merge pass: combine orgs with the same explicitly-configured displayName ───
    const byDisplayName = {};
    for (const org of orgs) {
      // Only merge orgs that have an explicit displayName from config
      if (!orgDisplayNames[org.key]) continue;
      const name = orgDisplayNames[org.key];
      if (!byDisplayName[name]) byDisplayName[name] = [];
      byDisplayName[name].push(org);
    }

    const mergedKeyMap = {};
    for (const [displayName, group] of Object.entries(byDisplayName)) {
      if (group.length < 2) continue;

      // Sort by key (UID) alphabetically for deterministic canonical key
      group.sort((a, b) => a.key.localeCompare(b.key));
      const canonical = group[0];
      const mergedKeys = group.map(o => o.key);
      canonical.mergedKeys = mergedKeys;

      for (let i = 1; i < group.length; i++) {
        const secondary = group[i];
        mergedKeyMap[secondary.key] = canonical.key;

        // Merge teams from secondary into canonical
        for (const [teamName, teamData] of Object.entries(secondary.teams)) {
          if (canonical.teams[teamName]) {
            // Team name collision: combine members, deduplicating
            canonical.teams[teamName].members = dedupeMembers([
              ...canonical.teams[teamName].members,
              ...teamData.members
            ]);
          } else {
            canonical.teams[teamName] = teamData;
          }
        }

        // Remove secondary org from the array
        const idx = orgs.indexOf(secondary);
        if (idx !== -1) orgs.splice(idx, 1);
      }

      console.log(`[roster] Merged org "${displayName}": ${mergedKeys.slice(1).join(', ')} merged into ${canonical.key}`);
    }

    return { vp: full.vp, orgs, visibleFields, primaryDisplayField, mergedKeyMap };
  }

  /**
   * Find an org by key, falling back to merged key lookup.
   */
  function findOrgByKey(roster, key) {
    const direct = roster.orgs.find(o => o.key === key);
    if (direct) return direct;
    const canonical = roster.mergedKeyMap?.[key];
    if (canonical) return roster.orgs.find(o => o.key === canonical);
    // Fall back to matching by displayName (org-teams uses display names as keys)
    const byDisplay = roster.orgs.find(o => o.displayName === key);
    if (byDisplay) return byDisplay;
    return null;
  }

  function dedupeMembers(members) {
    const seen = new Set();
    return members.filter(m => {
      const key = m.jiraDisplayName || m.name;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function buildJiraTrends() {
    const files = listStorageFiles('people');
    if (files.length === 0) return {};

    const roster = deriveRoster();

    const personLookup = {};
    for (const org of roster.orgs) {
      for (const [teamName, team] of Object.entries(org.teams)) {
        for (const member of team.members) {
          const name = member.jiraDisplayName || member.name;
          if (!personLookup[name]) {
            personLookup[name] = { orgKey: org.key, teamKey: `${org.key}::${teamName}` };
          }
        }
      }
    }

    const monthlyData = {};

    for (const file of files) {
      try {
        const data = readFromStorage(`people/${file}`);
        if (!data.resolved?.issues) continue;

        const personName = data.jiraDisplayName;
        const lookup = personLookup[personName];

        for (const issue of data.resolved.issues) {
          if (!issue.resolutionDate) continue;
          const monthKey = issue.resolutionDate.slice(0, 7);

          if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = {
              resolved: 0, points: 0, cycleTimes: [],
              byOrg: {}, byTeam: {}, byPerson: {}
            };
          }
          const bucket = monthlyData[monthKey];
          bucket.resolved++;
          bucket.points += issue.storyPoints || 0;
          if (issue.cycleTimeDays != null && issue.cycleTimeDays >= 0) {
            bucket.cycleTimes.push(issue.cycleTimeDays);
          }

          if (lookup) {
            if (!bucket.byOrg[lookup.orgKey]) {
              bucket.byOrg[lookup.orgKey] = { resolved: 0, points: 0, cycleTimes: [] };
            }
            bucket.byOrg[lookup.orgKey].resolved++;
            bucket.byOrg[lookup.orgKey].points += issue.storyPoints || 0;
            if (issue.cycleTimeDays != null && issue.cycleTimeDays >= 0) {
              bucket.byOrg[lookup.orgKey].cycleTimes.push(issue.cycleTimeDays);
            }

            if (!bucket.byTeam[lookup.teamKey]) {
              bucket.byTeam[lookup.teamKey] = { resolved: 0, points: 0, cycleTimes: [] };
            }
            bucket.byTeam[lookup.teamKey].resolved++;
            bucket.byTeam[lookup.teamKey].points += issue.storyPoints || 0;
            if (issue.cycleTimeDays != null && issue.cycleTimeDays >= 0) {
              bucket.byTeam[lookup.teamKey].cycleTimes.push(issue.cycleTimeDays);
            }
          }

          if (!bucket.byPerson[personName]) {
            bucket.byPerson[personName] = { resolved: 0, points: 0, cycleTimes: [] };
          }
          bucket.byPerson[personName].resolved++;
          bucket.byPerson[personName].points += issue.storyPoints || 0;
          if (issue.cycleTimeDays != null && issue.cycleTimeDays >= 0) {
            bucket.byPerson[personName].cycleTimes.push(issue.cycleTimeDays);
          }
        }
      } catch {
        // skip malformed files
      }
    }

    function avgCycleTime(times) {
      if (times.length === 0) return null;
      return +(times.reduce((a, b) => a + b, 0) / times.length).toFixed(1);
    }

    const result = {};
    for (const [month, data] of Object.entries(monthlyData)) {
      result[month] = {
        resolved: data.resolved,
        points: data.points,
        avgCycleTimeDays: avgCycleTime(data.cycleTimes),
        byOrg: {},
        byTeam: {},
        byPerson: {}
      };
      for (const [key, d] of Object.entries(data.byOrg)) {
        result[month].byOrg[key] = { resolved: d.resolved, points: d.points, avgCycleTimeDays: avgCycleTime(d.cycleTimes) };
      }
      for (const [key, d] of Object.entries(data.byTeam)) {
        result[month].byTeam[key] = { resolved: d.resolved, points: d.points, avgCycleTimeDays: avgCycleTime(d.cycleTimes) };
      }
      for (const [key, d] of Object.entries(data.byPerson)) {
        result[month].byPerson[key] = { resolved: d.resolved, points: d.points, avgCycleTimeDays: avgCycleTime(d.cycleTimes) };
      }
    }

    return result;
  }

  // ─── Routes: Unified Refresh ───

  /**
   * @openapi
   * /api/modules/team-tracker/refresh/status:
   *   get:
   *     tags: ['TT: Metrics']
   *     summary: Get refresh status
   *     responses:
   *       200:
   *         description: Current refresh state
   *       403:
   *         description: Forbidden — admin access required
   */
  router.get('/refresh/status', requireAdmin, function(req, res) {
    res.json(refreshState);
  });

  /**
   * @openapi
   * /api/modules/team-tracker/refresh:
   *   post:
   *     tags: ['TT: Metrics']
   *     summary: Trigger data refresh
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/RefreshRequest'
   *     responses:
   *       200:
   *         description: Refresh started or completed
   *       400:
   *         description: Invalid scope or missing parameters
   *       403:
   *         description: Forbidden
   *       404:
   *         description: Person or team not found
   *       409:
   *         description: Refresh already in progress
   *       500:
   *         description: Server error
   */
  router.post('/refresh', async function(req, res) {
    const { scope, name, teamKey, orgKey } = req.body || {};
    const force = req.body?.force === true;
    const sources = req.body?.sources || { jira: true, github: true, gitlab: true };

    if (!scope || !['person', 'team', 'org', 'all'].includes(scope)) {
      return res.status(400).json({ error: 'scope is required: person, team, org, or all' });
    }

    if (scope !== 'person' && !req.isAdmin) {
      return res.status(403).json({ error: 'Admin access required for team, org, and all refreshes' });
    }

    if (req.body?.force !== undefined && typeof req.body.force !== 'boolean') {
      return res.status(400).json({ error: 'force must be a boolean' });
    }

    if (req.body?.sources !== undefined) {
      if (typeof req.body.sources !== 'object' || Array.isArray(req.body.sources)) {
        return res.status(400).json({ error: 'sources must be an object with jira, github, gitlab boolean keys' });
      }
      const validKeys = ['jira', 'github', 'gitlab'];
      for (const key of Object.keys(req.body.sources)) {
        if (!validKeys.includes(key)) {
          return res.status(400).json({ error: `Invalid source key: "${key}". Valid keys: ${validKeys.join(', ')}` });
        }
        if (typeof req.body.sources[key] !== 'boolean') {
          return res.status(400).json({ error: `sources.${key} must be a boolean` });
        }
      }
    }

    if (scope !== 'person' && refreshState.running) {
      return res.status(409).json({
        error: 'Refresh already in progress',
        scope: refreshState.scope,
        progress: refreshState.progress
      });
    }

    const roster = deriveRoster();
    let members;

    if (scope === 'person') {
      let found = null;
      for (const org of roster.orgs) {
        for (const team of Object.values(org.teams)) {
          found = team.members.find(m => m.jiraDisplayName === name || m.name === name);
          if (found) break;
        }
        if (found) break;
      }
      if (!found) {
        return res.status(404).json({ error: `Person "${name}" not found in roster` });
      }
      members = [found];
    } else if (scope === 'team') {
      let team = null;
      const sepIdx = (teamKey || '').indexOf('::');
      if (sepIdx !== -1) {
        const oKey = teamKey.substring(0, sepIdx);
        const tName = teamKey.substring(sepIdx + 2);
        const org = findOrgByKey(roster, oKey);
        if (org) team = org.teams[tName];
      } else {
        for (const org of roster.orgs) {
          if (org.teams[teamKey]) { team = org.teams[teamKey]; break; }
        }
      }
      if (!team) {
        return res.status(404).json({ error: `Team "${teamKey}" not found in roster` });
      }
      members = dedupeMembers(team.members);
    } else if (scope === 'org') {
      const org = findOrgByKey(roster, orgKey);
      if (!org) {
        return res.status(404).json({ error: `Org "${orgKey}" not found in roster` });
      }
      const allMembers = [];
      for (const team of Object.values(org.teams)) {
        allMembers.push(...team.members);
      }
      members = dedupeMembers(allMembers);
    } else {
      const allMembers = [];
      for (const org of roster.orgs) {
        for (const team of Object.values(org.teams)) {
          allMembers.push(...team.members);
        }
      }
      members = dedupeMembers(allMembers);
    }

    const jiraProjectKeys = jiraSyncConfig.getProjectKeys(storage);

    async function refreshJiraMembers(memberList) {
      if (!sources.jira || DEMO_MODE) return;
      const CONCURRENCY = 3;
      let idx = 0;
      let completed = 0;

      async function nextJira() {
        if (idx >= memberList.length) return;
        const member = memberList[idx++];
        try {
          completed++;
          console.log(`[refresh] Jira: ${member.jiraDisplayName} (${completed}/${memberList.length})`);
          const existingData = force ? null : readFromStorage(`people/${sanitizeFilename(member.jiraDisplayName)}.json`);
          const metrics = await fetchPersonMetrics(jiraRequest, member.jiraDisplayName, {
            nameCache: jiraNameCache,
            existingData,
            email: member.email,
            projectKeys: jiraProjectKeys
          });
          if (metrics._resolvedName) delete metrics._resolvedName;
          writeToStorage(`people/${sanitizeFilename(member.jiraDisplayName)}.json`, metrics);
          if (refreshState.sources.jira) refreshState.sources.jira.completed++;
        } catch (err) {
          console.error(`[refresh] Jira failed for ${member.jiraDisplayName}:`, err.message);
          refreshState.progress.errors++;
        }
        return nextJira();
      }

      const workers = [];
      for (let w = 0; w < CONCURRENCY; w++) workers.push(nextJira());
      await Promise.all(workers);
      persistNameCache();
    }

    async function refreshGithubUsers(usernames) {
      if (!sources.github || usernames.length === 0) return;
      try {
        const existingCache = force ? {} : readGithubCache().users;
        const results = await fetchGithubData(usernames, {
          existingData: existingCache,
          ttlMs: force ? 0 : undefined
        });
        writeSinglePassResults(results, GITHUB_CACHE_PATH, GITHUB_HISTORY_CACHE_PATH);
        console.log(`[refresh] GitHub: ${Object.keys(results).length} users processed`);
      } catch (err) {
        console.error('[refresh] GitHub failed:', err.message);
        refreshState.progress.errors++;
      }
    }

    async function refreshGitlabUsers(usernames) {
      if (!sources.gitlab || usernames.length === 0) return;
      try {
        const syncConfig = rosterSyncConfig.loadConfig({ readFromStorage, writeToStorage }) || {};
        const gitlabInstances = syncConfig.gitlabInstances || [];
        const results = await fetchGitlabData(usernames, { gitlabInstances });
        writeSinglePassResults(results, GITLAB_CACHE_PATH, GITLAB_HISTORY_CACHE_PATH);
        console.log(`[refresh] GitLab: ${Object.keys(results).length} users processed`);
      } catch (err) {
        console.error('[refresh] GitLab failed:', err.message);
        refreshState.progress.errors++;
      }
    }

    const githubUsernames = [...new Set(members.filter(m => m.githubUsername).map(m => m.githubUsername))];
    const gitlabUsernames = [...new Set(members.filter(m => m.gitlabUsername).map(m => m.gitlabUsername))];

    if (scope === 'person') {
      try {
        const member = members[0];
        const result = { jira: null, github: null, gitlab: null };

        const promises = [];

        if (sources.jira && !DEMO_MODE) {
          promises.push((async () => {
            const existingData = force ? null : readFromStorage(`people/${sanitizeFilename(member.jiraDisplayName)}.json`);
            const metrics = await fetchPersonMetrics(jiraRequest, member.jiraDisplayName, {
              nameCache: jiraNameCache,
              existingData,
              email: member.email,
              projectKeys: jiraProjectKeys
            });
            if (metrics._resolvedName) {
              persistNameCache();
              delete metrics._resolvedName;
            }
            writeToStorage(`people/${sanitizeFilename(member.jiraDisplayName)}.json`, metrics);
            result.jira = metrics;
          })());
        }

        if (sources.github && member.githubUsername) {
          promises.push((async () => {
            const existingCache = force ? {} : readGithubCache().users;
            const ghResults = await fetchGithubData([member.githubUsername], {
              existingData: existingCache,
              ttlMs: force ? 0 : undefined
            });
            if (ghResults[member.githubUsername]) {
              writeSinglePassResults(ghResults, GITHUB_CACHE_PATH, GITHUB_HISTORY_CACHE_PATH);
              result.github = ghResults[member.githubUsername];
            }
          })());
        }

        if (sources.gitlab && member.gitlabUsername) {
          promises.push((async () => {
            const syncConfig = rosterSyncConfig.loadConfig({ readFromStorage, writeToStorage }) || {};
            const gitlabInstances = syncConfig.gitlabInstances || [];
            const glResults = await fetchGitlabData([member.gitlabUsername], { gitlabInstances });
            if (glResults[member.gitlabUsername]) {
              writeSinglePassResults(glResults, GITLAB_CACHE_PATH, GITLAB_HISTORY_CACHE_PATH);
              result.gitlab = glResults[member.gitlabUsername];
            }
          })());
        }

        await Promise.allSettled(promises);
        saveLastRefreshed();
        console.log(`[refresh] person "${member.jiraDisplayName}" complete`);
        return res.json(result);
      } catch (error) {
        console.error(`[refresh] person "${name}" error:`, error);
        return res.status(500).json({ error: error.message });
      }
    }

    // For team/org/all: background processing
    refreshState.running = true;
    refreshState.scope = scope;
    refreshState.startedAt = new Date().toISOString();
    refreshState.progress = { errors: 0 };
    refreshState.sources = {
      jira: sources.jira ? { status: 'pending', completed: 0, total: members.length } : { status: 'skipped' },
      github: sources.github ? { status: 'pending', completed: 0, total: githubUsernames.length } : { status: 'skipped' },
      gitlab: sources.gitlab ? { status: 'pending', completed: 0, total: gitlabUsernames.length } : { status: 'skipped' }
    };

    res.json({ status: 'started', memberCount: members.length });

    setImmediate(async () => {
      try {
        await Promise.allSettled([
          (async () => {
            if (!sources.jira) return;
            refreshState.sources.jira.status = 'running';
            try {
              await refreshJiraMembers(members);
              refreshState.sources.jira.status = 'done';
            } catch (err) {
              refreshState.sources.jira.status = 'error';
              console.error('[refresh] Jira source error:', err.message);
            }
          })(),
          (async () => {
            if (!sources.github || githubUsernames.length === 0) return;
            refreshState.sources.github.status = 'running';
            try {
              await refreshGithubUsers(githubUsernames);
              refreshState.sources.github.status = 'done';
            } catch (err) {
              refreshState.sources.github.status = 'error';
              console.error('[refresh] GitHub source error:', err.message);
            }
          })(),
          (async () => {
            if (!sources.gitlab || gitlabUsernames.length === 0) return;
            refreshState.sources.gitlab.status = 'running';
            try {
              await refreshGitlabUsers(gitlabUsernames);
              refreshState.sources.gitlab.status = 'done';
            } catch (err) {
              refreshState.sources.gitlab.status = 'error';
              console.error('[refresh] GitLab source error:', err.message);
            }
          })()
        ]);

        saveLastRefreshed();
        console.log(`[refresh] ${scope} complete (${members.length} members)`);
      } catch (err) {
        console.error(`[refresh] ${scope} error:`, err);
      } finally {
        refreshState.running = false;
      }
    });
  });

  // ─── Routes: Reader ───

  /**
   * @openapi
   * /api/modules/team-tracker/boards:
   *   get:
   *     tags: ['TT: Sprints']
   *     summary: List configured boards
   *     responses:
   *       200:
   *         description: Array of configured sprint boards
   */
  router.get('/boards', function(req, res) {
    try {
      const teamsData = readFromStorage('teams.json');
      if (!teamsData || !teamsData.teams) {
        return res.json({ boards: [], lastUpdated: null });
      }

      const boards = teamsData.teams
        .filter(t => t.enabled !== false)
        .map(t => ({
          id: t.teamId || t.boardId,
          boardId: t.boardId,
          name: t.boardName || t.displayName,
          displayName: t.displayName || t.boardName,
          sprintFilter: t.sprintFilter || undefined
        }));

      const boardsData = readFromStorage('boards.json');
      res.json({ boards, lastUpdated: boardsData?.lastUpdated || null });
    } catch (error) {
      console.error('Read boards error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @openapi
   * /api/modules/team-tracker/boards/{boardId}/sprints:
   *   get:
   *     tags: ['TT: Sprints']
   *     summary: Get sprints for a board
   *     parameters:
   *       - in: path
   *         name: boardId
   *         required: true
   *         schema:
   *           type: string
   *         description: The board ID
   *     responses:
   *       200:
   *         description: List of sprints for the board
   */
  router.get('/boards/:boardId/sprints', function(req, res) {
    try {
      const { boardId } = req.params;
      const data = readFromStorage(`sprints/team-${boardId}.json`)
        || readFromStorage(`sprints/board-${boardId}.json`);
      if (!data) {
        return res.json({ sprints: [] });
      }
      res.json(data);
    } catch (error) {
      console.error('Read sprints error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @openapi
   * /api/modules/team-tracker/boards/{boardId}/trend:
   *   get:
   *     tags: ['TT: Sprints']
   *     summary: Get sprint trend data for a board
   *     parameters:
   *       - in: path
   *         name: boardId
   *         required: true
   *         schema:
   *           type: string
   *         description: The board ID
   *     responses:
   *       200:
   *         description: Sprint trend data for the board
   */
  router.get('/boards/:boardId/trend', function(req, res) {
    try {
      const { boardId } = req.params;
      const sprintIndex = readFromStorage(`sprints/team-${boardId}.json`)
        || readFromStorage(`sprints/board-${boardId}.json`);
      if (!sprintIndex?.sprints?.length) {
        return res.json({ sprints: [] });
      }

      const trendData = [];
      for (const sprint of sprintIndex.sprints) {
        if (sprint.state !== 'closed') continue;
        const sprintData = readFromStorage(`sprints/${sprint.id}.json`);
        if (!sprintData?.metrics) continue;

        const byAssignee = {};
        if (sprintData.byAssignee) {
          for (const [name, data] of Object.entries(sprintData.byAssignee)) {
            byAssignee[name] = {
              pointsCompleted: data.pointsCompleted,
              issuesCompleted: data.issuesCompleted,
              pointsAssigned: data.pointsAssigned,
              completionRate: data.completionRate
            };
          }
        }

        trendData.push({
          sprintId: sprint.id,
          sprintName: sprint.name,
          startDate: sprint.startDate,
          endDate: sprint.endDate || sprint.completeDate,
          ...sprintData.metrics,
          byAssignee
        });
      }

      trendData.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
      res.json({ sprints: trendData });
    } catch (error) {
      console.error('Read board trend error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @openapi
   * /api/modules/team-tracker/sprints/{sprintId}:
   *   get:
   *     tags: ['TT: Sprints']
   *     summary: Get sprint detail
   *     parameters:
   *       - in: path
   *         name: sprintId
   *         required: true
   *         schema:
   *           type: string
   *         description: The sprint ID
   *     responses:
   *       200:
   *         description: Sprint detail data
   */
  router.get('/sprints/:sprintId', function(req, res) {
    try {
      const { sprintId } = req.params;
      const data = readFromStorage(`sprints/${sprintId}.json`);
      if (!data) {
        return res.status(404).json({
          error: 'Sprint data not found. Please refresh to fetch data from Jira.'
        });
      }
      res.json(data);
    } catch (error) {
      console.error('Read sprint data error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @openapi
   * /api/modules/team-tracker/teams:
   *   get:
   *     tags: ['TT: Sprints']
   *     summary: Get sprint board team config
   *     responses:
   *       200:
   *         description: Sprint board team configuration
   */
  router.get('/teams', function(req, res) {
    try {
      const data = readFromStorage('teams.json');
      if (!data) {
        return res.json({ teams: [] });
      }
      res.json(data);
    } catch (error) {
      console.error('Read teams error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @openapi
   * /api/modules/team-tracker/teams:
   *   post:
   *     tags: ['TT: Sprints']
   *     summary: Save sprint board team config
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *     responses:
   *       200:
   *         description: Team config saved
   *       403:
   *         description: Forbidden — admin access required
   */
  router.post('/teams', requireAdmin, function(req, res) {
    try {
      const { teams } = req.body;
      if (!teams || !Array.isArray(teams)) {
        return res.status(400).json({ error: 'Request must include "teams" array' });
      }
      writeToStorage('teams.json', { teams });
      res.json({ success: true, teams });
    } catch (error) {
      console.error('Save teams error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @openapi
   * /api/modules/team-tracker/dashboard-summary:
   *   get:
   *     tags: ['TT: Sprints']
   *     summary: Get dashboard summary across boards
   *     responses:
   *       200:
   *         description: Dashboard summary data
   */
  router.get('/dashboard-summary', function(req, res) {
    try {
      const data = readFromStorage('dashboard-summary.json');
      if (data) {
        return res.json(data);
      }

      const teamsData = readFromStorage('teams.json');
      const enabledTeams = teamsData?.teams?.filter(t => t.enabled !== false) || [];
      if (enabledTeams.length === 0) {
        return res.json({ lastUpdated: null, boards: {} });
      }

      const boardsData = readFromStorage('boards.json');
      const ROLLING_SPRINT_COUNT = 6;
      const summary = { lastUpdated: boardsData?.lastUpdated || null, boards: {} };

      for (const team of enabledTeams) {
        const teamId = team.teamId || String(team.boardId);
        const boardSprints = readFromStorage(`sprints/team-${teamId}.json`)
          || readFromStorage(`sprints/board-${team.boardId}.json`);
        if (!boardSprints?.sprints?.length) continue;

        const closedSprints = [...boardSprints.sprints]
          .filter(s => s.state === 'closed')
          .sort((a, b) => new Date(b.startDate) - new Date(a.startDate));

        if (closedSprints.length === 0) continue;

        const latestClosed = closedSprints[0];
        const recentSprints = closedSprints.slice(0, ROLLING_SPRINT_COUNT);

        let totalCommitted = 0;
        let totalDelivered = 0;
        let totalScopeChange = 0;
        let sprintsUsed = 0;

        for (const sprint of recentSprints) {
          const sd = readFromStorage(`sprints/${sprint.id}.json`);
          if (!sd) continue;
          totalCommitted += sd.committed?.totalPoints || 0;
          totalDelivered += sd.delivered?.totalPoints || 0;
          totalScopeChange += sd.metrics?.scopeChangeCount || 0;
          sprintsUsed++;
        }

        summary.boards[teamId] = {
          boardName: team.displayName || team.boardName,
          sprint: {
            id: latestClosed.id,
            name: latestClosed.name,
            state: latestClosed.state,
            startDate: latestClosed.startDate,
            endDate: latestClosed.endDate
          },
          metrics: {
            commitmentReliabilityPoints: totalCommitted > 0
              ? Math.round((totalDelivered / totalCommitted) * 100)
              : 0,
            avgVelocityPoints: sprintsUsed > 0 ? Math.round(totalDelivered / sprintsUsed) : 0,
            avgScopeChange: sprintsUsed > 0 ? +(totalScopeChange / sprintsUsed).toFixed(1) : 0,
            sprintsUsed
          }
        };
      }

      res.json(summary);
    } catch (error) {
      console.error('Read dashboard summary error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @openapi
   * /api/modules/team-tracker/trend:
   *   get:
   *     tags: ['TT: Sprints']
   *     summary: Get aggregate trend across boards
   *     parameters:
   *       - in: query
   *         name: boardIds
   *         schema:
   *           type: string
   *         description: Comma-separated board IDs to aggregate
   *     responses:
   *       200:
   *         description: Aggregated trend data
   */
  router.get('/trend', function(req, res) {
    try {
      const boardIds = (req.query.boardIds || '').split(',').filter(Boolean);
      if (boardIds.length === 0) {
        return res.json({ months: [] });
      }

      const allSprintData = [];
      for (const boardId of boardIds) {
        const sprintIndex = readFromStorage(`sprints/team-${boardId}.json`)
          || readFromStorage(`sprints/board-${boardId}.json`);
        if (!sprintIndex?.sprints?.length) continue;

        for (const sprint of sprintIndex.sprints) {
          if (sprint.state !== 'closed') continue;
          const sprintData = readFromStorage(`sprints/${sprint.id}.json`);
          if (!sprintData?.metrics) continue;
          allSprintData.push({
            endDate: sprint.endDate || sprint.completeDate,
            velocityPoints: sprintData.metrics.velocityPoints || 0,
            velocityCount: sprintData.metrics.velocityCount || 0,
            committedPoints: sprintData.committed?.totalPoints || 0,
            deliveredPoints: sprintData.delivered?.totalPoints || 0
          });
        }
      }

      const buckets = {};
      for (const sprint of allSprintData) {
        if (!sprint.endDate) continue;
        const date = new Date(sprint.endDate);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!buckets[key]) {
          buckets[key] = { month: key, velocityPoints: 0, velocityCount: 0, committedPoints: 0, deliveredPoints: 0, sprintCount: 0 };
        }
        const b = buckets[key];
        b.velocityPoints += sprint.velocityPoints;
        b.velocityCount += sprint.velocityCount;
        b.committedPoints += sprint.committedPoints;
        b.deliveredPoints += sprint.deliveredPoints;
        b.sprintCount += 1;
      }

      const months = Object.values(buckets).sort((a, b) => a.month.localeCompare(b.month));
      res.json({ months });
    } catch (error) {
      console.error('Read aggregate trend error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ─── Routes: Roster & Person Metrics ───

  /**
   * @openapi
   * /api/modules/team-tracker/last-refreshed:
   *   get:
   *     tags: ['TT: Metrics']
   *     summary: Get last refresh timestamp
   *     responses:
   *       200:
   *         description: Last refresh timestamp and config info
   */
  router.get('/last-refreshed', function(req, res) {
    const data = readFromStorage('last-refreshed.json');
    const jiraConfig = jiraSyncConfig.loadConfig(storage);
    res.json({
      timestamp: data?.timestamp || null,
      jiraConfigChangedAt: jiraConfig?.lastConfigChangedAt || null
    });
  });

  /**
   * @openapi
   * /api/modules/team-tracker/roster:
   *   get:
   *     tags: ['TT: Roster']
   *     summary: Get organization roster
   *     responses:
   *       200:
   *         description: Organization roster data
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/RosterResponse'
   */
  router.get('/roster', function(req, res) {
    try {
      const full = readRosterFull();
      if (!full) {
        return res.json({ orgs: [] });
      }
      const roster = deriveRoster();
      const { mergedKeyMap: _mergedKeyMap, ...rosterResponse } = roster;
      res.json(rosterResponse);
    } catch (error) {
      console.error('Read roster error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @openapi
   * /api/modules/team-tracker/people/metrics:
   *   get:
   *     tags: ['TT: Metrics']
   *     summary: Get bulk people metrics
   *     responses:
   *       200:
   *         description: Metrics for all people
   */
  router.get('/people/metrics', function(req, res) {
    try {
      const files = listStorageFiles('people');
      if (files.length === 0) return res.json({});

      const result = {};
      for (const file of files) {
        try {
          const data = readFromStorage(`people/${file}`);
          if (data.jiraDisplayName) {
            result[data.jiraDisplayName] = {
              resolvedCount: data.resolved?.count ?? 0,
              resolvedPoints: data.resolved?.storyPoints ?? 0,
              inProgressCount: data.inProgress?.count ?? 0,
              avgCycleTimeDays: data.cycleTime?.avgDays ?? null,
              fetchedAt: data.fetchedAt
            };
          }
        } catch {
          // skip malformed files
        }
      }
      res.json(result);
    } catch (error) {
      console.error('Read bulk people metrics error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @openapi
   * /api/modules/team-tracker/person/{jiraDisplayName}/metrics:
   *   get:
   *     tags: ['TT: Metrics']
   *     summary: Get person metrics
   *     parameters:
   *       - in: path
   *         name: jiraDisplayName
   *         required: true
   *         schema:
   *           type: string
   *         description: Jira display name of the person
   *     responses:
   *       200:
   *         description: Person metrics data
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/PersonMetrics'
   */
  router.get('/person/:jiraDisplayName/metrics', async function(req, res) {
    try {
      const name = decodeURIComponent(req.params.jiraDisplayName);
      const key = sanitizeFilename(name);
      const cachePath = `people/${key}.json`;

      const cached = readFromStorage(cachePath);
      if (cached) {
        // Enrich with jiraAccountId from name cache if not already present
        if (!cached.jiraAccountId && jiraNameCache[name]?.accountId) {
          cached.jiraAccountId = jiraNameCache[name].accountId;
        }
        return res.json(cached);
      }
      return res.status(404).json({ error: `No cached data for ${name}. Trigger a refresh to fetch data.` });
    } catch (error) {
      console.error(`Person metrics error (${req.params.jiraDisplayName}):`, error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @openapi
   * /api/modules/team-tracker/team/{teamKey}/metrics:
   *   get:
   *     tags: ['TT: Metrics']
   *     summary: Get team metrics
   *     parameters:
   *       - in: path
   *         name: teamKey
   *         required: true
   *         schema:
   *           type: string
   *         description: Team key (format orgKey::teamName)
   *     responses:
   *       200:
   *         description: Team metrics data
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/TeamMetrics'
   */
  router.get('/team/:teamKey/metrics', function(req, res) {
    try {
      const teamKey = decodeURIComponent(req.params.teamKey);
      const roster = deriveRoster();

      const sepIdx = teamKey.indexOf('::');
      let team = null;
      let orgKey = null;
      let teamName = null;

      if (sepIdx !== -1) {
        orgKey = teamKey.substring(0, sepIdx);
        teamName = teamKey.substring(sepIdx + 2);
        const org = findOrgByKey(roster, orgKey);
        if (org) team = org.teams[teamName];
      } else {
        for (const org of roster.orgs) {
          if (org.teams[teamKey]) {
            team = org.teams[teamKey];
            orgKey = org.key;
            teamName = teamKey;
            break;
          }
        }
      }

      if (!team) {
        return res.status(404).json({ error: `Team "${teamKey}" not found in roster` });
      }

      const seen = new Set();
      const uniqueMembers = team.members.filter(m => {
        if (seen.has(m.jiraDisplayName)) return false;
        seen.add(m.jiraDisplayName);
        return true;
      });

      let resolvedCount = 0;
      let resolvedPoints = 0;
      let inProgressCount = 0;
      let cycleTimesSum = 0;
      let cycleTimesCount = 0;
      const members = [];
      const resolvedIssues = [];

      for (const member of uniqueMembers) {
        const key = sanitizeFilename(member.jiraDisplayName);
        const cached = readFromStorage(`people/${key}.json`);
        const memberData = {
          name: member.name,
          jiraDisplayName: member.jiraDisplayName,
          specialty: member.specialty,
          metrics: null
        };

        if (cached) {
          memberData.metrics = {
            fetchedAt: cached.fetchedAt,
            resolvedCount: cached.resolved?.count || 0,
            resolvedPoints: cached.resolved?.storyPoints || 0,
            inProgressCount: cached.inProgress?.count || 0,
            avgCycleTimeDays: cached.cycleTime?.avgDays
          };
          resolvedCount += cached.resolved?.count || 0;
          resolvedPoints += cached.resolved?.storyPoints || 0;
          inProgressCount += cached.inProgress?.count || 0;
          if (cached.resolved?.issues) {
            for (const issue of cached.resolved.issues) {
              resolvedIssues.push({ ...issue, assignee: member.jiraDisplayName });
            }
          }
          if (cached.cycleTime?.avgDays != null) {
            cycleTimesSum += cached.cycleTime.avgDays;
            cycleTimesCount++;
          }
        }

        members.push(memberData);
      }

      res.json({
        teamKey,
        displayName: team.displayName,
        memberCount: uniqueMembers.length,
        aggregate: {
          resolvedCount,
          resolvedPoints,
          inProgressCount,
          avgCycleTimeDays: cycleTimesCount > 0 ? +(cycleTimesSum / cycleTimesCount).toFixed(1) : null
        },
        members,
        resolvedIssues
      });
    } catch (error) {
      console.error(`Team metrics error (${req.params.teamKey}):`, error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @openapi
   * /api/modules/team-tracker/jira-name-cache:
   *   delete:
   *     tags: ['TT: Admin']
   *     summary: Clear Jira name resolution cache
   *     responses:
   *       200:
   *         description: Cache cleared successfully
   *       403:
   *         description: Forbidden — admin access required
   */
  router.delete('/jira-name-cache', requireAdmin, function(req, res) {
    jiraNameCache = {};
    writeToStorage('jira-name-map.json', {});
    res.json({ success: true });
  });

  // ─── Routes: GitHub Contributions ───

  /**
   * @openapi
   * /api/modules/team-tracker/github/contributions:
   *   get:
   *     tags: ['TT: GitHub']
   *     summary: Get all GitHub contributions
   *     responses:
   *       200:
   *         description: GitHub contribution data for all users
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/GitHubContributions'
   */
  router.get('/github/contributions', function(req, res) {
    try {
      const cache = readGithubCache();
      res.json(cache);
    } catch (error) {
      console.error('Read GitHub contributions error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @openapi
   * /api/modules/team-tracker/github/contributions/{username}:
   *   get:
   *     tags: ['TT: GitHub']
   *     summary: Get GitHub contributions for a user
   *     parameters:
   *       - in: path
   *         name: username
   *         required: true
   *         schema:
   *           type: string
   *         description: GitHub username
   *     responses:
   *       200:
   *         description: GitHub contribution data for the user
   */
  router.get('/github/contributions/:username', function(req, res) {
    try {
      const username = decodeURIComponent(req.params.username);
      const cache = readGithubCache();
      const data = cache.users[username] || null;
      res.json(data);
    } catch (error) {
      console.error('Read GitHub contribution error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ─── Routes: GitLab Contributions ───

  /**
   * @openapi
   * /api/modules/team-tracker/gitlab/contributions:
   *   get:
   *     tags: ['TT: GitLab']
   *     summary: Get all GitLab contributions
   *     responses:
   *       200:
   *         description: GitLab contribution data for all users
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/GitLabContributions'
   */
  router.get('/gitlab/contributions', function(req, res) {
    try {
      const cache = readGitlabCache();
      res.json(cache);
    } catch (error) {
      console.error('Read GitLab contributions error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @openapi
   * /api/modules/team-tracker/gitlab/contributions/{username}:
   *   get:
   *     tags: ['TT: GitLab']
   *     summary: Get GitLab contributions for a user
   *     parameters:
   *       - in: path
   *         name: username
   *         required: true
   *         schema:
   *           type: string
   *         description: GitLab username
   *     responses:
   *       200:
   *         description: GitLab contribution data for the user
   */
  router.get('/gitlab/contributions/:username', function(req, res) {
    try {
      const username = decodeURIComponent(req.params.username);
      const cache = readGitlabCache();
      const data = cache.users[username] || null;
      res.json(data);
    } catch (error) {
      console.error('Read GitLab contribution error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ─── Routes: Trends ───

  /**
   * @openapi
   * /api/modules/team-tracker/trends:
   *   get:
   *     tags: ['TT: Trends']
   *     summary: Get Jira, GitHub, and GitLab trend data
   *     responses:
   *       200:
   *         description: Combined trend data from all sources
   */
  router.get('/trends', function(req, res) {
    try {
      const jira = buildJiraTrends();
      const github = readGithubHistoryCache();
      const gitlab = readGitlabHistoryCache();
      res.json({ jira, github, gitlab });
    } catch (error) {
      console.error('Trends error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ─── Routes: Annotations ───

  /**
   * @openapi
   * /api/modules/team-tracker/sprints/{sprintId}/annotations:
   *   get:
   *     tags: ['TT: Sprints']
   *     summary: Get sprint annotations
   *     parameters:
   *       - in: path
   *         name: sprintId
   *         required: true
   *         schema:
   *           type: string
   *         description: The sprint ID
   *     responses:
   *       200:
   *         description: Annotations for the sprint
   */
  router.get('/sprints/:sprintId/annotations', function(req, res) {
    try {
      const { sprintId } = req.params;
      const data = readFromStorage(`annotations/${sprintId}.json`);
      res.json(data || { annotations: {} });
    } catch (error) {
      console.error('Read annotations error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @openapi
   * /api/modules/team-tracker/sprints/{sprintId}/annotations:
   *   put:
   *     tags: ['TT: Sprints']
   *     summary: Add a sprint annotation
   *     parameters:
   *       - in: path
   *         name: sprintId
   *         required: true
   *         schema:
   *           type: string
   *         description: The sprint ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [assignee, text]
   *             properties:
   *               assignee:
   *                 type: string
   *               text:
   *                 type: string
   *     responses:
   *       200:
   *         description: Annotation created
   *       400:
   *         description: Missing assignee or text
   */
  router.put('/sprints/:sprintId/annotations', function(req, res) {
    try {
      const { sprintId } = req.params;
      const { assignee, text } = req.body;
      if (!assignee || !text) {
        return res.status(400).json({ error: 'assignee and text are required' });
      }

      const data = readFromStorage(`annotations/${sprintId}.json`) || { annotations: {} };
      if (!data.annotations[assignee]) {
        data.annotations[assignee] = [];
      }

      const annotation = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        text,
        author: req.userEmail,
        createdAt: new Date().toISOString()
      };

      data.annotations[assignee].push(annotation);
      writeToStorage(`annotations/${sprintId}.json`, data);
      res.json(annotation);
    } catch (error) {
      console.error('Save annotation error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @openapi
   * /api/modules/team-tracker/sprints/{sprintId}/annotations/{assignee}/{annotationId}:
   *   delete:
   *     tags: ['TT: Sprints']
   *     summary: Delete a sprint annotation
   *     parameters:
   *       - in: path
   *         name: sprintId
   *         required: true
   *         schema:
   *           type: string
   *         description: The sprint ID
   *       - in: path
   *         name: assignee
   *         required: true
   *         schema:
   *           type: string
   *         description: The assignee name
   *       - in: path
   *         name: annotationId
   *         required: true
   *         schema:
   *           type: string
   *         description: The annotation ID
   *     responses:
   *       200:
   *         description: Annotation deleted
   *       403:
   *         description: Forbidden — admin access required
   *       404:
   *         description: Annotation not found
   */
  router.delete('/sprints/:sprintId/annotations/:assignee/:annotationId', requireAdmin, function(req, res) {
    try {
      const { sprintId, assignee, annotationId } = req.params;
      const data = readFromStorage(`annotations/${sprintId}.json`);
      if (!data?.annotations?.[assignee]) {
        return res.status(404).json({ error: 'Annotation not found' });
      }

      const before = data.annotations[assignee].length;
      data.annotations[assignee] = data.annotations[assignee].filter(a => a.id !== annotationId);

      if (data.annotations[assignee].length === before) {
        return res.status(404).json({ error: 'Annotation not found' });
      }

      if (data.annotations[assignee].length === 0) {
        delete data.annotations[assignee];
      }

      writeToStorage(`annotations/${sprintId}.json`, data);
      res.json({ success: true });
    } catch (error) {
      console.error('Delete annotation error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ─── Routes: Roster Sync ───

  /**
   * @openapi
   * /api/modules/team-tracker/roster-sync/configured:
   *   get:
   *     tags: ['TT: Admin']
   *     summary: Check if roster sync is configured
   *     responses:
   *       200:
   *         description: Configuration status
   */
  router.get('/roster-sync/configured', function(req, res) {
    try {
      const config = rosterSyncConfig.loadConfig(storage);
      res.json({ configured: !!config });
    } catch (error) {
      console.error('Check roster-sync configured error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @openapi
   * /api/modules/team-tracker/sheets/discover:
   *   get:
   *     tags: ['TT: Admin']
   *     summary: Discover sheet names in a Google Spreadsheet
   *     parameters:
   *       - in: query
   *         name: spreadsheetId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: List of sheet names
   *       400:
   *         description: Invalid or missing spreadsheetId
   *       403:
   *         description: Forbidden — admin access required
   */
  router.get('/sheets/discover', requireAdmin, async function(req, res) {
    try {
      const { spreadsheetId } = req.query;

      if (!spreadsheetId || typeof spreadsheetId !== 'string' || !spreadsheetId.trim()) {
        return res.status(400).json({ error: 'spreadsheetId query parameter is required' });
      }

      // Google Sheet IDs are alphanumeric + hyphens/underscores, ~44 chars
      const SHEET_ID_RE = /^[a-zA-Z0-9_-]{10,100}$/;
      if (!SHEET_ID_RE.test(spreadsheetId.trim())) {
        return res.status(400).json({ error: 'Invalid spreadsheet ID format' });
      }

      const sheets = await sheetsModule.discoverSheetNames(spreadsheetId.trim());
      res.json({ sheets });
    } catch (error) {
      console.error('Discover sheets error:', error);
      res.status(500).json({ error: 'Could not access spreadsheet. Verify the ID and that the service account has read access.' });
    }
  });

  /**
   * @openapi
   * /api/modules/team-tracker/admin/roster-sync/field-definitions:
   *   get:
   *     tags: ['TT: Admin']
   *     summary: Get roster sync field definitions
   *     responses:
   *       200:
   *         description: Custom field definitions
   *       403:
   *         description: Forbidden — admin access required
   */
  router.get('/admin/roster-sync/field-definitions', requireAdmin, function(req, res) {
    try {
      const config = rosterSyncConfig.loadConfig(storage);
      res.json({ customFields: (config && config.customFields) || [] });
    } catch (error) {
      console.error('Read field definitions error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @openapi
   * /api/modules/team-tracker/admin/roster-sync/config:
   *   get:
   *     tags: ['TT: Admin']
   *     summary: Get roster sync configuration
   *     responses:
   *       200:
   *         description: Roster sync configuration
   *       403:
   *         description: Forbidden — admin access required
   */
  router.get('/admin/roster-sync/config', requireAdmin, function(req, res) {
    try {
      const config = rosterSyncConfig.loadConfig(storage);
      if (!config) {
        return res.json({ configured: false, excludedTitles: DEFAULT_EXCLUDED_TITLES });
      }
      const excludedTitles = config.excludedTitles?.length ? config.excludedTitles : DEFAULT_EXCLUDED_TITLES;
      res.json({ configured: true, ...config, excludedTitles });
    } catch (error) {
      console.error('Read roster-sync config error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @openapi
   * /api/modules/team-tracker/admin/roster-sync/config:
   *   post:
   *     tags: ['TT: Admin']
   *     summary: Save roster sync configuration
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *     responses:
   *       200:
   *         description: Configuration saved
   *       400:
   *         description: Invalid configuration
   *       403:
   *         description: Forbidden — admin access required
   */
  router.post('/admin/roster-sync/config', requireAdmin, function(req, res) {
    try {
      const { orgRoots, googleSheetId, sheetNames, githubOrgs, gitlabGroups, gitlabInstances, teamStructure, excludedTitles } = req.body;

      if (orgRoots !== undefined) {
        if (!Array.isArray(orgRoots) || orgRoots.length === 0) {
          return res.status(400).json({ error: 'At least one org root is required' });
        }
        for (const root of orgRoots) {
          if (!root.uid || !root.displayName) {
            return res.status(400).json({ error: 'Each org root must have uid and displayName' });
          }
        }
      }

      // Validate gitlabInstances
      const ENV_VAR_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
      if (gitlabInstances !== undefined) {
        if (!Array.isArray(gitlabInstances)) {
          return res.status(400).json({ error: 'gitlabInstances must be an array' });
        }
        for (const inst of gitlabInstances) {
          if (!inst.baseUrl || typeof inst.baseUrl !== 'string' || !inst.baseUrl.startsWith('https://')) {
            return res.status(400).json({ error: 'Each GitLab instance baseUrl must start with https://' });
          }
          if (!inst.label || typeof inst.label !== 'string') {
            return res.status(400).json({ error: 'Each GitLab instance must have a label' });
          }
          if (!inst.tokenEnvVar || typeof inst.tokenEnvVar !== 'string' || !ENV_VAR_RE.test(inst.tokenEnvVar)) {
            return res.status(400).json({ error: 'Each GitLab instance tokenEnvVar must be a valid env var name (alphanumeric + underscore)' });
          }
          if (!Array.isArray(inst.groups)) {
            return res.status(400).json({ error: 'Each GitLab instance groups must be an array' });
          }
        }
      }

      const PROTO_KEYS = new Set(['__proto__', 'constructor', 'prototype', 'toString', 'valueOf', 'hasOwnProperty']);
      let validatedTeamStructure = undefined;
      if (teamStructure !== undefined) {
        if (teamStructure === null) {
          validatedTeamStructure = null;
        } else {
          if (!teamStructure.nameColumn || typeof teamStructure.nameColumn !== 'string' || !teamStructure.nameColumn.trim()) {
            return res.status(400).json({ error: 'teamStructure.nameColumn is required' });
          }
          if (!teamStructure.teamGroupingColumn || typeof teamStructure.teamGroupingColumn !== 'string' || !teamStructure.teamGroupingColumn.trim()) {
            return res.status(400).json({ error: 'teamStructure.teamGroupingColumn is required' });
          }

          const validatedCustomFields = [];
          if (teamStructure.customFields && Array.isArray(teamStructure.customFields)) {
            if (teamStructure.customFields.length > 20) {
              return res.status(400).json({ error: 'Maximum of 20 custom fields allowed' });
            }

            const seenKeys = new Set();
            const seenLabels = new Set();
            let primaryCount = 0;

            for (const field of teamStructure.customFields) {
              if (!field.key || typeof field.key !== 'string') {
                return res.status(400).json({ error: 'Each custom field must have a "key"' });
              }
              const key = field.key.trim();
              if (!key) {
                return res.status(400).json({ error: 'Custom field key cannot be empty' });
              }
              if (PROTO_KEYS.has(key)) {
                return res.status(400).json({ error: `Reserved field key "${key}" is not allowed` });
              }
              if (RESERVED_KEYS.includes(key)) {
                return res.status(400).json({ error: `Reserved field key "${key}" is not allowed` });
              }
              if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(key)) {
                return res.status(400).json({ error: `Invalid field key "${key}" — use only letters, numbers, and underscores` });
              }
              if (seenKeys.has(key)) {
                return res.status(400).json({ error: `Duplicate field key "${key}"` });
              }
              seenKeys.add(key);

              const columnLabel = (field.columnLabel || '').trim();
              if (!columnLabel) {
                return res.status(400).json({ error: `Custom field "${key}" must have a "columnLabel"` });
              }
              if (seenLabels.has(columnLabel)) {
                return res.status(400).json({ error: `Duplicate column label "${columnLabel}"` });
              }
              seenLabels.add(columnLabel);

              if (field.primaryDisplay) primaryCount++;

              validatedCustomFields.push({
                key,
                columnLabel,
                displayLabel: (field.displayLabel || key).trim(),
                visible: !!field.visible,
                primaryDisplay: !!field.primaryDisplay
              });
            }

            if (primaryCount > 1) {
              return res.status(400).json({ error: 'At most one custom field can have primaryDisplay' });
            }
          }

          validatedTeamStructure = {
            nameColumn: teamStructure.nameColumn.trim(),
            teamGroupingColumn: teamStructure.teamGroupingColumn.trim(),
            customFields: validatedCustomFields
          };
        }
      }

      // Validate excludedTitles
      let validatedExcludedTitles = undefined;
      if (excludedTitles !== undefined) {
        if (!Array.isArray(excludedTitles)) {
          return res.status(400).json({ error: 'excludedTitles must be an array' });
        }
        if (excludedTitles.length > 20) {
          return res.status(400).json({ error: 'Maximum of 20 excluded titles allowed' });
        }
        const seen = new Set();
        validatedExcludedTitles = [];
        for (const title of excludedTitles) {
          if (typeof title !== 'string' || !title.trim()) {
            return res.status(400).json({ error: 'Each excluded title must be a non-empty string' });
          }
          const trimmed = title.trim().slice(0, 100);
          if (!seen.has(trimmed)) {
            seen.add(trimmed);
            validatedExcludedTitles.push(trimmed);
          }
        }
      }

      const existing = rosterSyncConfig.loadConfig(storage) || {};

      const config = {
        orgRoots: orgRoots !== undefined ? orgRoots : existing.orgRoots || [],
        googleSheetId: googleSheetId !== undefined ? (googleSheetId || null) : (existing.googleSheetId || null),
        sheetNames: sheetNames !== undefined ? (sheetNames || []) : (existing.sheetNames || []),
        githubOrgs: githubOrgs !== undefined ? (githubOrgs || []) : (existing.githubOrgs || []),
        gitlabGroups: gitlabGroups !== undefined ? (gitlabGroups || []) : (existing.gitlabGroups || []),
        gitlabInstances: gitlabInstances !== undefined ? (gitlabInstances || []) : (existing.gitlabInstances || []),
        teamStructure: validatedTeamStructure !== undefined ? validatedTeamStructure : (existing.teamStructure || null),
        excludedTitles: validatedExcludedTitles !== undefined ? validatedExcludedTitles : (existing.excludedTitles || []),
        customFields: existing.customFields || null,
        lastSyncAt: existing.lastSyncAt || null,
        lastSyncStatus: existing.lastSyncStatus || null,
        lastSyncError: existing.lastSyncError || null
      };

      if (config.teamStructure) {
        const fm = {};
        fm.name = config.teamStructure.nameColumn;
        fm.miroTeam = config.teamStructure.teamGroupingColumn;
        for (const f of (config.teamStructure.customFields || [])) {
          fm[f.key] = f.columnLabel;
        }
        config.fieldMapping = fm;
      } else if (existing.fieldMapping) {
        config.fieldMapping = existing.fieldMapping;
      }

      rosterSyncConfig.saveConfig(storage, config);

      if (!DEMO_MODE) {
        rosterSync.scheduleDaily(storage);
      }

      res.json({ configured: true, ...config });
    } catch (error) {
      console.error('Save roster-sync config error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @openapi
   * /api/modules/team-tracker/admin/roster-sync/custom-fields:
   *   post:
   *     tags: ['TT: Admin']
   *     summary: Save roster sync custom fields
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *     responses:
   *       200:
   *         description: Custom fields saved
   *       400:
   *         description: Invalid custom fields
   *       403:
   *         description: Forbidden — admin access required
   */
  router.post('/admin/roster-sync/custom-fields', requireAdmin, function(req, res) {
    try {
      const { customFields } = req.body;

      if (!Array.isArray(customFields)) {
        return res.status(400).json({ error: 'customFields must be an array' });
      }

      if (customFields.length > 20) {
        return res.status(400).json({ error: 'Maximum of 20 custom fields allowed' });
      }

      const PROTO_BLOCKLIST = new Set(['__proto__', 'constructor', 'prototype', 'toString', 'valueOf', 'hasOwnProperty']);
      const validatedFields = [];
      const seenKeys = new Set();
      const seenColumns = new Set();
      let hasNameField = false;

      for (const field of customFields) {
        if (!field.key || typeof field.key !== 'string') {
          return res.status(400).json({ error: 'Each custom field must have a "key"' });
        }
        if (!field.columnName || typeof field.columnName !== 'string') {
          return res.status(400).json({ error: `Custom field "${field.key}" must have a "columnName"` });
        }
        const key = field.key.trim();
        const columnName = field.columnName.trim();
        if (!key || !columnName) {
          return res.status(400).json({ error: 'Field key and column name cannot be empty' });
        }
        if (PROTO_BLOCKLIST.has(key) || RESERVED_KEYS.includes(key)) {
          return res.status(400).json({ error: `Reserved field key "${key}" is not allowed` });
        }
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
          return res.status(400).json({ error: `Invalid field key "${key}" — use only letters, numbers, and underscores` });
        }
        if (seenKeys.has(key)) {
          return res.status(400).json({ error: `Duplicate field key "${key}"` });
        }
        if (seenColumns.has(columnName)) {
          return res.status(400).json({ error: `Duplicate column name "${columnName}"` });
        }
        seenKeys.add(key);
        seenColumns.add(columnName);
        if (key === 'name') hasNameField = true;
        validatedFields.push({ key, columnName });
      }

      if (validatedFields.length > 0 && !hasNameField) {
        return res.status(400).json({ error: 'A "name" field is required for matching people from LDAP' });
      }

      const existing = rosterSyncConfig.loadConfig(storage) || {};
      existing.customFields = validatedFields.length > 0 ? validatedFields : null;
      rosterSyncConfig.saveConfig(storage, existing);

      res.json({ customFields: existing.customFields || [] });
    } catch (error) {
      console.error('Save custom fields error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @openapi
   * /api/modules/team-tracker/admin/roster-sync/trigger:
   *   post:
   *     tags: ['TT: Admin']
   *     summary: Trigger manual roster sync
   *     responses:
   *       200:
   *         description: Sync started or already running
   *       400:
   *         description: Roster sync not configured
   *       403:
   *         description: Forbidden — admin access required
   */
  router.post('/admin/roster-sync/trigger', requireAdmin, function(req, res) {
    try {
      if (rosterSync.isSyncInProgress()) {
        return res.json({ status: 'already_running' });
      }

      if (!rosterSyncConfig.isConfigured(storage)) {
        return res.status(400).json({ error: 'Roster sync is not configured' });
      }

      rosterSync.runSync(storage).then(function(result) {
        console.log('[roster-sync] On-demand sync result:', result.status);
      }).catch(function(err) {
        console.error('[roster-sync] On-demand sync error:', err);
      });

      res.json({ status: 'started' });
    } catch (error) {
      console.error('Trigger roster-sync error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @openapi
   * /api/modules/team-tracker/admin/roster-sync/status:
   *   get:
   *     tags: ['TT: Admin']
   *     summary: Get roster sync status
   *     responses:
   *       200:
   *         description: Current roster sync status
   *       403:
   *         description: Forbidden — admin access required
   */
  // Status handler — uses unifiedSyncState which is set after org-teams routes register
  router.get('/admin/roster-sync/status', requireAdmin, function(req, res) {
    try {
      const config = rosterSyncConfig.loadConfig(storage);
      const metadataSyncStatus = readFromStorage('org-roster/sync-status.json');
      const uState = unifiedSyncState;

      const syncing = uState.inProgress || rosterSync.isSyncInProgress();
      const now = Date.now();
      const rosterLastSync = config?.lastSyncAt ? new Date(config.lastSyncAt).getTime() : 0;
      const metadataLastSync = metadataSyncStatus?.lastSyncAt ? new Date(metadataSyncStatus.lastSyncAt).getTime() : 0;

      res.json({
        configured: rosterSyncConfig.isConfigured(storage),
        syncing,
        phase: uState.inProgress ? uState.currentPhase : null,
        phaseLabel: uState.inProgress ? uState.phaseLabel : null,
        phases: ['roster', 'metadata'],
        lastSyncAt: config ? config.lastSyncAt : null,
        lastSyncStatus: config ? config.lastSyncStatus : null,
        lastSyncError: config ? config.lastSyncError : null,
        rosterSync: {
          lastSyncAt: config?.lastSyncAt || null,
          lastSyncStatus: config?.lastSyncStatus || null,
          lastSyncError: config?.lastSyncError || null
        },
        metadataSync: {
          lastSyncAt: metadataSyncStatus?.lastSyncAt || null,
          status: metadataSyncStatus?.status || null,
          error: metadataSyncStatus?.error || null,
          teamCount: metadataSyncStatus?.teamCount || 0,
          componentCount: metadataSyncStatus?.componentCount || 0
        },
        stale: {
          roster: rosterLastSync > 0 ? (now - rosterLastSync) > STALENESS_THRESHOLD_MS : false,
          metadata: metadataLastSync > 0 ? (now - metadataLastSync) > STALENESS_THRESHOLD_MS : false
        }
      });
    } catch (error) {
      console.error('Roster-sync status error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ─── Routes: Jira Sync Admin ───

  /**
   * @openapi
   * /api/modules/team-tracker/admin/jira-sync/config:
   *   get:
   *     tags: ['TT: Admin']
   *     summary: Get Jira sync configuration
   *     responses:
   *       200:
   *         description: Jira sync configuration
   *       403:
   *         description: Forbidden — admin access required
   */
  router.get('/admin/jira-sync/config', requireAdmin, function(req, res) {
    try {
      const config = jiraSyncConfig.loadConfig(storage);
      res.json({ projectKeys: [], ...config });
    } catch (error) {
      console.error('Read jira-sync config error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @openapi
   * /api/modules/team-tracker/admin/jira-sync/config:
   *   post:
   *     tags: ['TT: Admin']
   *     summary: Save Jira sync configuration
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *     responses:
   *       200:
   *         description: Configuration saved
   *       400:
   *         description: Invalid configuration
   *       403:
   *         description: Forbidden — admin access required
   */
  router.post('/admin/jira-sync/config', requireAdmin, function(req, res) {
    try {
      const { projectKeys } = req.body;

      if (!Array.isArray(projectKeys)) {
        return res.status(400).json({ error: 'projectKeys must be an array' });
      }

      const cleaned = projectKeys
        .map(k => typeof k === 'string' ? k.trim().toUpperCase() : '')
        .filter(Boolean);

      if (cleaned.length > 50) {
        return res.status(400).json({ error: 'Too many project keys (max 50)' });
      }

      const validProjectKey = /^[A-Z][A-Z0-9_]{1,19}$/;
      for (const key of cleaned) {
        if (!validProjectKey.test(key)) {
          return res.status(400).json({ error: `Invalid project key format: "${key}". Keys must be 2-20 characters, start with a letter, and contain only uppercase letters, digits, and underscores.` });
        }
      }

      const existing = jiraSyncConfig.loadConfig(storage);
      const existingKeys = (existing?.projectKeys || []).sort().join(',');
      const newKeys = [...cleaned].sort().join(',');
      const keysChanged = existingKeys !== newKeys;

      const config = {
        projectKeys: cleaned,
        lastConfigChangedAt: keysChanged ? new Date().toISOString() : (existing?.lastConfigChangedAt || null)
      };

      jiraSyncConfig.saveConfig(storage, config);
      res.json(config);
    } catch (error) {
      console.error('Save jira-sync config error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ─── Routes: Snapshots ───

  function findTeamFromRoster(teamKey) {
    const roster = deriveRoster();
    const sepIdx = teamKey.indexOf('::');
    if (sepIdx !== -1) {
      const orgKey = teamKey.substring(0, sepIdx);
      const teamName = teamKey.substring(sepIdx + 2);
      const org = findOrgByKey(roster, orgKey);
      if (org && org.teams[teamName]) return org.teams[teamName];
    }
    return null;
  }

  function generateSnapshotsForTeam(teamKey) {
    const team = findTeamFromRoster(teamKey);
    if (!team) return [];

    const periods = [...snapshots.getCompletedPeriods()];
    const current = snapshots.getCurrentPeriod();
    if (current) periods.push(current);
    if (periods.length === 0) return [];

    const results = [];
    for (const period of periods) {
      const snapshot = snapshots.generateAndStoreSnapshot(storage, teamKey, team, period);
      results.push(snapshot);
    }
    return results;
  }

  function getOrGenerateTeamSnapshots(teamKey) {
    const existing = snapshots.loadTeamSnapshots(storage, teamKey);
    if (existing.length > 0) return existing;
    return generateSnapshotsForTeam(teamKey);
  }

  /**
   * @openapi
   * /api/modules/team-tracker/snapshots/{teamKey}:
   *   get:
   *     tags: ['TT: Snapshots']
   *     summary: Get team snapshots
   *     parameters:
   *       - in: path
   *         name: teamKey
   *         required: true
   *         schema:
   *           type: string
   *         description: Team key (format orgKey::teamName)
   *     responses:
   *       200:
   *         description: Array of team snapshots
   */
  router.get('/snapshots/:teamKey', function(req, res) {
    try {
      const teamKey = decodeURIComponent(req.params.teamKey);
      const data = getOrGenerateTeamSnapshots(teamKey);
      res.json({ snapshots: data });
    } catch (error) {
      console.error('Read team snapshots error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @openapi
   * /api/modules/team-tracker/snapshots/{teamKey}/{personName}:
   *   get:
   *     tags: ['TT: Snapshots']
   *     summary: Get person snapshots within a team
   *     parameters:
   *       - in: path
   *         name: teamKey
   *         required: true
   *         schema:
   *           type: string
   *         description: Team key (format orgKey::teamName)
   *       - in: path
   *         name: personName
   *         required: true
   *         schema:
   *           type: string
   *         description: Person name
   *     responses:
   *       200:
   *         description: Array of person snapshots
   */
  router.get('/snapshots/:teamKey/:personName', function(req, res) {
    try {
      const teamKey = decodeURIComponent(req.params.teamKey);
      const personName = decodeURIComponent(req.params.personName);
      const allSnapshots = getOrGenerateTeamSnapshots(teamKey);
      // Filter to person
      const personData = allSnapshots.map(s => ({
        periodStart: s.periodStart,
        periodEnd: s.periodEnd,
        generatedAt: s.generatedAt,
        metrics: s.members[personName] || null
      })).filter(s => s.metrics !== null);
      res.json({ snapshots: personData });
    } catch (error) {
      console.error('Read person snapshots error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @openapi
   * /api/modules/team-tracker/snapshots/generate:
   *   post:
   *     tags: ['TT: Snapshots']
   *     summary: Generate snapshots for all teams
   *     responses:
   *       200:
   *         description: Snapshot generation result
   *       403:
   *         description: Forbidden — admin access required
   */
  router.post('/snapshots/generate', requireAdmin, function(req, res) {
    try {
      const roster = deriveRoster();
      const completedPeriods = snapshots.getCompletedPeriods();
      const currentPeriod = snapshots.getCurrentPeriod();

      // Include completed periods + current period
      const periodsToSnapshot = [...completedPeriods];
      if (currentPeriod) periodsToSnapshot.push(currentPeriod);

      if (periodsToSnapshot.length === 0) {
        return res.json({ status: 'no_periods', message: 'No snapshot periods available yet (starts Jan 1, 2026)' });
      }

      let generated = 0;
      let skipped = 0;

      for (const org of roster.orgs) {
        for (const [teamName, team] of Object.entries(org.teams)) {
          const teamKey = `${org.key}::${teamName}`;
          for (const period of periodsToSnapshot) {
            const path = snapshots.snapshotPath(teamKey, period.end);
            const existing = readFromStorage(path);
            if (existing) {
              skipped++;
            } else {
              snapshots.generateAndStoreSnapshot(storage, teamKey, team, period);
              generated++;
            }
          }
        }
      }

      res.json({ status: 'complete', generated, skipped });
    } catch (error) {
      console.error('Generate snapshots error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @openapi
   * /api/modules/team-tracker/snapshots:
   *   delete:
   *     tags: ['TT: Snapshots']
   *     summary: Delete all snapshots
   *     responses:
   *       200:
   *         description: All snapshots deleted
   *       403:
   *         description: Forbidden — admin access required
   */
  router.delete('/snapshots', requireAdmin, function(req, res) {
    try {
      const result = deleteStorageDirectory('snapshots');
      res.json({ success: true, deleted: result.deleted });
    } catch (error) {
      console.error('Delete all snapshots error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ─── Diagnostics Hook ───

  if (context.registerDiagnostics) {
    context.registerDiagnostics(async function() {
      const jiraProjectKeys = jiraSyncConfig.getProjectKeys(storage);
      const syncConfig = rosterSyncConfig.loadConfig(storage) || {};
      const roster = readRosterFull();

      // Jira info
      const nameCacheEntries = Object.entries(jiraNameCache);
      const resolvedEntries = nameCacheEntries.filter(function(e) { return e[1]?.accountId });
      const unresolvedEntries = nameCacheEntries.filter(function(e) { return !e[1]?.accountId });
      const jira = {
        configured: !!(process.env.JIRA_TOKEN && process.env.JIRA_EMAIL),
        host: JIRA_HOST,
        emailSet: !!process.env.JIRA_EMAIL,
        tokenSet: !!process.env.JIRA_TOKEN,
        storyPointsField: 'customfield_10028',
        projectKeys: jiraProjectKeys,
        projectKeysFingerprint: jiraProjectKeys.sort().join(','),
        nameCache: {
          totalEntries: nameCacheEntries.length,
          resolvedCount: resolvedEntries.length,
          unresolvedCount: unresolvedEntries.length,
          unresolvedNames: unresolvedEntries.map(function(e) { return e[0] })
        }
      };

      // Roster sync info
      const rosterSyncInfo = {
        configured: rosterSyncConfig.isConfigured(storage),
        config: {
          orgRootCount: syncConfig.orgRoots?.length || 0,
          orgRootUids: (syncConfig.orgRoots || []).map(function(r) { return r.uid }),
          googleSheetId: syncConfig.googleSheetId || null,
          hasTeamStructure: !!(syncConfig.teamStructure),
          teamGroupingColumn: syncConfig.teamStructure?.teamGroupingColumn || null,
          customFieldCount: syncConfig.teamStructure?.customFields?.length || 0,
          githubOrgs: syncConfig.githubOrgs || [],
          gitlabGroups: syncConfig.gitlabGroups || [],
          gitlabInstances: (syncConfig.gitlabInstances || []).map(i => ({
            label: i.label,
            baseUrl: i.baseUrl,
            tokenEnvVar: i.tokenEnvVar,
            groupCount: (i.groups || []).length,
            excludeGroupCount: (i.excludeGroups || []).length
          }))
        },
        lastSyncAt: syncConfig.lastSyncAt || null,
        lastSyncStatus: syncConfig.lastSyncStatus || null,
        lastSyncError: syncConfig.lastSyncError || null,
        syncInProgress: rosterSync.isSyncInProgress()
      };

      // Roster data health
      const rosterInfo = { exists: false, orgCount: 0, totalPeople: 0, peopleByOrg: {} };
      if (roster && roster.orgs) {
        rosterInfo.exists = true;
        const orgKeys = Object.keys(roster.orgs);
        rosterInfo.orgCount = orgKeys.length;
        let missingGithub = 0, missingGitlab = 0, missingEmail = 0;
        for (const orgKey of orgKeys) {
          const org = roster.orgs[orgKey];
          const members = [org.leader, ...org.members].filter(Boolean);
          rosterInfo.peopleByOrg[orgKey] = members.length;
          rosterInfo.totalPeople += members.length;
          for (const m of members) {
            if (!m.githubUsername) missingGithub++;
            if (!m.gitlabUsername) missingGitlab++;
            if (!m.email) missingEmail++;
          }
        }
        rosterInfo.missingGithubUsernames = missingGithub;
        rosterInfo.missingGitlabUsernames = missingGitlab;
        rosterInfo.missingEmails = missingEmail;
      }

      // Data health: person metrics
      const personMetrics = { totalFiles: 0, recentlyUpdated: 0, staleFiles: 0, staleThresholdDays: 7 };
      try {
        const files = listStorageFiles('people');
        personMetrics.totalFiles = files.length;
        const now = Date.now();
        const staleMs = 7 * 24 * 60 * 60 * 1000;
        let oldestAt = null, newestAt = null;
        const nameNotFound = [];
        let fieldsVersionMismatch = 0;

        for (const file of files) {
          const data = readFromStorage('people/' + file);
          if (!data) continue;
          const fetchedAt = data.fetchedAt ? new Date(data.fetchedAt).getTime() : 0;
          if (fetchedAt && (now - fetchedAt) > staleMs) {
            personMetrics.staleFiles++;
          } else if (fetchedAt) {
            personMetrics.recentlyUpdated++;
          }
          if (!oldestAt || (fetchedAt && fetchedAt < oldestAt)) oldestAt = fetchedAt;
          if (!newestAt || (fetchedAt && fetchedAt > newestAt)) newestAt = fetchedAt;
          if (data.nameNotFound) nameNotFound.push(file.replace('.json', ''));
          if (data.fieldsVersion !== 'v1') fieldsVersionMismatch++;
        }

        personMetrics.oldestFetchedAt = oldestAt ? new Date(oldestAt).toISOString() : null;
        personMetrics.newestFetchedAt = newestAt ? new Date(newestAt).toISOString() : null;
        personMetrics.nameNotFoundCount = nameNotFound.length;
        personMetrics.nameNotFoundPeople = nameNotFound;
        personMetrics.fieldsVersionMismatch = fieldsVersionMismatch;
      } catch { /* ignore */ }

      // Data health: GitHub
      const githubCache = readGithubCache();
      const githubHistoryCache = readGithubHistoryCache();
      const github = {
        configured: !!process.env.GITHUB_TOKEN,
        cacheExists: !!(githubCache.fetchedAt),
        userCount: Object.keys(githubCache.users || {}).length,
        fetchedAt: githubCache.fetchedAt || null,
        historyExists: !!(githubHistoryCache.fetchedAt),
        historyUserCount: Object.keys(githubHistoryCache.users || {}).length,
        usersWithZeroContributions: Object.values(githubCache.users || {}).filter(function(u) { return (u.totalContributions || 0) === 0 }).length
      };

      // Data health: GitLab
      const gitlabCache = readGitlabCache();
      const gitlabHistoryCache = readGitlabHistoryCache();
      const gitlabInstancesConfigured = (syncConfig.gitlabInstances || []).some(i => !!process.env[i.tokenEnvVar]);
      const gitlab = {
        configured: gitlabInstancesConfigured || !!process.env.GITLAB_TOKEN,
        cacheExists: !!(gitlabCache.fetchedAt),
        userCount: Object.keys(gitlabCache.users || {}).length,
        fetchedAt: gitlabCache.fetchedAt || null,
        historyExists: !!(gitlabHistoryCache.fetchedAt),
        historyUserCount: Object.keys(gitlabHistoryCache.users || {}).length,
        usersWithZeroContributions: Object.values(gitlabCache.users || {}).filter(function(u) { return (u.totalContributions || 0) === 0 }).length
      };

      // Data health: snapshots
      const snapshotsInfo = { teamCount: 0, totalSnapshotFiles: 0, periodsCovered: [], teamsWithGaps: [] };
      try {
        const fs = require('fs');
        const path = require('path');
        const snapshotsDir = path.join(storage.DATA_DIR, 'snapshots');
        if (fs.existsSync(snapshotsDir)) {
          const dirs = fs.readdirSync(snapshotsDir).filter(function(d) {
            return fs.statSync(path.join(snapshotsDir, d)).isDirectory();
          });
          snapshotsInfo.teamCount = dirs.length;
          const allPeriods = new Set();
          for (const dir of dirs) {
            const files = fs.readdirSync(path.join(snapshotsDir, dir)).filter(function(f) { return f.endsWith('.json') });
            snapshotsInfo.totalSnapshotFiles += files.length;
            for (const f of files) allPeriods.add(f.replace('.json', ''));
          }
          snapshotsInfo.periodsCovered = [...allPeriods].sort();
        }
      } catch { /* ignore */ }

      // Last refreshed
      const lastRefreshed = readFromStorage('last-refreshed.json');

      return {
        jira,
        rosterSync: rosterSyncInfo,
        roster: rosterInfo,
        dataHealth: {
          personMetrics,
          github,
          gitlab,
          snapshots: snapshotsInfo,
          lastRefreshed: lastRefreshed?.timestamp || null
        },
        refreshState: { ...refreshState }
      };
    });
  }

  // ─── Absorbed routes from org-roster and team-data ───

  const registerIpaRegistryRoutes = require('./routes/ipa-registry');
  const { runIpaSync, isIpaSyncInProgress } = require('./routes/ipa-registry');
  const registerOrgTeamsRoutes = require('./routes/org-teams');
  const { isOrgSyncInProgress, getTriggerOrgSync } = require('./routes/org-teams');

  registerIpaRegistryRoutes(router, context);
  registerOrgTeamsRoutes(router, context);

  // ─── Unified Sync ───

  router.post('/admin/roster-sync/unified', requireAdmin, function(req, res) {
    if (DEMO_MODE) {
      return res.json({ status: 'skipped', message: 'Sync disabled in demo mode' });
    }

    if (unifiedSyncState.inProgress) {
      return res.status(409).json({ error: 'Unified sync already in progress' });
    }
    if (rosterSync.isSyncInProgress()) {
      return res.status(409).json({ error: 'Roster sync already in progress' });
    }
    if (isOrgSyncInProgress()) {
      return res.status(409).json({ error: 'Org metadata sync already in progress' });
    }
    if (isIpaSyncInProgress()) {
      return res.status(409).json({ error: 'IPA registry sync already in progress' });
    }

    unifiedSyncState.inProgress = true;
    unifiedSyncState.currentPhase = 'roster';
    unifiedSyncState.phaseLabel = 'Syncing people (LDAP + Sheets)...';
    res.json({ status: 'started' });

    (async function() {
      try {
        // Phase 1: Roster sync
        const rosterResult = await rosterSync.runSync(storage);
        if (rosterResult.status === 'skipped' || rosterResult.status === 'error') {
          console.warn('[unified-sync] Roster sync did not succeed:', rosterResult.status, rosterResult.error || '');
          return;
        }

        // Phase 2: Org metadata sync
        unifiedSyncState.currentPhase = 'metadata';
        unifiedSyncState.phaseLabel = 'Syncing team metadata...';

        if (isOrgSyncInProgress()) {
          console.warn('[unified-sync] Org sync became active between phases, skipping Phase 2');
          return;
        }

        const triggerOrgSync = getTriggerOrgSync();
        if (triggerOrgSync) {
          await triggerOrgSync();
        }

        // Phase 3: IPA registry sync
        unifiedSyncState.currentPhase = 'registry';
        unifiedSyncState.phaseLabel = 'Syncing people registry...';

        if (isIpaSyncInProgress()) {
          console.warn('[unified-sync] IPA sync became active between phases, skipping Phase 3');
        } else {
          // Sync IPA config from roster sync config (org roots + excluded titles)
          const ipaConfig = storage.readFromStorage('team-data/config.json') || {};
          const rosterConfig = rosterSyncConfig.loadConfig(storage);
          let ipaConfigChanged = false;

          if ((!ipaConfig.orgRoots || ipaConfig.orgRoots.length === 0) && rosterConfig?.orgRoots?.length > 0) {
            ipaConfig.orgRoots = rosterConfig.orgRoots;
            ipaConfigChanged = true;
          }
          const excludedTitles = rosterConfig?.excludedTitles?.length ? rosterConfig.excludedTitles : DEFAULT_EXCLUDED_TITLES;
          ipaConfig.excludedTitles = excludedTitles;
          ipaConfigChanged = true;
          if (ipaConfigChanged) {
            storage.writeToStorage('team-data/config.json', ipaConfig);
            console.log('[unified-sync] Synced IPA registry config from roster sync config');
          }
          await runIpaSync(storage);
        }
      } catch (err) {
        console.error('[unified-sync] Error:', err.message);
      } finally {
        unifiedSyncState.inProgress = false;
        unifiedSyncState.currentPhase = null;
        unifiedSyncState.phaseLabel = null;
      }
    })();
  });

  // ─── Startup: schedule roster sync ───

  if (!DEMO_MODE && rosterSyncConfig.isConfigured(storage)) {
    rosterSync.scheduleDaily(storage);
    console.log('Roster sync: daily schedule active');
  } else if (!DEMO_MODE) {
    console.log('Roster sync: not configured (visit Settings to set up)');
  }
};
