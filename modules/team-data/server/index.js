/**
 * team-data module server entry point.
 * Registers REST API routes for the people registry.
 */

const { loadConfig, saveConfig, getIpaStatus } = require('./config');
const { runSync, getSyncStatus, loadRegistry, computeCoverage, REGISTRY_KEY } = require('./sync');
const ipaClient = require('./ipa-client');

module.exports = function registerRoutes(router, context) {
  var storage = context.storage;
  var requireAdmin = context.requireAdmin;

  var DEMO_MODE = process.env.DEMO_MODE === 'true';

  var autoSyncTimer = null;

  function getRegistry() {
    return loadRegistry(storage);
  }

  function getPeopleMap() {
    var reg = getRegistry();
    return reg.people || {};
  }

  function writePeopleUpdate(uid, updater) {
    var reg = getRegistry();
    if (!reg.people || !reg.people[uid]) {
      return null;
    }
    updater(reg.people[uid]);
    storage.writeToStorage(REGISTRY_KEY, reg);
    return reg.people[uid];
  }

  // ─── Config ───

  router.get('/config', requireAdmin, function(req, res) {
    var config = loadConfig(storage);
    var ipa = getIpaStatus();
    res.json({ config: config, ipa: ipa });
  });

  router.post('/config', requireAdmin, function(req, res) {
    var config = loadConfig(storage);
    var body = req.body;
    if (body.orgRoots !== undefined) config.orgRoots = body.orgRoots;
    if (body.gracePeriodDays !== undefined) config.gracePeriodDays = body.gracePeriodDays;
    if (body.autoSync !== undefined) config.autoSync = body.autoSync;
    if (body.excludedTitles !== undefined) config.excludedTitles = body.excludedTitles;
    saveConfig(storage, config);

    scheduleAutoSync(config);
    res.json({ status: 'saved', config: config });
  });

  // ─── IPA Connection Test ───

  router.post('/ipa/test', requireAdmin, function(req, res) {
    ipaClient.testConnection().then(function(result) {
      res.json(result);
    }).catch(function(err) {
      res.json({ ok: false, message: err.message });
    });
  });

  // ─── Sync ───

  router.post('/sync', requireAdmin, function(req, res) {
    if (DEMO_MODE) {
      return res.json({ status: 'skipped', message: 'Sync disabled in demo mode' });
    }
    runSync(storage).then(function(result) {
      res.json(result);
    }).catch(function(err) {
      res.status(500).json({ status: 'error', message: err.message });
    });
  });

  router.get('/sync/status', function(req, res) {
    res.json(getSyncStatus(storage));
  });

  // ─── People ───

  router.get('/people', function(req, res) {
    var people = getPeopleMap();
    var result = [];
    var uids = Object.keys(people);

    for (var i = 0; i < uids.length; i++) {
      var p = people[uids[i]];

      if (req.query.status && p.status !== req.query.status) continue;
      if (req.query.org && p.orgRoot !== req.query.org) continue;
      if (req.query.missingGithub === 'true' && p.github && p.github.username) continue;
      if (req.query.missingGitlab === 'true' && p.gitlab && p.gitlab.username) continue;

      if (req.query.search) {
        var term = req.query.search.toLowerCase();
        var searchable = [
          p.name, p.email, p.uid,
          p.github ? p.github.username : '',
          p.gitlab ? p.gitlab.username : ''
        ].join(' ').toLowerCase();
        if (searchable.indexOf(term) === -1) continue;
      }

      result.push(p);
    }

    res.json({ people: result, total: result.length });
  });

  router.get('/people/:uid', function(req, res) {
    var people = getPeopleMap();
    var person = people[req.params.uid];
    if (!person) {
      return res.status(404).json({ error: 'Person not found' });
    }

    // Build manager chain and direct reports
    var managerChain = [];
    var current = person;
    while (current && current.managerUid && managerChain.length < 20) {
      var manager = people[current.managerUid];
      if (!manager) break;
      managerChain.push({
        uid: manager.uid,
        name: manager.name,
        title: manager.title
      });
      current = manager;
    }

    var directReports = [];
    var uids = Object.keys(people);
    for (var i = 0; i < uids.length; i++) {
      var p = people[uids[i]];
      if (p.managerUid === req.params.uid && p.status === 'active') {
        directReports.push({
          uid: p.uid,
          name: p.name,
          title: p.title,
          github: p.github,
          gitlab: p.gitlab
        });
      }
    }

    res.json({
      person: person,
      managerChain: managerChain,
      directReports: directReports
    });
  });

  // ─── Identity Overrides (admin) ───

  router.put('/people/:uid/github', requireAdmin, function(req, res) {
    var username = req.body.username;
    if (!username || typeof username !== 'string' || !username.trim()) {
      return res.status(400).json({ error: 'Username is required' });
    }
    var updated = writePeopleUpdate(req.params.uid, function(p) {
      p.github = { username: username.trim(), source: 'manual' };
    });
    if (!updated) return res.status(404).json({ error: 'Person not found' });
    res.json({ status: 'updated', github: updated.github });
  });

  router.put('/people/:uid/gitlab', requireAdmin, function(req, res) {
    var username = req.body.username;
    if (!username || typeof username !== 'string' || !username.trim()) {
      return res.status(400).json({ error: 'Username is required' });
    }
    var updated = writePeopleUpdate(req.params.uid, function(p) {
      p.gitlab = { username: username.trim(), source: 'manual' };
    });
    if (!updated) return res.status(404).json({ error: 'Person not found' });
    res.json({ status: 'updated', gitlab: updated.gitlab });
  });

  router.delete('/people/:uid/github', requireAdmin, function(req, res) {
    var updated = writePeopleUpdate(req.params.uid, function(p) {
      p.github = null;
    });
    if (!updated) return res.status(404).json({ error: 'Person not found' });
    res.json({ status: 'removed' });
  });

  router.delete('/people/:uid/gitlab', requireAdmin, function(req, res) {
    var updated = writePeopleUpdate(req.params.uid, function(p) {
      p.gitlab = null;
    });
    if (!updated) return res.status(404).json({ error: 'Person not found' });
    res.json({ status: 'removed' });
  });

  // ─── Lifecycle (admin) ───

  router.post('/people/:uid/reactivate', requireAdmin, function(req, res) {
    var updated = writePeopleUpdate(req.params.uid, function(p) {
      p.status = 'active';
      p.inactiveSince = null;
    });
    if (!updated) return res.status(404).json({ error: 'Person not found' });
    res.json({ status: 'reactivated', person: updated });
  });

  router.delete('/people/:uid', requireAdmin, function(req, res) {
    var reg = getRegistry();
    if (!reg.people || !reg.people[req.params.uid]) {
      return res.status(404).json({ error: 'Person not found' });
    }
    delete reg.people[req.params.uid];
    storage.writeToStorage(REGISTRY_KEY, reg);
    res.json({ status: 'purged' });
  });

  // ─── Derived Views ───

  router.get('/orgs', function(req, res) {
    var reg = getRegistry();
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
        if (p.managerUid === uid && p.status === 'active') {
          children.push(buildSubtree(p.uid));
        }
      }

      var teamSize = children.reduce(function(sum, c) {
        return sum + (c ? c.teamSize : 0);
      }, 0) + children.length;

      return {
        uid: person.uid,
        name: person.name,
        title: person.title,
        github: person.github,
        gitlab: person.gitlab,
        teamSize: teamSize,
        children: children.filter(Boolean)
      };
    }

    var trees = [];
    for (var i = 0; i < orgRoots.length; i++) {
      var tree = buildSubtree(orgRoots[i]);
      if (tree) trees.push(tree);
    }

    res.json({ vp: meta.vp, trees: trees });
  });

  router.get('/stats', function(req, res) {
    var people = getPeopleMap();
    var uids = Object.keys(people);
    var active = 0;
    var inactive = 0;
    var byOrg = {};
    var byGeo = {};

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
      } else {
        inactive++;
      }
    }

    var coverage = computeCoverage(people);

    res.json({
      total: uids.length,
      active: active,
      inactive: inactive,
      coverage: coverage,
      byOrg: byOrg,
      byGeo: byGeo
    });
  });

  // ─── Auto-sync scheduling ───

  function scheduleAutoSync(config) {
    if (autoSyncTimer) {
      clearInterval(autoSyncTimer);
      autoSyncTimer = null;
    }
    if (!config.autoSync || !config.autoSync.enabled) return;

    var intervalMs = (config.autoSync.intervalHours || 24) * 60 * 60 * 1000;
    autoSyncTimer = setInterval(function() {
      console.log('[team-data] Running scheduled auto-sync...');
      runSync(storage).catch(function(err) {
        console.error('[team-data] Auto-sync error:', err);
      });
    }, intervalMs);

    if (autoSyncTimer.unref) autoSyncTimer.unref();
    console.log('[team-data] Auto-sync scheduled every ' + config.autoSync.intervalHours + 'h');
  }

  // Initialize auto-sync from config
  var initialConfig = loadConfig(storage);
  scheduleAutoSync(initialConfig);

  // Diagnostics
  if (context.registerDiagnostics) {
    context.registerDiagnostics(function() {
      var ipa = getIpaStatus();
      var syncStatus = getSyncStatus(storage);
      var people = getPeopleMap();
      var count = Object.keys(people).length;
      return {
        enabled: true,
        ipaReady: ipa.ready,
        peopleCount: count,
        lastSync: syncStatus.lastResult ? syncStatus.lastResult.completedAt : null,
        lastSyncStatus: syncStatus.lastResult ? syncStatus.lastResult.status : null
      };
    });
  }
};
