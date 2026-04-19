/**
 * Shared roster data access layer.
 * Reads team-data/registry.json and transforms to the legacy
 * org-roster-full.json shape for backward compatibility.
 */

const { loadConfig, getOrgDisplayNames } = require('./roster-sync/config');

/**
 * Read registry data and transform to the legacy roster format.
 * Returns { orgs: { orgKey: { leader, members } }, generatedAt, vp }
 * with flat githubUsername/gitlabUsername fields for compatibility.
 *
 * @param {{ readFromStorage: Function }} storage
 * @returns {object|null}
 */
function readRosterFull(storage) {
  const registry = storage.readFromStorage('team-data/registry.json');
  if (!registry || !registry.people) return null;

  const config = loadConfig(storage);
  const orgRootUids = new Set((config?.orgRoots || []).map(r => r.uid));

  // Group active people by orgRoot
  const orgMap = {};
  for (const [uid, person] of Object.entries(registry.people)) {
    if (person.status !== 'active') continue;
    const orgKey = person.orgRoot || 'unknown';
    if (!orgMap[orgKey]) orgMap[orgKey] = { leader: null, members: [] };

    // Transform structured github/gitlab back to flat fields
    const flat = {
      ...person,
      githubUsername: person.github?.username || null,
      gitlabUsername: person.gitlab?.username || null,
    };

    // Leader = person whose uid matches a configured orgRoot
    if (orgRootUids.has(uid)) {
      orgMap[orgKey].leader = flat;
    } else {
      orgMap[orgKey].members.push(flat);
    }
  }

  return {
    orgs: orgMap,
    generatedAt: registry.meta?.generatedAt,
    vp: registry.meta?.vp
  };
}

/**
 * Get a flat array of all people across all orgs.
 * Includes the org key on each person record.
 * @param {{ readFromStorage: Function }} storage
 * @returns {object[]}
 */
function getAllPeople(storage) {
  const full = readRosterFull(storage);
  if (!full || !full.orgs) return [];
  const people = [];
  for (const [orgKey, orgData] of Object.entries(full.orgs)) {
    const allMembers = [orgData.leader, ...orgData.members];
    for (const person of allMembers) {
      if (person) people.push({ ...person, orgKey });
    }
  }
  return people;
}

/**
 * Get people in a specific org.
 * @param {{ readFromStorage: Function }} storage
 * @param {string} orgKey
 * @returns {object[]}
 */
function getPeopleByOrg(storage, orgKey) {
  const full = readRosterFull(storage);
  if (!full || !full.orgs || !full.orgs[orgKey]) return [];
  const orgData = full.orgs[orgKey];
  return [orgData.leader, ...orgData.members]
    .filter(Boolean)
    .map(p => ({ ...p, orgKey }));
}

/**
 * Get list of org keys with display names (leader names as fallback).
 * @param {{ readFromStorage: Function }} storage
 * @returns {{ key: string, displayName: string }[]}
 */
function getOrgKeys(storage) {
  const full = readRosterFull(storage);
  if (!full || !full.orgs) return [];
  return Object.entries(full.orgs).map(([key, orgData]) => ({
    key,
    displayName: orgData.leader?.name || key
  }));
}

/**
 * Collect unique non-empty values of a given field across a list of people.
 * Useful for rolling up fields like engineeringLead or productManager per team.
 * @param {object[]} people
 * @param {string} fieldName
 * @returns {string[]}
 */
function getTeamRollup(people, fieldName) {
  const values = new Set();
  for (const person of people) {
    const val = person[fieldName] || person.customFields?.[fieldName];
    if (val && typeof val === 'string') {
      for (const v of val.split(',')) {
        const trimmed = v.trim();
        if (trimmed) values.add(trimmed);
      }
    }
  }
  return [...values].sort();
}

module.exports = {
  readRosterFull,
  getAllPeople,
  getPeopleByOrg,
  getOrgKeys,
  getTeamRollup,
  getOrgDisplayNames
};
