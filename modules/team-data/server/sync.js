/**
 * Sync orchestrator for the team-data module.
 *
 * Connects to IPA, traverses configured org roots, merges results
 * with the existing registry (preserving manual overrides and tracking
 * lifecycle), and produces a changelog.
 */

const ipaClient = require('./ipa-client');
const { loadConfig } = require('./config');

const REGISTRY_KEY = 'team-data/registry.json';
const SYNC_LOG_KEY = 'team-data/sync-log.json';

const TRACKED_FIELDS = ['name', 'email', 'title', 'city', 'country', 'geo',
  'location', 'officeLocation', 'costCenter', 'managerUid', 'orgRoot'];

let syncInProgress = false;
let syncStartedAt = null;

function loadRegistry(storage) {
  return storage.readFromStorage(REGISTRY_KEY) || { meta: null, people: {} };
}

function loadSyncLog(storage) {
  return storage.readFromStorage(SYNC_LOG_KEY) || null;
}

/**
 * Merge a fresh LDAP person into the existing registry entry.
 * Returns { person, changes } where changes is an array of { field, from, to }.
 */
function mergePerson(existing, fresh, orgRootUid, now) {
  var changes = [];

  if (!existing) {
    // New person
    return {
      person: {
        uid: fresh.uid,
        name: fresh.name,
        email: fresh.email,
        title: fresh.title,
        city: fresh.city,
        country: fresh.country,
        geo: fresh.geo,
        location: fresh.location,
        officeLocation: fresh.officeLocation,
        costCenter: fresh.costCenter,
        managerUid: fresh.managerUid,
        orgRoot: orgRootUid,
        github: fresh._githubFromLdap
          ? { username: fresh._githubFromLdap, source: 'ldap' }
          : null,
        gitlab: fresh._gitlabFromLdap
          ? { username: fresh._gitlabFromLdap, source: 'ldap' }
          : null,
        status: 'active',
        firstSeenAt: now,
        lastSeenAt: now,
        inactiveSince: null
      },
      changes: [],
      isNew: true
    };
  }

  var merged = Object.assign({}, existing);
  merged.lastSeenAt = now;
  merged.orgRoot = orgRootUid;

  // Reactivate if was inactive
  if (existing.status === 'inactive') {
    merged.status = 'active';
    merged.inactiveSince = null;
  }

  // Track field changes
  for (var i = 0; i < TRACKED_FIELDS.length; i++) {
    var field = TRACKED_FIELDS[i];
    var oldVal = existing[field] || '';
    var newVal = fresh[field] || '';
    if (field === 'orgRoot') newVal = orgRootUid;
    if (oldVal !== newVal) {
      changes.push({ uid: fresh.uid, field: field, from: oldVal, to: newVal });
      merged[field] = newVal;
    }
  }

  // GitHub merge: manual is never overwritten
  if (!existing.github || existing.github.source !== 'manual') {
    if (fresh._githubFromLdap) {
      var oldGh = existing.github ? existing.github.username : null;
      if (oldGh !== fresh._githubFromLdap) {
        changes.push({ uid: fresh.uid, field: 'github', from: oldGh || '', to: fresh._githubFromLdap });
      }
      merged.github = { username: fresh._githubFromLdap, source: 'ldap' };
    } else if (existing.github && existing.github.source === 'ldap') {
      changes.push({ uid: fresh.uid, field: 'github', from: existing.github.username, to: '' });
      merged.github = null;
    }
  }

  // GitLab merge: manual is never overwritten
  if (!existing.gitlab || existing.gitlab.source !== 'manual') {
    if (fresh._gitlabFromLdap) {
      var oldGl = existing.gitlab ? existing.gitlab.username : null;
      if (oldGl !== fresh._gitlabFromLdap) {
        changes.push({ uid: fresh.uid, field: 'gitlab', from: oldGl || '', to: fresh._gitlabFromLdap });
      }
      merged.gitlab = { username: fresh._gitlabFromLdap, source: 'ldap' };
    } else if (existing.gitlab && existing.gitlab.source === 'ldap') {
      changes.push({ uid: fresh.uid, field: 'gitlab', from: existing.gitlab.username, to: '' });
      merged.gitlab = null;
    }
  }

  return { person: merged, changes: changes, isNew: false };
}

/**
 * Compute coverage stats from a people map.
 */
function computeCoverage(people) {
  var active = 0;
  var githubCount = 0;
  var gitlabCount = 0;
  var githubBySource = { ldap: 0, manual: 0 };
  var gitlabBySource = { ldap: 0, manual: 0 };

  var uids = Object.keys(people);
  for (var i = 0; i < uids.length; i++) {
    var p = people[uids[i]];
    if (p.status !== 'active') continue;
    active++;
    if (p.github && p.github.username) {
      githubCount++;
      if (githubBySource[p.github.source] !== undefined) {
        githubBySource[p.github.source]++;
      }
    }
    if (p.gitlab && p.gitlab.username) {
      gitlabCount++;
      if (gitlabBySource[p.gitlab.source] !== undefined) {
        gitlabBySource[p.gitlab.source]++;
      }
    }
  }

  return {
    github: { total: active, hasId: githubCount, bySource: githubBySource },
    gitlab: { total: active, hasId: gitlabCount, bySource: gitlabBySource }
  };
}

/**
 * Run a full sync.
 */
async function runSync(storage) {
  if (syncInProgress) {
    return { status: 'skipped', message: 'Sync already in progress' };
  }

  var config = loadConfig(storage);
  if (!config.orgRoots || config.orgRoots.length === 0) {
    return { status: 'error', message: 'No org roots configured' };
  }

  syncInProgress = true;
  syncStartedAt = new Date().toISOString();
  var startTime = Date.now();
  console.log('[team-data] Starting sync...');

  try {
    var existing = loadRegistry(storage);
    var existingPeople = existing.people || {};

    // Connect to IPA
    console.log('[team-data] Connecting to IPA...');
    var conn = ipaClient.createClient();
    var freshPeopleMap = {};
    var vpInfo = null;

    try {
      await ipaClient.bindClient(conn.client, conn.config.bindDn, conn.config.bindPassword);
      console.log('[team-data] Authenticated successfully');

      // Traverse each org root
      for (var i = 0; i < config.orgRoots.length; i++) {
        var root = config.orgRoots[i];
        try {
          console.log('[team-data] Traversing org root: ' + root.uid);
          var result = await ipaClient.traverseOrg(
            conn.client, conn.config.baseDn, root.uid, config.excludedTitles
          );

          // VP detection from first org root's leader's manager
          if (i === 0 && result.leader.managerUid && !vpInfo) {
            var vp = await ipaClient.lookupPerson(
              conn.client, conn.config.baseDn, result.leader.managerUid
            );
            if (vp) vpInfo = { uid: vp.uid, name: vp.name };
          }

          for (var j = 0; j < result.people.length; j++) {
            var p = result.people[j];
            freshPeopleMap[p.uid] = { person: p, orgRoot: root.uid };
          }

          console.log('[team-data] ' + root.uid + ': ' + result.people.length + ' people');
        } catch (err) {
          console.error('[team-data] Failed to traverse ' + root.uid + ': ' + err.message);
        }
      }
    } finally {
      conn.client.unbind(function() {});
    }

    // Merge
    var now = new Date().toISOString();
    var merged = {};
    var changelog = { joined: [], left: [], reactivated: [], changed: [] };

    // Process people found in LDAP
    var freshUids = Object.keys(freshPeopleMap);
    for (var k = 0; k < freshUids.length; k++) {
      var uid = freshUids[k];
      var entry = freshPeopleMap[uid];
      var mergeResult = mergePerson(existingPeople[uid], entry.person, entry.orgRoot, now);
      merged[uid] = mergeResult.person;

      if (mergeResult.isNew) {
        changelog.joined.push(uid);
      } else if (existingPeople[uid] && existingPeople[uid].status === 'inactive') {
        changelog.reactivated.push(uid);
      }
      if (mergeResult.changes.length > 0) {
        changelog.changed = changelog.changed.concat(mergeResult.changes);
      }
    }

    // Handle people NOT found in LDAP (mark inactive or purge)
    var gracePeriodMs = (config.gracePeriodDays || 30) * 24 * 60 * 60 * 1000;
    var existingUids = Object.keys(existingPeople);
    for (var m = 0; m < existingUids.length; m++) {
      var euid = existingUids[m];
      if (freshPeopleMap[euid]) continue;

      var ep = existingPeople[euid];
      if (ep.status === 'active') {
        ep.status = 'inactive';
        ep.inactiveSince = now;
        changelog.left.push(euid);
        merged[euid] = ep;
      } else if (ep.status === 'inactive') {
        var inactiveSince = new Date(ep.inactiveSince).getTime();
        if (Date.now() - inactiveSince > gracePeriodMs) {
          console.log('[team-data] Purging ' + euid + ' (grace period expired)');
          // Don't add to merged -- effectively purged
        } else {
          merged[euid] = ep;
        }
      }
    }

    // Build registry
    var activeCount = 0;
    var inactiveCount = 0;
    var mergedUids = Object.keys(merged);
    for (var n = 0; n < mergedUids.length; n++) {
      if (merged[mergedUids[n]].status === 'active') activeCount++;
      else inactiveCount++;
    }

    var registry = {
      meta: {
        generatedAt: now,
        provider: 'ipa',
        orgRoots: config.orgRoots.map(function(r) { return r.uid; }),
        vp: vpInfo
      },
      people: merged
    };

    var syncLog = {
      completedAt: now,
      status: 'success',
      duration: Date.now() - startTime,
      summary: {
        total: mergedUids.length,
        active: activeCount,
        inactive: inactiveCount,
        joined: changelog.joined,
        left: changelog.left,
        reactivated: changelog.reactivated,
        changed: changelog.changed
      },
      coverage: computeCoverage(merged)
    };

    storage.writeToStorage(REGISTRY_KEY, registry);
    storage.writeToStorage(SYNC_LOG_KEY, syncLog);

    console.log('[team-data] Sync complete: ' + mergedUids.length + ' people (' +
      activeCount + ' active, ' + inactiveCount + ' inactive), ' +
      changelog.joined.length + ' joined, ' + changelog.left.length + ' left');

    return syncLog;
  } catch (err) {
    console.error('[team-data] Sync failed:', err.message);
    var errorLog = {
      completedAt: new Date().toISOString(),
      status: 'error',
      duration: Date.now() - startTime,
      message: err.message
    };
    storage.writeToStorage(SYNC_LOG_KEY, errorLog);
    return errorLog;
  } finally {
    syncInProgress = false;
    syncStartedAt = null;
  }
}

function getSyncStatus(storage) {
  var log = loadSyncLog(storage);
  return {
    running: syncInProgress,
    startedAt: syncStartedAt,
    lastResult: log
  };
}

function isSyncInProgress() {
  return syncInProgress;
}

module.exports = {
  runSync,
  getSyncStatus,
  isSyncInProgress,
  loadRegistry,
  computeCoverage,
  REGISTRY_KEY,
  SYNC_LOG_KEY
};
