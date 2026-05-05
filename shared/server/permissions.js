/**
 * RBAC permission logic for team structure management.
 * Computes manager subtrees from LDAP hierarchy and provides
 * authorization checks for person-level operations.
 */

// Fields sourced from LDAP that cannot be edited in-app
const LDAP_FIELDS = [
  'uid', 'name', 'email', 'title', 'city', 'country',
  'geo', 'location', 'officeLocation', 'costCenter', 'managerUid'
];

/**
 * Build a map of manager UID -> Set of all managed UIDs (transitive closure).
 * Walks the managerUid chain for every person in the registry.
 * @param {{ people: Object<string, { managerUid?: string }> }} registry
 * @returns {Map<string, Set<string>>}
 */
function buildManagerMap(registry) {
  const map = new Map();
  if (!registry || !registry.people) return map;

  // First pass: build direct reports map
  const directReports = new Map();
  for (const [uid, person] of Object.entries(registry.people)) {
    if (person.status !== 'active') continue;
    const mgr = person.managerUid;
    if (!mgr) continue;
    if (!directReports.has(mgr)) directReports.set(mgr, new Set());
    directReports.get(mgr).add(uid);
  }

  // Second pass: for each manager, compute transitive closure
  for (const managerUid of directReports.keys()) {
    if (!registry.people[managerUid]) continue;
    const managed = new Set();
    const queue = [...directReports.get(managerUid)];
    while (queue.length > 0) {
      const current = queue.pop();
      if (managed.has(current)) continue;
      managed.add(current);
      const subordinates = directReports.get(current);
      if (subordinates) {
        for (const sub of subordinates) {
          if (!managed.has(sub)) queue.push(sub);
        }
      }
    }
    map.set(managerUid, managed);
  }

  return map;
}

/**
 * Get the set of UIDs managed by a given manager (transitive).
 * @param {string} managerUid
 * @param {Map<string, Set<string>>} managerMap
 * @returns {Set<string>}
 */
function getManagedUids(managerUid, managerMap) {
  return managerMap.get(managerUid) || new Set();
}

/**
 * Get direct reports only (one level below).
 * @param {string} managerUid
 * @param {{ people: Object<string, { managerUid?: string }> }} registry
 * @returns {Set<string>}
 */
function getDirectReports(managerUid, registry) {
  const direct = new Set();
  if (!registry || !registry.people) return direct;
  for (const [uid, person] of Object.entries(registry.people)) {
    if (person.status !== 'active') continue;
    if (person.managerUid === managerUid) direct.add(uid);
  }
  return direct;
}

/**
 * Check if a UID is a manager (has at least one active direct report).
 * @param {string} uid
 * @param {{ people: Object<string, { managerUid?: string }> }} registry
 * @returns {boolean}
 */
function isManager(uid, registry) {
  if (!registry || !registry.people) return false;
  for (const person of Object.values(registry.people)) {
    if (person.status !== 'active') continue;
    if (person.managerUid === uid) return true;
  }
  return false;
}

/**
 * Determine a user's permission tier.
 * @param {string|null} uid - The user's UID (null if not in registry)
 * @param {{ people: Object }} registry
 * @param {boolean} isAdminFlag - Whether the user is an admin
 * @param {boolean} [isTeamAdminFlag] - Whether the user is a team admin
 * @returns {'admin'|'team-admin'|'manager'|'user'}
 */
function getPermissionTier(uid, registry, isAdminFlag, isTeamAdminFlag) {
  if (isAdminFlag) return 'admin';
  if (isTeamAdminFlag) return 'team-admin';
  if (!uid) return 'user';
  if (isManager(uid, registry)) return 'manager';
  return 'user';
}

/**
 * Check if an actor can edit a target person.
 * @param {string|null} actorUid
 * @param {string} targetUid
 * @param {boolean} isAdminFlag
 * @param {boolean} isTeamAdminFlag
 * @param {Map<string, Set<string>>} managerMap
 * @returns {boolean}
 */
function canEditPerson(actorUid, targetUid, isAdminFlag, isTeamAdminFlag, managerMap) {
  if (isAdminFlag) return true;
  if (isTeamAdminFlag) return true;
  if (!actorUid) return false;
  const managed = getManagedUids(actorUid, managerMap);
  return managed.has(targetUid);
}

module.exports = {
  LDAP_FIELDS,
  buildManagerMap,
  getManagedUids,
  getDirectReports,
  isManager,
  getPermissionTier,
  canEditPerson
};
