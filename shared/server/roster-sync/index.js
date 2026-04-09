/**
 * Roster sync orchestrator.
 * Coordinates LDAP queries, Google Sheets fetching, and merge.
 */

const { loadConfig, updateSyncStatus } = require('./config');
const ldapModule = require('./ldap');
const { fetchSheetData } = require('./sheets');
const { buildRoster } = require('./merge');
const { inferUsernames } = require('./username-inference');

let syncInProgress = false;
let dailyTimer = null;
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

/**
 * Run a full roster sync.
 * Returns a summary object with counts and status.
 */
async function runSync(storage) {
  if (syncInProgress) {
    return { status: 'skipped', message: 'Sync already in progress' };
  }

  const config = loadConfig(storage);
  if (!config || !config.orgRoots || config.orgRoots.length === 0) {
    return { status: 'error', message: 'No org roots configured' };
  }

  syncInProgress = true;
  console.log('[roster-sync] Starting sync...');

  try {
    // Phase 1: LDAP traversal
    console.log('[roster-sync] Connecting to LDAP...');
    const client = ldapModule.createClient();
    const ldapOrgs = {};
    let totalPeople = 0;

    try {
      // Look up VP (manager of first org root)
      let vpInfo = null;
      const firstRoot = config.orgRoots[0];
      const firstRootResult = await ldapModule.traverseOrg(client, firstRoot.uid);
      if (firstRootResult.leader.managerUid) {
        const vp = await ldapModule.lookupPerson(client, firstRootResult.leader.managerUid);
        if (vp) {
          vpInfo = { name: vp.name, uid: vp.uid };
        }
      }
      ldapOrgs[firstRoot.uid] = firstRootResult;
      totalPeople += firstRootResult.members.length + 1;
      console.log(`[roster-sync] ${firstRoot.uid}: ${firstRootResult.members.length} members`);

      // Remaining org roots
      for (let i = 1; i < config.orgRoots.length; i++) {
        const root = config.orgRoots[i];
        try {
          const orgData = await ldapModule.traverseOrg(client, root.uid);
          ldapOrgs[root.uid] = orgData;
          totalPeople += orgData.members.length + 1;
          console.log(`[roster-sync] ${root.uid}: ${orgData.members.length} members`);
        } catch (err) {
          console.error(`[roster-sync] Failed to traverse ${root.uid}: ${err.message}`);
        }
      }

      // Phase 2: Google Sheets enrichment (optional)
      let sheetsData = null;
      if (config.googleSheetId) {
        try {
          console.log('[roster-sync] Fetching Google Sheets data...');
          sheetsData = await fetchSheetData(config.googleSheetId, config.sheetNames, config.customFields, config.teamStructure);
          console.log(`[roster-sync] Sheets: ${sheetsData.size} unique people found`);
        } catch (err) {
          console.warn(`[roster-sync] Google Sheets fetch failed (continuing without): ${err.message}`);
        }
      }

      // Phase 3: Merge
      const roster = buildRoster(config.orgRoots, ldapOrgs, sheetsData, vpInfo);

      // Phase 4: Username inference (optional)
      let usernamesInferred = { github: 0, gitlab: 0 };
      const hasGitlabInstances = Array.isArray(config.gitlabInstances) && config.gitlabInstances.some(i => i.groups && i.groups.length > 0);
      if (config.githubOrgs || config.githubOrg || config.gitlabGroups || config.gitlabGroup || hasGitlabInstances) {
        try {
          usernamesInferred = await inferUsernames(roster, config);
        } catch (err) {
          console.warn(`[roster-sync] Username inference failed (continuing without): ${err.message}`);
        }
      }

      // Phase 5: Write
      storage.writeToStorage('org-roster-full.json', roster);

      const summary = {
        status: 'success',
        totalPeople: totalPeople,
        orgsProcessed: Object.keys(ldapOrgs).length,
        sheetsEnriched: sheetsData ? sheetsData.size : 0,
        githubInferred: usernamesInferred.github,
        gitlabInferred: usernamesInferred.gitlab,
        timestamp: new Date().toISOString()
      };

      updateSyncStatus(storage, 'success', null);
      console.log(`[roster-sync] Complete: ${totalPeople} people across ${summary.orgsProcessed} orgs`);
      return summary;
    } finally {
      client.unbind(function() {});
    }
  } catch (err) {
    console.error('[roster-sync] Sync failed:', err.message);
    updateSyncStatus(storage, 'error', err.message);
    return { status: 'error', message: err.message };
  } finally {
    syncInProgress = false;
  }
}

/**
 * Schedule daily sync. Returns a cancel function.
 */
function scheduleDaily(storage) {
  if (dailyTimer) {
    clearInterval(dailyTimer);
  }

  dailyTimer = setInterval(function() {
    console.log('[roster-sync] Running scheduled daily sync...');
    runSync(storage).catch(function(err) {
      console.error('[roster-sync] Scheduled sync error:', err);
    });
  }, TWENTY_FOUR_HOURS);

  // Don't prevent process exit
  if (dailyTimer.unref) dailyTimer.unref();

  return function cancel() {
    if (dailyTimer) {
      clearInterval(dailyTimer);
      dailyTimer = null;
    }
  };
}

function isSyncInProgress() {
  return syncInProgress;
}

module.exports = {
  runSync,
  scheduleDaily,
  isSyncInProgress
};
