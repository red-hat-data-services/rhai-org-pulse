/**
 * IPA people registry routes for team-tracker.
 * Provides the people registry powered by IPA/LDAP with lifecycle
 * tracking, identity management, org tree views, and stats.
 */

const ipaClient = require('../../../../shared/server/roster-sync/ipa-client');
const { computeCoverage } = require('../../../../shared/server/roster-sync/lifecycle');
const { getAllPeople } = require('../../../../shared/server/roster');
const { loadConfig, getOrgDisplayNames } = require('../../../../shared/server/roster-sync/config');
const { runConsolidatedSync, isSyncInProgress: isConsolidatedSyncInProgress } = require('../../../../shared/server/roster-sync/consolidated-sync');

const { appendAuditEntry } = require('../../../../shared/server/audit-log');
const { mergePerson } = require('../../../../shared/server/roster-sync/lifecycle');

const REGISTRY_KEY = 'team-data/registry.json';
const SYNC_LOG_KEY = 'team-data/sync-log.json';
const TEAMS_KEY = 'team-data/teams.json';
const FIELD_DEFS_KEY = 'team-data/field-definitions.json';

function loadRegistry(storage) {
  return storage.readFromStorage(REGISTRY_KEY) || { meta: null, people: {} };
}

function loadSyncLog(storage) {
  return storage.readFromStorage(SYNC_LOG_KEY) || null;
}

function registerIpaRegistryRoutes(router, context) {
  var storage = context.storage;
  var requireAdmin = context.requireAdmin;
  var requireTeamAdmin = context.requireTeamAdmin;
  var requireScope = context.requireScope;
  var DEMO_MODE = process.env.DEMO_MODE === 'true';

  // Rate limiting state for LDAP search (per user, 5 req / 10s)
  var rateLimitMap = new Map();

  function getPeopleMap() {
    return loadRegistry(storage).people || {};
  }

  function writePeopleUpdate(uid, updater) {
    var reg = loadRegistry(storage);
    if (!reg.people || !Object.prototype.hasOwnProperty.call(reg.people, uid)) return null;
    updater(reg.people[uid]);
    storage.writeToStorage(REGISTRY_KEY, reg);
    return reg.people[uid];
  }

  // ─── IPA Config ───

  /**
   * @openapi
   * /api/modules/team-tracker/ipa/config:
   *   get:
   *     tags: ['OR: Config']
   *     summary: Get IPA/LDAP configuration and connection status
   *     responses:
   *       200:
   *         description: Config and IPA status
   */
  router.get('/ipa/config', requireAdmin, requireScope('roster:write'), function(req, res) {
    res.json({ config: loadConfig(storage), ipa: ipaClient.getIpaStatus() });
  });

  /**
   * @openapi
   * /api/modules/team-tracker/ipa/config:
   *   post:
   *     tags: ['OR: Config']
   *     summary: Update IPA/LDAP configuration
   *     responses:
   *       200:
   *         description: Saved config
   */
  router.post('/ipa/config', requireAdmin, requireScope('roster:write'), function(req, res) {
    var config = loadConfig(storage) || {};
    var body = req.body;
    if (body.orgRoots !== undefined) config.orgRoots = body.orgRoots;
    if (body.gracePeriodDays !== undefined) config.gracePeriodDays = body.gracePeriodDays;
    if (body.autoSync !== undefined) config.autoSync = body.autoSync;
    if (body.excludedTitles !== undefined) config.excludedTitles = body.excludedTitles;
    var rosterSyncConfig = require('../../../../shared/server/roster-sync/config');
    rosterSyncConfig.saveConfig(storage, config);
    res.json({ status: 'saved', config: config });
  });

  /**
   * @openapi
   * /api/modules/team-tracker/ipa/test:
   *   post:
   *     tags: ['OR: Sync']
   *     summary: Test IPA/LDAP connection
   *     responses:
   *       200:
   *         description: Connection test result
   */
  router.post('/ipa/test', requireAdmin, requireScope('roster:write'), function(req, res) {
    ipaClient.testConnection().then(function(result) {
      res.json(result);
    }).catch(function(err) {
      res.json({ ok: false, message: err.message });
    });
  });

  // ─── IPA Sync ───

  /**
   * @openapi
   * /api/modules/team-tracker/ipa/sync:
   *   post:
   *     tags: ['OR: Sync']
   *     summary: Trigger manual IPA/LDAP roster sync
   *     responses:
   *       200:
   *         description: Sync result
   */
  router.post('/ipa/sync', requireAdmin, requireScope('roster:write'), function(req, res) {
    if (DEMO_MODE) {
      return res.json({ status: 'skipped', message: 'Sync disabled in demo mode' });
    }
    runConsolidatedSync(storage).then(function(result) {
      res.json(result);
    }).catch(function(err) {
      res.status(500).json({ status: 'error', message: err.message });
    });
  });

  /**
   * @openapi
   * /api/modules/team-tracker/ipa/sync/status:
   *   get:
   *     tags: ['OR: Sync']
   *     summary: Get current sync status and last result
   *     responses:
   *       200:
   *         description: Sync status
   */
  router.get('/ipa/sync/status', requireScope('roster:read'), function(req, res) {
    var log = loadSyncLog(storage);
    res.json({ running: isConsolidatedSyncInProgress(), startedAt: null, lastResult: log });
  });

  // ─── People Registry ───

  /**
   * @openapi
   * /api/modules/team-tracker/registry/people:
   *   get:
   *     tags: ['OR: People']
   *     summary: List all people in the registry with optional filters
   *     responses:
   *       200:
   *         description: Filtered list of people
   */
  router.get('/registry/people', requireScope('roster:read'), function(req, res) {
    var people = getPeopleMap();
    var result = [];
    var uids = Object.keys(people);

    // Build team lookup — after consolidation, enrichment fields are directly
    // on registry people, so we can read them directly rather than going
    // through getAllPeople(). But we still use getAllPeople for backward compat.
    var orgDisplayNames = getOrgDisplayNames(storage);
    var rosterPeople = getAllPeople(storage);
    var teamsByUid = {};
    for (var r = 0; r < rosterPeople.length; r++) {
      var rp = rosterPeople[r];
      if (!rp.uid) continue;
      var grouping = rp._teamGrouping || rp.miroTeam || '';
      var teams = grouping.split(',').map(function(t) { return t.trim(); }).filter(Boolean);
      teamsByUid[rp.uid] = teams;
    }

    for (var i = 0; i < uids.length; i++) {
      var p = people[uids[i]];
      if (req.query.status && p.status !== req.query.status) continue;
      if (req.query.org && p.orgRoot !== req.query.org) continue;
      if (req.query.orgType && (p.orgType || 'engineering') !== req.query.orgType) continue;
      if (req.query.missingGithub === 'true' && p.github && p.github.username) continue;
      if (req.query.missingGitlab === 'true' && p.gitlab && p.gitlab.username) continue;
      if (req.query.search) {
        var term = req.query.search.toLowerCase();
        var searchable = [p.name, p.email, p.uid, p.github ? p.github.username : '', p.gitlab ? p.gitlab.username : ''].join(' ').toLowerCase();
        if (searchable.indexOf(term) === -1) continue;
      }
      var personOrgType = p.orgType || 'engineering';
      var entry = Object.assign({}, p, {
        orgType: personOrgType,
        orgDisplayName: orgDisplayNames[p.orgRoot] || (p.orgRoot === '_auxiliary' ? 'Non-Engineering' : p.orgRoot) || '',
        teams: teamsByUid[p.uid] || []
      });
      // For auxiliary people, include associated team names
      if (personOrgType === 'auxiliary') {
        entry.associatedTeamNames = getAssociatedTeamNames(p.uid);
      }
      result.push(entry);
    }
    res.json({ people: result, total: result.length });
  });

  /**
   * @openapi
   * /api/modules/team-tracker/registry/people/{uid}:
   *   get:
   *     tags: ['OR: People']
   *     summary: Get a single person by UID
   *     parameters:
   *       - in: path
   *         name: uid
   *         required: true
   *         schema:
   *           type: string
   *         description: The person's UID
   *     responses:
   *       200:
   *         description: Person detail with manager chain and direct reports
   *       404:
   *         description: Person not found
   */
  router.get('/registry/people/:uid', requireScope('roster:read'), function(req, res) {
    var people = getPeopleMap();
    var person = Object.prototype.hasOwnProperty.call(people, req.params.uid) ? people[req.params.uid] : undefined;
    // Fallback: if not found by UID key, try matching by name
    if (!person) {
      var uidsAll = Object.keys(people);
      for (var j = 0; j < uidsAll.length; j++) {
        var candidate = people[uidsAll[j]];
        if (candidate.name === req.params.uid) {
          person = candidate;
          break;
        }
      }
    }
    if (!person) return res.status(404).json({ error: 'Person not found' });

    var managerChain = [];
    var current = person;
    var visitedManagers = new Set();
    while (current && current.managerUid && managerChain.length < 20) {
      if (visitedManagers.has(current.managerUid)) break;
      visitedManagers.add(current.managerUid);
      var manager = people[current.managerUid];
      if (!manager) break;
      managerChain.push({ uid: manager.uid, name: manager.name, title: manager.title });
      current = manager;
    }

    var directReports = [];
    var uids = Object.keys(people);
    for (var i = 0; i < uids.length; i++) {
      var p = people[uids[i]];
      if (p.managerUid === req.params.uid && p.status === 'active') {
        directReports.push({ uid: p.uid, name: p.name, title: p.title, github: p.github, gitlab: p.gitlab });
      }
    }
    var personWithOrgType = Object.assign({}, person, { orgType: person.orgType || 'engineering' });
    var associatedTeams = getAssociatedTeams(person.uid || req.params.uid);
    res.json({ person: personWithOrgType, managerChain: managerChain, directReports: directReports, associatedTeams: associatedTeams });
  });

  // ─── Identity Overrides ───

  var VALID_USERNAME = /^[a-zA-Z0-9_.-]{1,39}$/;

  /**
   * @openapi
   * /api/modules/team-tracker/registry/people/{uid}/github:
   *   put:
   *     tags: ['OR: People']
   *     summary: Set GitHub username for a person
   *     parameters:
   *       - in: path
   *         name: uid
   *         required: true
   *         schema:
   *           type: string
   *         description: The person's UID
   *     responses:
   *       200:
   *         description: Updated GitHub identity
   *       404:
   *         description: Person not found
   */
  router.put('/registry/people/:uid/github', requireAdmin, requireScope('roster:write'), function(req, res) {
    var username = req.body.username;
    if (!username || typeof username !== 'string' || !username.trim()) return res.status(400).json({ error: 'Username is required' });
    if (!VALID_USERNAME.test(username.trim())) return res.status(400).json({ error: 'Invalid username format (1-39 chars, alphanumeric/dash/underscore/dot)' });
    var updated = writePeopleUpdate(req.params.uid, function(p) { p.github = { username: username.trim(), source: 'manual' }; });
    if (!updated) return res.status(404).json({ error: 'Person not found' });
    res.json({ status: 'updated', github: updated.github });
  });

  /**
   * @openapi
   * /api/modules/team-tracker/registry/people/{uid}/gitlab:
   *   put:
   *     tags: ['OR: People']
   *     summary: Set GitLab username for a person
   *     parameters:
   *       - in: path
   *         name: uid
   *         required: true
   *         schema:
   *           type: string
   *         description: The person's UID
   *     responses:
   *       200:
   *         description: Updated GitLab identity
   *       404:
   *         description: Person not found
   */
  router.put('/registry/people/:uid/gitlab', requireAdmin, requireScope('roster:write'), function(req, res) {
    var username = req.body.username;
    if (!username || typeof username !== 'string' || !username.trim()) return res.status(400).json({ error: 'Username is required' });
    if (!VALID_USERNAME.test(username.trim())) return res.status(400).json({ error: 'Invalid username format (1-39 chars, alphanumeric/dash/underscore/dot)' });
    var updated = writePeopleUpdate(req.params.uid, function(p) { p.gitlab = { username: username.trim(), source: 'manual' }; });
    if (!updated) return res.status(404).json({ error: 'Person not found' });
    res.json({ status: 'updated', gitlab: updated.gitlab });
  });

  /**
   * @openapi
   * /api/modules/team-tracker/registry/people/{uid}/github:
   *   delete:
   *     tags: ['OR: People']
   *     summary: Remove GitHub username from a person
   *     parameters:
   *       - in: path
   *         name: uid
   *         required: true
   *         schema:
   *           type: string
   *         description: The person's UID
   *     responses:
   *       200:
   *         description: GitHub identity removed
   *       404:
   *         description: Person not found
   */
  router.delete('/registry/people/:uid/github', requireAdmin, requireScope('roster:write'), function(req, res) {
    var updated = writePeopleUpdate(req.params.uid, function(p) { p.github = null; });
    if (!updated) return res.status(404).json({ error: 'Person not found' });
    res.json({ status: 'removed' });
  });

  /**
   * @openapi
   * /api/modules/team-tracker/registry/people/{uid}/gitlab:
   *   delete:
   *     tags: ['OR: People']
   *     summary: Remove GitLab username from a person
   *     parameters:
   *       - in: path
   *         name: uid
   *         required: true
   *         schema:
   *           type: string
   *         description: The person's UID
   *     responses:
   *       200:
   *         description: GitLab identity removed
   *       404:
   *         description: Person not found
   */
  router.delete('/registry/people/:uid/gitlab', requireAdmin, requireScope('roster:write'), function(req, res) {
    var updated = writePeopleUpdate(req.params.uid, function(p) { p.gitlab = null; });
    if (!updated) return res.status(404).json({ error: 'Person not found' });
    res.json({ status: 'removed' });
  });

  // ─── Lifecycle ───

  /**
   * @openapi
   * /api/modules/team-tracker/registry/people/{uid}/reactivate:
   *   post:
   *     tags: ['OR: People']
   *     summary: Reactivate an inactive person
   *     parameters:
   *       - in: path
   *         name: uid
   *         required: true
   *         schema:
   *           type: string
   *         description: The person's UID
   *     responses:
   *       200:
   *         description: Person reactivated
   *       404:
   *         description: Person not found
   */
  router.post('/registry/people/:uid/reactivate', requireAdmin, requireScope('roster:write'), function(req, res) {
    var updated = writePeopleUpdate(req.params.uid, function(p) { p.status = 'active'; p.inactiveSince = null; });
    if (!updated) return res.status(404).json({ error: 'Person not found' });
    res.json({ status: 'reactivated', person: updated });
  });

  /**
   * @openapi
   * /api/modules/team-tracker/registry/people/{uid}:
   *   delete:
   *     tags: ['OR: People']
   *     summary: Permanently purge a person from the registry
   *     parameters:
   *       - in: path
   *         name: uid
   *         required: true
   *         schema:
   *           type: string
   *         description: The person's UID
   *     responses:
   *       200:
   *         description: Person purged
   *       404:
   *         description: Person not found
   */
  router.delete('/registry/people/:uid', requireAdmin, requireScope('roster:write'), function(req, res) {
    var reg = loadRegistry(storage);
    if (!reg.people || !Object.prototype.hasOwnProperty.call(reg.people, req.params.uid)) return res.status(404).json({ error: 'Person not found' });
    delete reg.people[req.params.uid];
    storage.writeToStorage(REGISTRY_KEY, reg);
    res.json({ status: 'purged' });
  });

  // ─── Org Trees ───

  /**
   * @openapi
   * /api/modules/team-tracker/registry/orgs:
   *   get:
   *     tags: ['OR: People']
   *     summary: Get org trees rooted at configured org roots
   *     responses:
   *       200:
   *         description: Org tree hierarchy
   */
  router.get('/registry/orgs', requireScope('roster:read'), function(req, res) {
    var reg = loadRegistry(storage);
    var people = reg.people || {};
    var meta = reg.meta || {};
    var orgRoots = meta.orgRoots || [];

    function buildSubtree(uid) {
      var person = people[uid];
      if (!person) return null;
      var children = [];
      var uids = Object.keys(people);
      for (var i = 0; i < uids.length; i++) {
        var p = people[uids[i]];
        if (p.managerUid === uid && p.status === 'active') children.push(buildSubtree(p.uid));
      }
      var teamSize = children.reduce(function(sum, c) { return sum + (c ? c.teamSize : 0); }, 0) + children.length;
      return { uid: person.uid, name: person.name, title: person.title, github: person.github, gitlab: person.gitlab, teamSize: teamSize, children: children.filter(Boolean) };
    }

    var trees = [];
    for (var i = 0; i < orgRoots.length; i++) {
      var tree = buildSubtree(orgRoots[i]);
      if (tree) trees.push(tree);
    }
    res.json({ vp: meta.vp, trees: trees });
  });

  // ─── Stats ───

  /**
   * @openapi
   * /api/modules/team-tracker/registry/stats:
   *   get:
   *     tags: ['OR: People']
   *     summary: Get registry statistics and identity coverage
   *     responses:
   *       200:
   *         description: Registry stats including counts, coverage, and breakdowns
   */
  router.get('/registry/stats', requireScope('roster:read'), function(req, res) {
    var people = getPeopleMap();
    var uids = Object.keys(people);
    var active = 0, inactive = 0, auxiliaryCount = 0, byOrg = {}, byGeo = {};
    var byOrgType = { engineering: 0, auxiliary: 0 };
    for (var i = 0; i < uids.length; i++) {
      var p = people[uids[i]];
      var pOrgType = p.orgType || 'engineering';
      if (p.status === 'active') {
        if (pOrgType === 'auxiliary') {
          auxiliaryCount++;
          byOrgType.auxiliary++;
        } else {
          active++;
          byOrgType.engineering++;
        }
        var org = p.orgRoot || 'unknown';
        if (!byOrg[org]) byOrg[org] = { total: 0, github: 0, gitlab: 0 };
        byOrg[org].total++;
        if (p.github && p.github.username) byOrg[org].github++;
        if (p.gitlab && p.gitlab.username) byOrg[org].gitlab++;
        var geo = p.geo || 'Unknown';
        byGeo[geo] = (byGeo[geo] || 0) + 1;
      } else { inactive++; }
    }
    var orgDisplayNames = getOrgDisplayNames(storage);
    orgDisplayNames['_auxiliary'] = 'Non-Engineering';

    res.json({ total: uids.length, active: active, inactive: inactive, auxiliaryCount: auxiliaryCount, byOrgType: byOrgType, coverage: computeCoverage(people), byOrg: byOrg, byGeo: byGeo, orgDisplayNames: orgDisplayNames });
  });

  // ─── Helpers for person-reference association ───

  function getPersonRefFieldIds() {
    var fieldDefs = storage.readFromStorage(FIELD_DEFS_KEY);
    if (!fieldDefs || !fieldDefs.teamFields) return [];
    return fieldDefs.teamFields
      .filter(function(f) { return f.type === 'person-reference-linked' && !f.deleted; })
      .map(function(f) { return { id: f.id, label: f.label }; });
  }

  function getAssociatedTeams(uid) {
    var refFields = getPersonRefFieldIds();
    if (refFields.length === 0) return [];
    var teamsData = storage.readFromStorage(TEAMS_KEY);
    if (!teamsData || !teamsData.teams) return [];
    var results = [];
    var teamIds = Object.keys(teamsData.teams);
    for (var ti = 0; ti < teamIds.length; ti++) {
      var team = teamsData.teams[teamIds[ti]];
      var meta = team.metadata || {};
      for (var fi = 0; fi < refFields.length; fi++) {
        var raw = meta[refFields[fi].id];
        if (!raw) continue;
        var vals = Array.isArray(raw) ? raw : [raw];
        if (vals.indexOf(uid) !== -1) {
          results.push({
            teamId: team.id,
            teamName: team.name,
            orgKey: team.orgKey,
            fieldId: refFields[fi].id,
            fieldLabel: refFields[fi].label
          });
        }
      }
    }
    return results;
  }

  function getAssociatedTeamNames(uid) {
    var assoc = getAssociatedTeams(uid);
    var names = [];
    var seen = {};
    for (var i = 0; i < assoc.length; i++) {
      if (!seen[assoc[i].teamName]) {
        names.push(assoc[i].teamName);
        seen[assoc[i].teamName] = true;
      }
    }
    return names;
  }

  // ─── LDAP Search ───

  /**
   * @openapi
   * /api/modules/team-tracker/registry/people/search/ldap:
   *   get:
   *     tags: ['OR: People']
   *     summary: Search LDAP for people by name, UID, or email
   *     responses:
   *       200:
   *         description: Search results with registry status
   *       429:
   *         description: Rate limit exceeded
   *       503:
   *         description: LDAP not available
   */
  router.get('/registry/people/search/ldap', requireScope('team-tracker:read'), function(req, res) {
    if (DEMO_MODE) {
      return res.status(503).json({ error: 'LDAP not available in demo mode', code: 'LDAP_UNAVAILABLE' });
    }

    if (!process.env.IPA_BIND_DN || !process.env.IPA_BIND_PASSWORD) {
      return res.status(503).json({ error: 'LDAP not configured', code: 'LDAP_UNAVAILABLE' });
    }

    // Rate limiting
    var userEmail = req.userEmail || 'anonymous';
    var now = Date.now();
    // Prune old entries
    rateLimitMap.forEach(function(timestamps, key) {
      var filtered = timestamps.filter(function(t) { return now - t < 10000; });
      if (filtered.length === 0) rateLimitMap.delete(key);
      else rateLimitMap.set(key, filtered);
    });
    var userTimestamps = rateLimitMap.get(userEmail) || [];
    userTimestamps = userTimestamps.filter(function(t) { return now - t < 10000; });
    if (userTimestamps.length >= 5) {
      res.set('Retry-After', '10');
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }
    userTimestamps.push(now);
    rateLimitMap.set(userEmail, userTimestamps);

    var query = req.query.q;
    var limit = Math.min(parseInt(req.query.limit) || 10, 50);
    if (!query || query.trim().length < 2) {
      return res.json({ results: [] });
    }

    var conn;
    var timeout = setTimeout(function() {
      if (conn && conn.client) {
        conn.client.unbind(function() {});
        conn = null;
      }
      if (!res.headersSent) {
        res.status(504).json({ error: 'LDAP connection timeout' });
      }
    }, 5000);

    (async function() {
      try {
        conn = ipaClient.createClient();
        await ipaClient.bindClient(conn.client, conn.config.bindDn, conn.config.bindPassword);
        var results = await ipaClient.searchPeople(conn.client, conn.config.baseDn, query, limit);

        clearTimeout(timeout);
        if (res.headersSent) return;

        var people = getPeopleMap();
        var enriched = results.map(function(p) {
          var existing = people[p.uid];
          return Object.assign({}, p, {
            inRegistry: !!existing,
            registryStatus: existing ? existing.status : null
          });
        });
        res.json({ results: enriched });
      } catch (err) {
        clearTimeout(timeout);
        console.error('[ipa-registry] LDAP search error:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'LDAP search failed' });
        }
      } finally {
        if (conn && conn.client) {
          conn.client.unbind(function() {});
        }
      }
    })();
  });

  // ─── LDAP Import ───

  /**
   * @openapi
   * /api/modules/team-tracker/registry/people/ldap-import:
   *   post:
   *     tags: ['OR: People']
   *     summary: Import an auxiliary person from LDAP into the registry
   *     responses:
   *       200:
   *         description: Imported person (or existing if already present)
   *       404:
   *         description: Person not found in LDAP
   *       503:
   *         description: LDAP not available
   */
  router.post('/registry/people/ldap-import', requireTeamAdmin, requireScope('team-tracker:write'), function(req, res) {
    if (DEMO_MODE) {
      return res.status(503).json({ error: 'LDAP not available in demo mode', code: 'LDAP_UNAVAILABLE' });
    }

    if (!process.env.IPA_BIND_DN || !process.env.IPA_BIND_PASSWORD) {
      return res.status(503).json({ error: 'LDAP not configured', code: 'LDAP_UNAVAILABLE' });
    }

    var uid = req.body && req.body.uid;
    if (!uid || typeof uid !== 'string' || !uid.trim()) {
      return res.status(400).json({ error: 'uid is required' });
    }
    uid = uid.trim();
    if (!/^[a-zA-Z0-9._-]+$/.test(uid)) {
      return res.status(400).json({ error: 'Invalid uid format' });
    }

    // Check if already in registry
    var reg = loadRegistry(storage);
    if (reg.people && reg.people[uid]) {
      return res.json({ person: reg.people[uid], created: false });
    }

    var conn;
    var timeout = setTimeout(function() {
      if (conn && conn.client) {
        conn.client.unbind(function() {});
        conn = null;
      }
      if (!res.headersSent) {
        res.status(504).json({ error: 'LDAP connection timeout' });
      }
    }, 5000);

    (async function() {
      try {
        conn = ipaClient.createClient();
        await ipaClient.bindClient(conn.client, conn.config.bindDn, conn.config.bindPassword);
        var ldapPerson = await ipaClient.lookupPerson(conn.client, conn.config.baseDn, uid);

        clearTimeout(timeout);
        if (res.headersSent) return;

        if (!ldapPerson) {
          return res.status(404).json({ error: 'Person not found in LDAP' });
        }

        // Create auxiliary entry
        var now = new Date().toISOString();
        var result = mergePerson(null, ldapPerson, '_auxiliary', now);
        result.person.orgType = 'auxiliary';
        reg.people[uid] = result.person;

        // Walk manager chain
        var lookupCache = {};
        lookupCache[uid] = ldapPerson;
        var current = result.person;
        var depth = 0;
        while (current && current.managerUid && depth < 20) {
          var mgrUid = current.managerUid;
          if (reg.people[mgrUid]) break;

          var mgrPerson = lookupCache[mgrUid];
          if (!mgrPerson) {
            mgrPerson = await ipaClient.lookupPerson(conn.client, conn.config.baseDn, mgrUid);
            lookupCache[mgrUid] = mgrPerson;
          }
          if (!mgrPerson) break;

          var mgrResult = mergePerson(null, mgrPerson, '_auxiliary', now);
          mgrResult.person.orgType = 'auxiliary';
          reg.people[mgrUid] = mgrResult.person;
          current = mgrResult.person;
          depth++;
        }

        storage.writeToStorage(REGISTRY_KEY, reg);

        // Audit log
        var actorEmail = req.auditActor || req.userEmail || 'unknown';
        appendAuditEntry(storage, {
          action: 'person.ldap-import',
          actor: actorEmail,
          entityType: 'person',
          entityId: uid,
          detail: 'Imported auxiliary person from LDAP'
        });

        res.json({ person: reg.people[uid], created: true });
      } catch (err) {
        clearTimeout(timeout);
        console.error('[ipa-registry] LDAP import error:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'LDAP import failed' });
        }
      } finally {
        if (conn && conn.client) {
          conn.client.unbind(function() {});
        }
      }
    })();
  });

  // ─── Auto-sync scheduling ───

  var autoSyncTimer = null;
  function scheduleAutoSync(config) {
    if (autoSyncTimer) { clearInterval(autoSyncTimer); autoSyncTimer = null; }
    if (!config.autoSync || !config.autoSync.enabled) return;
    var intervalMs = (config.autoSync.intervalHours || 24) * 60 * 60 * 1000;
    autoSyncTimer = setInterval(function() {
      console.log('[team-tracker/ipa] Running scheduled auto-sync...');
      runConsolidatedSync(storage).catch(function(err) { console.error('[team-tracker/ipa] Auto-sync error:', err); });
    }, intervalMs);
    if (autoSyncTimer.unref) autoSyncTimer.unref();
  }

  if (!DEMO_MODE) {
    scheduleAutoSync(loadConfig(storage) || {});
  }
}

module.exports = registerIpaRegistryRoutes;
module.exports.runConsolidatedSync = runConsolidatedSync;
module.exports.isIpaSyncInProgress = isConsolidatedSyncInProgress;
