/**
 * Consolidated sync pipeline.
 * Merges LDAP traversal, Google Sheets enrichment, username inference,
 * and lifecycle tracking into a single sync that writes team-data/registry.json.
 *
 * Replaces both shared/server/roster-sync/index.js (runSync) and
 * modules/team-tracker/server/routes/ipa-registry.js (runIpaSync).
 */

const { loadConfig, updateSyncStatus } = require('./config');
const ipaClient = require('./ipa-client');
const { fetchSheetData } = require('./sheets');
const { enrichPerson } = require('./merge');
const { inferUsernames } = require('./username-inference');
const { mergePerson, computeCoverage, processLifecycle } = require('./lifecycle');
const { DEFAULT_EXCLUDED_TITLES } = require('./constants');

const REGISTRY_KEY = 'team-data/registry.json';
const SYNC_LOG_KEY = 'team-data/sync-log.json';

let syncInProgress = false;

// Enrichment fields that come from Google Sheets and should be
// cleared before re-enriching on each sync to prevent stale data.
const ENRICHMENT_FIELDS = [
  '_teamGrouping', 'miroTeam', 'specialty', 'engineeringSpeciality',
  'jiraComponent', 'customFields', 'additionalAssignments', 'sourceSheet',
  'jiraTeam', 'productManager', 'engineeringLead', 'sheetManager'
];

/**
 * Run the consolidated sync pipeline.
 * LDAP + Sheets enrichment + username inference + lifecycle tracking.
 *
 * @param {object} storage - Storage module with readFromStorage/writeToStorage
 * @returns {object} Sync log with status, summary, coverage
 */
async function runConsolidatedSync(storage) {
  if (syncInProgress) {
    return { status: 'skipped', message: 'Sync already in progress' };
  }

  const config = loadConfig(storage);
  if (!config || !config.orgRoots || config.orgRoots.length === 0) {
    return { status: 'error', message: 'No org roots configured' };
  }

  syncInProgress = true;
  var startTime = Date.now();
  console.log('[consolidated-sync] Starting sync...');

  try {
    // ─── Phase 1: LDAP traversal ───
    console.log('[consolidated-sync] Connecting to IPA LDAP...');
    var conn = ipaClient.createClient();
    var ldapOrgs = {};
    var freshPeopleMap = {};
    var vpInfo = null;
    var _totalPeople = 0;

    var excludedTitles = config.excludedTitles?.length ? config.excludedTitles : DEFAULT_EXCLUDED_TITLES;

    try {
      await ipaClient.bindClient(conn.client, conn.config.bindDn, conn.config.bindPassword);

      for (var i = 0; i < config.orgRoots.length; i++) {
        var root = config.orgRoots[i];
        try {
          var result = await ipaClient.traverseOrg(conn.client, conn.config.baseDn, root.uid, excludedTitles);

          // VP lookup from first org root's leader's manager
          if (i === 0 && result.leader.managerUid && !vpInfo) {
            var vp = await ipaClient.lookupPerson(conn.client, conn.config.baseDn, result.leader.managerUid);
            if (vp) vpInfo = { uid: vp.uid, name: vp.name };
          }

          // Build ldapOrgs for Sheets enrichment and username inference
          var members = result.people.filter(function(p) { return p.uid !== result.leader.uid; });
          ldapOrgs[root.uid] = { leader: result.leader, members: members };

          // Build freshPeopleMap for lifecycle processing
          for (var j = 0; j < result.people.length; j++) {
            var p = result.people[j];
            freshPeopleMap[p.uid] = { person: p, orgRoot: root.uid };
          }

          _totalPeople += result.people.length;
          console.log('[consolidated-sync] ' + root.uid + ': ' + result.people.length + ' people');
        } catch (err) {
          console.error('[consolidated-sync] Failed to traverse ' + root.uid + ': ' + err.message);
        }
      }
    } finally {
      conn.client.unbind(function() {});
    }

    // ─── Phase 2: Google Sheets enrichment (on temp roster-shaped structure) ───
    var sheetsData = null;
    if (config.googleSheetId) {
      try {
        console.log('[consolidated-sync] Fetching Google Sheets data...');
        sheetsData = await fetchSheetData(config.googleSheetId, config.sheetNames, config.customFields, config.teamStructure);
        console.log('[consolidated-sync] Sheets: ' + sheetsData.size + ' unique people found');
      } catch (err) {
        console.warn('[consolidated-sync] Google Sheets fetch failed (continuing without): ' + err.message);
      }
    }

    // Apply Sheets enrichment onto the LDAP people objects (in-place mutation)
    if (sheetsData) {
      for (var ri = 0; ri < config.orgRoots.length; ri++) {
        var orgRoot = config.orgRoots[ri];
        var orgData = ldapOrgs[orgRoot.uid];
        if (!orgData) continue;
        var orgDisplayName = orgRoot.displayName || orgRoot.name;
        enrichPerson(orgData.leader, sheetsData, orgDisplayName);
        for (var mi = 0; mi < orgData.members.length; mi++) {
          enrichPerson(orgData.members[mi], sheetsData, orgDisplayName);
        }
      }
    }

    // ─── Phase 3: Username inference (on temp roster-shaped structure) ───
    var usernamesInferred = { github: 0, gitlab: 0 };
    var hasGitlabInstances = Array.isArray(config.gitlabInstances) && config.gitlabInstances.some(function(inst) { return inst.groups && inst.groups.length > 0; });
    if (config.githubOrgs || config.githubOrg || config.gitlabGroups || config.gitlabGroup || hasGitlabInstances) {
      try {
        // inferUsernames expects { orgs: { key: { leader, members } } }
        var tempRoster = { orgs: ldapOrgs };
        usernamesInferred = await inferUsernames(tempRoster, config);
      } catch (err) {
        console.warn('[consolidated-sync] Username inference failed (continuing without): ' + err.message);
      }
    }

    // ─── Phase 4: Lifecycle merge (LDAP people -> registry people) ───
    var existing = storage.readFromStorage(REGISTRY_KEY) || { meta: null, people: {} };
    var existingPeople = existing.people || {};
    var now = new Date().toISOString();
    var merged = {};
    var changelog = { joined: [], left: [], reactivated: [], changed: [] };
    var gracePeriodDays = config.gracePeriodDays || 30;

    var freshUids = Object.keys(freshPeopleMap);
    for (var k = 0; k < freshUids.length; k++) {
      var uid = freshUids[k];
      var entry = freshPeopleMap[uid];
      var freshPerson = entry.person;
      var mergeResult = mergePerson(existingPeople[uid], freshPerson, entry.orgRoot, now);
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

    processLifecycle(existingPeople, freshPeopleMap, merged, changelog, gracePeriodDays, now);

    // ─── Phase 5: Apply enrichment fields AFTER mergePerson ───
    // mergePerson constructs fixed-field objects for new persons, dropping
    // extra fields. We copy enrichment fields from the enriched LDAP person
    // (which was mutated in-place by enrichPerson) onto the merged registry person.

    // Include dynamic custom field keys from teamStructure config
    var effectiveEnrichmentFields = ENRICHMENT_FIELDS.slice();
    if (config.teamStructure && Array.isArray(config.teamStructure.customFields)) {
      for (var tsi = 0; tsi < config.teamStructure.customFields.length; tsi++) {
        var cfKey = config.teamStructure.customFields[tsi].key;
        if (cfKey && effectiveEnrichmentFields.indexOf(cfKey) === -1) {
          effectiveEnrichmentFields.push(cfKey);
        }
      }
    }

    for (var ei = 0; ei < freshUids.length; ei++) {
      var euid = freshUids[ei];
      var enrichedPerson = freshPeopleMap[euid].person;
      var registryPerson = merged[euid];
      if (!registryPerson) continue;

      // Clear stale enrichment fields first (prevents old team data persisting)
      for (var fi = 0; fi < effectiveEnrichmentFields.length; fi++) {
        delete registryPerson[effectiveEnrichmentFields[fi]];
      }

      // Copy enrichment fields from enriched LDAP person (deep copy to avoid aliasing)
      for (var ci = 0; ci < effectiveEnrichmentFields.length; ci++) {
        var field = effectiveEnrichmentFields[ci];
        if (enrichedPerson[field] !== undefined) {
          registryPerson[field] = deepCopy(enrichedPerson[field]);
        }
      }
    }

    // ─── Phase 6: Write registry + sync log ───
    var activeCount = 0, inactiveCount = 0;
    var mergedUids = Object.keys(merged);
    for (var n = 0; n < mergedUids.length; n++) {
      if (merged[mergedUids[n]].status === 'active') activeCount++;
      else inactiveCount++;
    }

    var registry = {
      meta: {
        generatedAt: now,
        provider: 'consolidated',
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
        changed: changelog.changed,
        sheetsEnriched: sheetsData ? sheetsData.size : 0,
        githubInferred: usernamesInferred.github,
        gitlabInferred: usernamesInferred.gitlab
      },
      coverage: computeCoverage(merged)
    };

    storage.writeToStorage(REGISTRY_KEY, registry);
    storage.writeToStorage(SYNC_LOG_KEY, syncLog);

    updateSyncStatus(storage, 'success', null);
    console.log('[consolidated-sync] Complete: ' + mergedUids.length + ' people across ' + Object.keys(ldapOrgs).length + ' orgs');

    return syncLog;
  } catch (err) {
    console.error('[consolidated-sync] Sync failed:', err.message);
    updateSyncStatus(storage, 'error', err.message);
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
  }
}

function isSyncInProgress() {
  return syncInProgress;
}

function deepCopy(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(deepCopy);
  var copy = {};
  var keys = Object.keys(value);
  for (var i = 0; i < keys.length; i++) {
    copy[keys[i]] = deepCopy(value[keys[i]]);
  }
  return copy;
}

module.exports = {
  runConsolidatedSync,
  isSyncInProgress
};
