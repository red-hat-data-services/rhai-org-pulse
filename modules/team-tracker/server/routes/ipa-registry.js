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

const REGISTRY_KEY = 'team-data/registry.json';
const SYNC_LOG_KEY = 'team-data/sync-log.json';

function loadRegistry(storage) {
  return storage.readFromStorage(REGISTRY_KEY) || { meta: null, people: {} };
}

function loadSyncLog(storage) {
  return storage.readFromStorage(SYNC_LOG_KEY) || null;
}

function registerIpaRegistryRoutes(router, context) {
  var storage = context.storage;
  var requireAdmin = context.requireAdmin;
  var DEMO_MODE = process.env.DEMO_MODE === 'true';

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

  router.get('/ipa/config', requireAdmin, function(req, res) {
    res.json({ config: loadConfig(storage), ipa: ipaClient.getIpaStatus() });
  });

  router.post('/ipa/config', requireAdmin, function(req, res) {
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

  router.post('/ipa/test', requireAdmin, function(req, res) {
    ipaClient.testConnection().then(function(result) {
      res.json(result);
    }).catch(function(err) {
      res.json({ ok: false, message: err.message });
    });
  });

  // ─── IPA Sync ───

  router.post('/ipa/sync', requireAdmin, function(req, res) {
    if (DEMO_MODE) {
      return res.json({ status: 'skipped', message: 'Sync disabled in demo mode' });
    }
    runConsolidatedSync(storage).then(function(result) {
      res.json(result);
    }).catch(function(err) {
      res.status(500).json({ status: 'error', message: err.message });
    });
  });

  router.get('/ipa/sync/status', function(req, res) {
    var log = loadSyncLog(storage);
    res.json({ running: isConsolidatedSyncInProgress(), startedAt: null, lastResult: log });
  });

  // ─── People Registry ───

  router.get('/registry/people', function(req, res) {
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
      if (req.query.missingGithub === 'true' && p.github && p.github.username) continue;
      if (req.query.missingGitlab === 'true' && p.gitlab && p.gitlab.username) continue;
      if (req.query.search) {
        var term = req.query.search.toLowerCase();
        var searchable = [p.name, p.email, p.uid, p.github ? p.github.username : '', p.gitlab ? p.gitlab.username : ''].join(' ').toLowerCase();
        if (searchable.indexOf(term) === -1) continue;
      }
      result.push(Object.assign({}, p, {
        orgDisplayName: orgDisplayNames[p.orgRoot] || p.orgRoot || '',
        teams: teamsByUid[p.uid] || []
      }));
    }
    res.json({ people: result, total: result.length });
  });

  router.get('/registry/people/:uid', function(req, res) {
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
    res.json({ person: person, managerChain: managerChain, directReports: directReports });
  });

  // ─── Identity Overrides ───

  var VALID_USERNAME = /^[a-zA-Z0-9_.-]{1,39}$/;

  router.put('/registry/people/:uid/github', requireAdmin, function(req, res) {
    var username = req.body.username;
    if (!username || typeof username !== 'string' || !username.trim()) return res.status(400).json({ error: 'Username is required' });
    if (!VALID_USERNAME.test(username.trim())) return res.status(400).json({ error: 'Invalid username format (1-39 chars, alphanumeric/dash/underscore/dot)' });
    var updated = writePeopleUpdate(req.params.uid, function(p) { p.github = { username: username.trim(), source: 'manual' }; });
    if (!updated) return res.status(404).json({ error: 'Person not found' });
    res.json({ status: 'updated', github: updated.github });
  });

  router.put('/registry/people/:uid/gitlab', requireAdmin, function(req, res) {
    var username = req.body.username;
    if (!username || typeof username !== 'string' || !username.trim()) return res.status(400).json({ error: 'Username is required' });
    if (!VALID_USERNAME.test(username.trim())) return res.status(400).json({ error: 'Invalid username format (1-39 chars, alphanumeric/dash/underscore/dot)' });
    var updated = writePeopleUpdate(req.params.uid, function(p) { p.gitlab = { username: username.trim(), source: 'manual' }; });
    if (!updated) return res.status(404).json({ error: 'Person not found' });
    res.json({ status: 'updated', gitlab: updated.gitlab });
  });

  router.delete('/registry/people/:uid/github', requireAdmin, function(req, res) {
    var updated = writePeopleUpdate(req.params.uid, function(p) { p.github = null; });
    if (!updated) return res.status(404).json({ error: 'Person not found' });
    res.json({ status: 'removed' });
  });

  router.delete('/registry/people/:uid/gitlab', requireAdmin, function(req, res) {
    var updated = writePeopleUpdate(req.params.uid, function(p) { p.gitlab = null; });
    if (!updated) return res.status(404).json({ error: 'Person not found' });
    res.json({ status: 'removed' });
  });

  // ─── Lifecycle ───

  router.post('/registry/people/:uid/reactivate', requireAdmin, function(req, res) {
    var updated = writePeopleUpdate(req.params.uid, function(p) { p.status = 'active'; p.inactiveSince = null; });
    if (!updated) return res.status(404).json({ error: 'Person not found' });
    res.json({ status: 'reactivated', person: updated });
  });

  router.delete('/registry/people/:uid', requireAdmin, function(req, res) {
    var reg = loadRegistry(storage);
    if (!reg.people || !Object.prototype.hasOwnProperty.call(reg.people, req.params.uid)) return res.status(404).json({ error: 'Person not found' });
    delete reg.people[req.params.uid];
    storage.writeToStorage(REGISTRY_KEY, reg);
    res.json({ status: 'purged' });
  });

  // ─── Org Trees ───

  router.get('/registry/orgs', function(req, res) {
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

  router.get('/registry/stats', function(req, res) {
    var people = getPeopleMap();
    var uids = Object.keys(people);
    var active = 0, inactive = 0, byOrg = {}, byGeo = {};
    for (var i = 0; i < uids.length; i++) {
      var p = people[uids[i]];
      if (p.status === 'active') {
        active++;
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

    res.json({ total: uids.length, active: active, inactive: inactive, coverage: computeCoverage(people), byOrg: byOrg, byGeo: byGeo, orgDisplayNames: orgDisplayNames });
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
