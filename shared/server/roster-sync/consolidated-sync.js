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
    // Skip Sheets enrichment when team data source is "in-app" —
    // in-app data lives in _appFields/teamIds which are NOT in ENRICHMENT_FIELDS
    var sheetsData = null;
    if (config.teamDataSource !== 'in-app' && config.googleSheetId) {
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

    // Only clear and re-apply enrichment fields if Sheets data was actually fetched.
    // Without this guard, a sync that skips or fails Sheets would wipe existing
    // enrichment data (_teamGrouping, etc.) with nothing to replace it.
    if (sheetsData) {
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
    }

    // ─── Phase 5a: Set orgType on freshPeopleMap entries ───
    for (var oi = 0; oi < freshUids.length; oi++) {
      if (merged[freshUids[oi]]) {
        merged[freshUids[oi]].orgType = 'engineering';
      }
    }

    // ─── Phase 5b: Resolve auxiliary person references ───
    var auxiliaryResolved = 0;
    var auxiliaryManagersAdded = 0;
    var unresolvedPersonRefs = [];

    try {
      var fieldDefsData = storage.readFromStorage('team-data/field-definitions.json');
      var teamsData = storage.readFromStorage('team-data/teams.json');

      if (fieldDefsData && teamsData && teamsData.teams) {
        // Find person-reference-linked team fields
        var personRefFields = [];
        var teamFields = fieldDefsData.teamFields || [];
        for (var pfi = 0; pfi < teamFields.length; pfi++) {
          if (teamFields[pfi].type === 'person-reference-linked' && !teamFields[pfi].deleted) {
            personRefFields.push(teamFields[pfi].id);
          }
        }

        if (personRefFields.length > 0) {
          // Collect all person-reference values from team metadata
          var refValues = []; // { teamId, fieldId, value, index (for arrays) }
          var teamIds = Object.keys(teamsData.teams);
          for (var ti = 0; ti < teamIds.length; ti++) {
            var team = teamsData.teams[teamIds[ti]];
            var meta = team.metadata || {};
            for (var pri = 0; pri < personRefFields.length; pri++) {
              var fieldId = personRefFields[pri];
              var rawVal = meta[fieldId];
              if (!rawVal) continue;
              var vals = Array.isArray(rawVal) ? rawVal : [rawVal];
              for (var vi = 0; vi < vals.length; vi++) {
                if (vals[vi]) {
                  refValues.push({
                    teamId: teamIds[ti],
                    fieldId: fieldId,
                    value: vals[vi],
                    index: Array.isArray(rawVal) ? vi : -1
                  });
                }
              }
            }
          }

          // Open a new LDAP connection for auxiliary lookups
          var auxConn = null;
          var lookupCache = {};
          var teamsModified = false;

          try {
            auxConn = ipaClient.createClient();
            await ipaClient.bindClient(auxConn.client, auxConn.config.bindDn, auxConn.config.bindPassword);

            async function cachedLookup(uid) {
              if (lookupCache[uid] !== undefined) return lookupCache[uid];
              var person = await ipaClient.lookupPerson(auxConn.client, auxConn.config.baseDn, uid);
              lookupCache[uid] = person;
              return person;
            }

            async function createAuxiliaryEntry(ldapPerson) {
              var now2 = new Date().toISOString();
              var mergeResult = mergePerson(merged[ldapPerson.uid], ldapPerson, '_auxiliary', now2);
              merged[ldapPerson.uid] = mergeResult.person;
              merged[ldapPerson.uid].orgType = 'auxiliary';
              return mergeResult;
            }

            async function walkManagerChain(startUid) {
              var current = merged[startUid];
              var depth = 0;
              while (current && current.managerUid && depth < 20) {
                var mgrUid = current.managerUid;
                if (merged[mgrUid]) break; // already in registry
                var mgrPerson = await cachedLookup(mgrUid);
                if (!mgrPerson) break;
                await createAuxiliaryEntry(mgrPerson);
                auxiliaryManagersAdded++;
                current = merged[mgrUid];
                depth++;
              }
            }

            // Resolve each person-reference value
            for (var rvi = 0; rvi < refValues.length; rvi++) {
              var ref = refValues[rvi];
              var val = ref.value;

              // Check if it's already a UID in the registry
              if (merged[val]) continue;

              // Check if it looks like a UID (no spaces)
              var looksLikeUid = /^[a-z0-9_.-]+$/.test(val);

              if (looksLikeUid) {
                // Look up by UID in LDAP
                var ldapPerson = await cachedLookup(val);
                if (ldapPerson) {
                  await createAuxiliaryEntry(ldapPerson);
                  auxiliaryResolved++;
                  await walkManagerChain(val);
                } else {
                  unresolvedPersonRefs.push(val);
                }
              } else {
                // It contains spaces -- likely a name
                // Search registry by name
                var nameMatches = [];
                var mkeys = Object.keys(merged);
                for (var mki = 0; mki < mkeys.length; mki++) {
                  if (merged[mkeys[mki]].name === val) nameMatches.push(mkeys[mki]);
                }

                if (nameMatches.length === 1) {
                  // Replace name with UID in team metadata
                  var resolvedUid = nameMatches[0];
                  var tTeam = teamsData.teams[ref.teamId];
                  if (ref.index >= 0) {
                    tTeam.metadata[ref.fieldId][ref.index] = resolvedUid;
                  } else {
                    tTeam.metadata[ref.fieldId] = resolvedUid;
                  }
                  teamsModified = true;
                  auxiliaryResolved++;
                } else if (nameMatches.length === 0) {
                  // Search LDAP by cn
                  var cnFilter = '(cn=' + ipaClient.escapeLdapFilter(val) + ')';
                  var cnEntries = await (function() {
                    return new Promise(function(resolve, reject) {
                      var searchOpts = {
                        filter: cnFilter,
                        scope: 'sub',
                        attributes: ['cn', 'uid', 'mail', 'title', 'l', 'co', 'manager', 'rhatGeo', 'rhatLocation', 'rhatOfficeLocation', 'rhatCostCenter', 'rhatSocialUrl', 'memberOf'],
                        sizeLimit: 2
                      };
                      auxConn.client.search(auxConn.config.baseDn, searchOpts, function(err, res) {
                        if (err) return reject(err);
                        var results = [];
                        res.on('searchEntry', function(entry) {
                          var obj = {};
                          for (var ai = 0; ai < entry.attributes.length; ai++) {
                            var attr = entry.attributes[ai];
                            obj[attr.type] = attr.values.length === 1 ? attr.values[0] : attr.values;
                          }
                          results.push(obj);
                        });
                        res.on('error', function(e) { reject(e); });
                        res.on('end', function() { resolve(results); });
                      });
                    });
                  })();

                  if (cnEntries.length === 1) {
                    var cnPerson = ipaClient.entryToPerson(cnEntries[0]);
                    await createAuxiliaryEntry(cnPerson);
                    // Replace name with UID in team metadata
                    var tTeam2 = teamsData.teams[ref.teamId];
                    if (ref.index >= 0) {
                      tTeam2.metadata[ref.fieldId][ref.index] = cnPerson.uid;
                    } else {
                      tTeam2.metadata[ref.fieldId] = cnPerson.uid;
                    }
                    teamsModified = true;
                    auxiliaryResolved++;
                    await walkManagerChain(cnPerson.uid);
                  } else {
                    unresolvedPersonRefs.push(val);
                  }
                } else {
                  // Ambiguous name match
                  unresolvedPersonRefs.push(val);
                }
              }
            }

            // Write back updated teams.json if any names were replaced with UIDs
            if (teamsModified) {
              storage.writeToStorage('team-data/teams.json', teamsData);
              console.log('[consolidated-sync] Phase 5b: Updated teams.json with resolved person references');
            }
          } catch (auxErr) {
            console.warn('[consolidated-sync] Phase 5b auxiliary resolution failed (continuing): ' + auxErr.message);
          } finally {
            if (auxConn && auxConn.client) {
              auxConn.client.unbind(function() {});
            }
          }
        }
      }
    } catch (phase5bErr) {
      console.warn('[consolidated-sync] Phase 5b skipped: ' + phase5bErr.message);
    }

    if (auxiliaryResolved > 0 || unresolvedPersonRefs.length > 0) {
      console.log('[consolidated-sync] Phase 5b: resolved=' + auxiliaryResolved + ' managers=' + auxiliaryManagersAdded + ' unresolved=' + unresolvedPersonRefs.length);
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
        gitlabInferred: usernamesInferred.gitlab,
        auxiliaryResolved: auxiliaryResolved,
        auxiliaryManagersAdded: auxiliaryManagersAdded,
        unresolvedPersonRefs: unresolvedPersonRefs
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
