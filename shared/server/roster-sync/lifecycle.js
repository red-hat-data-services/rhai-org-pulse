/**
 * People lifecycle tracking for IPA-synced registries.
 *
 * Handles merging fresh LDAP data with existing registry entries,
 * preserving manual GitHub/GitLab overrides, tracking field changes,
 * and managing active/inactive lifecycle with grace-period purging.
 *
 * Relocated from modules/team-data/server/sync.js to shared/ for
 * reuse across modules.
 */

const TRACKED_FIELDS = ['name', 'email', 'title', 'city', 'country', 'geo',
  'location', 'officeLocation', 'costCenter', 'managerUid', 'orgRoot'];

/**
 * Merge a fresh LDAP person into the existing registry entry.
 * Returns { person, changes, isNew } where changes is an array of { uid, field, from, to }.
 */
function mergePerson(existing, fresh, orgRootUid, now) {
  if (!existing) {
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
        github: fresh.githubUsername
          ? { username: fresh.githubUsername, source: 'ldap' }
          : null,
        gitlab: fresh.gitlabUsername
          ? { username: fresh.gitlabUsername, source: 'ldap' }
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

  var changes = [];

  if (existing.status === 'inactive') {
    merged.status = 'active';
    merged.inactiveSince = null;
  }

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

  if (!existing.github || existing.github.source !== 'manual') {
    if (fresh.githubUsername) {
      var oldGh = existing.github ? existing.github.username : null;
      if (oldGh !== fresh.githubUsername) {
        changes.push({ uid: fresh.uid, field: 'github', from: oldGh || '', to: fresh.githubUsername });
      }
      merged.github = { username: fresh.githubUsername, source: 'ldap' };
    } else if (existing.github && existing.github.source === 'ldap') {
      changes.push({ uid: fresh.uid, field: 'github', from: existing.github.username, to: '' });
      merged.github = null;
    }
  }

  if (!existing.gitlab || existing.gitlab.source !== 'manual') {
    if (fresh.gitlabUsername) {
      var oldGl = existing.gitlab ? existing.gitlab.username : null;
      if (oldGl !== fresh.gitlabUsername) {
        changes.push({ uid: fresh.uid, field: 'gitlab', from: oldGl || '', to: fresh.gitlabUsername });
      }
      merged.gitlab = { username: fresh.gitlabUsername, source: 'ldap' };
    } else if (existing.gitlab && existing.gitlab.source === 'ldap') {
      changes.push({ uid: fresh.uid, field: 'gitlab', from: existing.gitlab.username, to: '' });
      merged.gitlab = null;
    }
  }

  return { person: merged, changes: changes, isNew: false };
}

/**
 * Compute GitHub/GitLab coverage stats from a people map.
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
 * Process lifecycle for people not found in the latest LDAP sync.
 * Marks active people as inactive, purges expired inactive people.
 *
 * @param {Object} existingPeople - Map of uid -> person from registry
 * @param {Object} freshPeopleMap - Map of uid -> { person, orgRoot } from current LDAP sync
 * @param {Object} merged - Map being built with merge results (mutated)
 * @param {Object} changelog - Changelog object with joined/left/reactivated/changed arrays (mutated)
 * @param {number} gracePeriodDays - Number of days before purging inactive people
 * @param {string} now - ISO timestamp
 */
function processLifecycle(existingPeople, freshPeopleMap, merged, changelog, gracePeriodDays, now) {
  var gracePeriodMs = (gracePeriodDays || 30) * 24 * 60 * 60 * 1000;
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
        console.log('[lifecycle] Purging ' + euid + ' (grace period expired)');
      } else {
        merged[euid] = ep;
      }
    }
  }
}

module.exports = {
  mergePerson,
  computeCoverage,
  processLifecycle,
  TRACKED_FIELDS
};
