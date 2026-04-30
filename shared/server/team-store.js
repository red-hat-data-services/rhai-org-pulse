/**
 * Team CRUD operations with audit logging.
 * Reads/writes data/team-data/teams.json and updates teamIds on registry persons.
 */

const crypto = require('crypto');
const { appendAuditEntry } = require('./audit-log');

const TEAMS_KEY = 'team-data/teams.json';
const REGISTRY_KEY = 'team-data/registry.json';

/** Guard against prototype pollution via user-controlled object keys. */
function isSafeKey(key) {
  return typeof key === 'string' && !['__proto__', 'constructor', 'prototype'].includes(key);
}

function generateTeamId(existingIds) {
  for (let i = 0; i < 10; i++) {
    const id = 'team_' + crypto.randomBytes(3).toString('hex');
    if (!existingIds.has(id)) return id;
  }
  // Fallback with more bytes
  return 'team_' + crypto.randomBytes(6).toString('hex');
}

function readTeams(storage) {
  return storage.readFromStorage(TEAMS_KEY) || { teams: {} };
}

function writeTeams(storage, data) {
  storage.writeToStorage(TEAMS_KEY, data);
}

/**
 * Create a new team.
 * @returns {object} The created team
 */
function createTeam(storage, name, orgKey, actorEmail) {
  const data = readTeams(storage);
  const existingIds = new Set(Object.keys(data.teams));
  const id = generateTeamId(existingIds);

  const team = {
    id,
    name,
    orgKey,
    createdAt: new Date().toISOString(),
    createdBy: actorEmail,
    metadata: {},
    boards: []
  };

  if (!isSafeKey(id)) throw new Error('Generated team ID is invalid');
  data.teams[id] = team;
  writeTeams(storage, data);

  appendAuditEntry(storage, {
    action: 'team.create',
    actor: actorEmail,
    entityType: 'team',
    entityId: id,
    entityLabel: name,
    detail: `Created team "${name}" in org ${orgKey}`
  });

  return team;
}

/**
 * Rename a team.
 * @returns {object} The updated team
 */
function renameTeam(storage, teamId, newName, actorEmail) {
  if (!isSafeKey(teamId)) return null;
  const data = readTeams(storage);
  const team = data.teams[teamId];
  if (!team) return null;

  const oldName = team.name;
  team.name = newName;
  writeTeams(storage, data);

  appendAuditEntry(storage, {
    action: 'team.rename',
    actor: actorEmail,
    entityType: 'team',
    entityId: teamId,
    entityLabel: newName,
    field: 'name',
    oldValue: oldName,
    newValue: newName,
    detail: `Renamed team from "${oldName}" to "${newName}"`
  });

  return team;
}

/**
 * Delete a team. Removes teamId from all person records.
 */
function deleteTeam(storage, teamId, actorEmail) {
  if (!isSafeKey(teamId)) return null;
  const data = readTeams(storage);
  const team = data.teams[teamId];
  if (!team) return null;

  const teamName = team.name;
  delete data.teams[teamId];
  writeTeams(storage, data);

  // Remove teamId from all persons
  const registry = storage.readFromStorage(REGISTRY_KEY);
  if (registry && registry.people) {
    let changed = false;
    for (const person of Object.values(registry.people)) {
      if (Array.isArray(person.teamIds)) {
        const idx = person.teamIds.indexOf(teamId);
        if (idx !== -1) {
          person.teamIds.splice(idx, 1);
          changed = true;
        }
      }
    }
    if (changed) {
      storage.writeToStorage(REGISTRY_KEY, registry);
    }
  }

  appendAuditEntry(storage, {
    action: 'team.delete',
    actor: actorEmail,
    entityType: 'team',
    entityId: teamId,
    entityLabel: teamName,
    detail: `Deleted team "${teamName}"`
  });

  return { id: teamId, name: teamName };
}

/**
 * Assign a person to a team.
 */
function assignMember(storage, teamId, uid, actorEmail) {
  if (!isSafeKey(teamId)) return { error: 'Invalid team ID' };
  if (!isSafeKey(uid)) return { error: 'Invalid person UID' };
  const data = readTeams(storage);
  if (!data.teams[teamId]) return { error: 'Team not found' };

  const registry = storage.readFromStorage(REGISTRY_KEY);
  if (!registry || !registry.people || !registry.people[uid]) {
    return { error: 'Person not found' };
  }

  const person = registry.people[uid];
  if (!Array.isArray(person.teamIds)) person.teamIds = [];

  if (person.teamIds.includes(teamId)) {
    return { skipped: true, reason: 'Already assigned' };
  }

  person.teamIds.push(teamId);
  storage.writeToStorage(REGISTRY_KEY, registry);

  appendAuditEntry(storage, {
    action: 'person.team.assign',
    actor: actorEmail,
    entityType: 'person',
    entityId: uid,
    entityLabel: person.name,
    field: 'teamIds',
    oldValue: person.teamIds.slice(0, -1),
    newValue: [...person.teamIds],
    detail: `Assigned to team "${data.teams[teamId].name}"`
  });

  return { assigned: true };
}

/**
 * Bulk assign persons to a team. All-or-nothing semantics
 * (permission checking is done by the route handler before calling this).
 * @returns {{ assigned: string[], skipped: string[] }}
 */
function assignMembersBulk(storage, teamId, uids, actorEmail) {
  if (!isSafeKey(teamId)) return { error: 'Invalid team ID' };
  const data = readTeams(storage);
  if (!data.teams[teamId]) return { error: 'Team not found' };

  const registry = storage.readFromStorage(REGISTRY_KEY);
  if (!registry || !registry.people) return { error: 'Registry not found' };

  const assigned = [];
  const skipped = [];

  for (const uid of uids) {
    if (!isSafeKey(uid)) { skipped.push(uid); continue; }
    const person = registry.people[uid];
    if (!person) { skipped.push(uid); continue; }

    if (!Array.isArray(person.teamIds)) person.teamIds = [];
    if (person.teamIds.includes(teamId)) {
      skipped.push(uid);
      continue;
    }

    person.teamIds.push(teamId);
    assigned.push(uid);

    appendAuditEntry(storage, {
      action: 'person.team.assign',
      actor: actorEmail,
      entityType: 'person',
      entityId: uid,
      entityLabel: person.name,
      field: 'teamIds',
      oldValue: person.teamIds.slice(0, -1),
      newValue: [...person.teamIds],
      detail: `Assigned to team "${data.teams[teamId].name}" (bulk)`
    });
  }

  if (assigned.length > 0) {
    storage.writeToStorage(REGISTRY_KEY, registry);
  }

  return { assigned, skipped };
}

/**
 * Unassign a person from a team.
 */
function unassignMember(storage, teamId, uid, actorEmail) {
  if (!isSafeKey(teamId)) return { error: 'Invalid team ID' };
  if (!isSafeKey(uid)) return { error: 'Invalid person UID' };
  const data = readTeams(storage);
  if (!data.teams[teamId]) return { error: 'Team not found' };

  const registry = storage.readFromStorage(REGISTRY_KEY);
  if (!registry || !registry.people || !registry.people[uid]) {
    return { error: 'Person not found' };
  }

  const person = registry.people[uid];
  if (!Array.isArray(person.teamIds)) return { skipped: true, reason: 'Not assigned' };

  const idx = person.teamIds.indexOf(teamId);
  if (idx === -1) return { skipped: true, reason: 'Not assigned' };

  const oldTeamIds = [...person.teamIds];
  person.teamIds.splice(idx, 1);
  storage.writeToStorage(REGISTRY_KEY, registry);

  appendAuditEntry(storage, {
    action: 'person.team.unassign',
    actor: actorEmail,
    entityType: 'person',
    entityId: uid,
    entityLabel: person.name,
    field: 'teamIds',
    oldValue: oldTeamIds,
    newValue: [...person.teamIds],
    detail: `Unassigned from team "${data.teams[teamId].name}"`
  });

  return { unassigned: true };
}

/**
 * Get unassigned people based on scope.
 * @param {object} storage
 * @param {'direct'|'org'|'all'} scope
 * @param {string|null} actorUid
 * @param {boolean} isAdmin
 * @param {Map} managerMap
 * @param {object} registry
 * @returns {object[]}
 */
function getUnassigned(storage, scope, actorUid, isAdmin, managerMap, registry) {
  if (!registry || !registry.people) return [];

  const { getManagedUids } = require('./permissions');

  const unassigned = [];
  for (const [uid, person] of Object.entries(registry.people)) {
    if (person.status !== 'active') continue;
    const hasTeams = Array.isArray(person.teamIds) && person.teamIds.length > 0;
    if (hasTeams) continue;

    // Apply scope filter
    if (scope === 'all') {
      if (!isAdmin) continue;
    } else if (scope === 'direct') {
      if (!actorUid) continue;
      if (person.managerUid !== actorUid) continue;
    } else if (scope === 'org') {
      if (!actorUid) continue;
      const managed = getManagedUids(actorUid, managerMap);
      if (!managed.has(uid)) continue;
    } else {
      // Unknown scope — skip all (safe default)
      continue;
    }

    unassigned.push(person);
  }

  return unassigned;
}

/**
 * Update team-level field values.
 */
function updateTeamFields(storage, teamId, fields, actorEmail) {
  if (!isSafeKey(teamId)) return null;
  const data = readTeams(storage);
  const team = data.teams[teamId];
  if (!team) return null;

  if (!team.metadata) team.metadata = Object.create(null);

  for (const [fieldId, value] of Object.entries(fields)) {
    if (!isSafeKey(fieldId)) {
      throw new Error(`Invalid field key: ${fieldId}`);
    }
    const oldValue = team.metadata[fieldId] || null;
    team.metadata[fieldId] = value;

    appendAuditEntry(storage, {
      action: 'team.field.update',
      actor: actorEmail,
      entityType: 'team',
      entityId: teamId,
      entityLabel: team.name,
      field: fieldId,
      oldValue,
      newValue: value
    });
  }

  writeTeams(storage, data);
  return team;
}

/**
 * Update a team's boards array (replace semantics).
 * @param {object} storage
 * @param {string} teamId
 * @param {Array<{ url: string, name?: string }>} boards
 * @param {string} actorEmail
 * @returns {object|null} The updated boards array, or null if team not found
 */
const MAX_BOARDS = 50;
const MAX_URL_LENGTH = 2048;
const MAX_NAME_LENGTH = 200;

function isValidBoardUrl(url) {
  return typeof url === 'string' && (url.startsWith('https://') || url.startsWith('http://'));
}

function updateTeamBoards(storage, teamId, boards, actorEmail) {
  if (!isSafeKey(teamId)) return null;
  const data = readTeams(storage);
  const team = data.teams[teamId];
  if (!team) return null;

  if (boards.length > MAX_BOARDS) {
    throw new Error(`boards array exceeds maximum of ${MAX_BOARDS} entries`);
  }

  // Validate and normalize board entries
  for (const b of boards) {
    if (!isValidBoardUrl(b.url)) {
      throw new Error('Each board url must start with https:// or http://');
    }
    if (b.url.length > MAX_URL_LENGTH) {
      throw new Error(`Board url exceeds maximum length of ${MAX_URL_LENGTH} characters`);
    }
  }

  const normalized = boards.map(b => ({
    url: b.url,
    name: typeof b.name === 'string' ? b.name.slice(0, MAX_NAME_LENGTH) : ''
  }));

  const oldBoards = team.boards || [];
  team.boards = normalized;
  writeTeams(storage, data);

  appendAuditEntry(storage, {
    action: 'team.boards.update',
    actor: actorEmail,
    entityType: 'team',
    entityId: teamId,
    entityLabel: team.name,
    field: 'boards',
    oldValue: oldBoards,
    newValue: normalized,
    detail: `Updated boards for team "${team.name}" (${normalized.length} boards)`
  });

  return normalized;
}

module.exports = {
  readTeams,
  writeTeams,
  createTeam,
  renameTeam,
  deleteTeam,
  assignMember,
  assignMembersBulk,
  unassignMember,
  getUnassigned,
  updateTeamFields,
  updateTeamBoards,
  generateTeamId,
  TEAMS_KEY,
  REGISTRY_KEY
};
