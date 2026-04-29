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
 * Split a string that may contain multiple concatenated names (from Google Sheets
 * smart chips entered without commas) into individual names by matching against
 * a set of known roster names.
 *
 * Uses greedy longest-first matching from left to right. Falls back to returning
 * the original string if no roster names match.
 *
 * @param {string} text - The possibly-concatenated name string
 * @param {Set<string>} knownNames - Set of all known roster names
 * @returns {string[]}
 */
function splitByKnownNames(text, knownNames) {
  if (knownNames.has(text)) return [text];

  const candidates = [...knownNames]
    .filter(name => text.includes(name))
    .sort((a, b) => b.length - a.length);

  if (candidates.length === 0) return [text];

  const result = [];
  let remaining = text.trim();

  while (remaining.length > 0) {
    let found = false;
    for (const name of candidates) {
      if (remaining.startsWith(name)) {
        result.push(name);
        remaining = remaining.substring(name.length).trim();
        found = true;
        break;
      }
    }
    if (!found) {
      return [text];
    }
  }

  return result.length > 0 ? result : [text];
}

/**
 * Collect unique non-empty values of a given field across a list of people.
 * Useful for rolling up fields like engineeringLead or productManager per team.
 *
 * When knownNames is provided, comma-separated tokens that don't match a known
 * name are further split by matching against roster names (handles Google Sheets
 * smart chip concatenation without commas).
 *
 * @param {object[]} people
 * @param {string} fieldName
 * @param {Set<string>} [knownNames] - Optional set of all roster names for smart-chip splitting
 * @returns {string[]}
 */
function getTeamRollup(people, fieldName, knownNames) {
  const values = new Set();
  for (const person of people) {
    const val = person[fieldName] || person.customFields?.[fieldName];
    if (val && typeof val === 'string') {
      for (const v of val.split(',')) {
        const trimmed = v.trim();
        if (trimmed) {
          if (knownNames && knownNames.size > 0) {
            for (const name of splitByKnownNames(trimmed, knownNames)) {
              values.add(name);
            }
          } else {
            values.add(trimmed);
          }
        }
      }
    }
  }
  return [...values].sort();
}

/**
 * Discover real names from role field values (e.g. engineeringLead, productManager)
 * by iteratively building a known-names set. Handles the case where role holders
 * (like PMs) aren't in the LDAP roster but their names appear in field values.
 *
 * Sorts comma-separated tokens by length (shortest first) so atomic names are
 * discovered before concatenations. A token that can be decomposed into already-known
 * names is a concatenation; one that can't is a new name.
 *
 * @param {object[]} allPeople
 * @param {string[]} fieldNames - Fields to scan (e.g. ['engineeringLead', 'productManager'])
 * @param {Set<string>} existingNames - Seed names (e.g. roster names)
 * @returns {Set<string>} Union of existing + discovered names
 */
function collectRoleNames(allPeople, fieldNames, existingNames) {
  const allTokens = new Set();

  for (const p of allPeople) {
    for (const field of fieldNames) {
      const val = p[field] || p.customFields?.[field];
      if (val && typeof val === 'string') {
        for (const v of val.split(',')) {
          const trimmed = v.trim();
          if (trimmed) allTokens.add(trimmed);
        }
      }
    }
  }

  const sorted = [...allTokens].sort((a, b) => a.length - b.length);
  const discovered = new Set(existingNames);

  for (const token of sorted) {
    if (discovered.has(token)) continue;
    const result = splitByKnownNames(token, discovered);
    if (result.length <= 1) {
      discovered.add(token);
    }
  }

  return discovered;
}

module.exports = {
  readRosterFull,
  getAllPeople,
  getPeopleByOrg,
  getOrgKeys,
  getTeamRollup,
  splitByKnownNames,
  collectRoleNames,
  getOrgDisplayNames
};
