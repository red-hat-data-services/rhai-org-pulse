const { getDirectReports, buildManagerMap, getManagedUids } = require('../../../shared/server/permissions');

/**
 * Compute the teams a manager has purview over based on their
 * direct reports' team assignments.
 * @param {string} managerUid
 * @param {object} registry - { people: { uid: { managerUid, teamIds, _appFields, ... } } }
 * @param {object} teamsData - { teams: { teamId: { id, name, orgKey, metadata, ... } } }
 * @param {object} [options]
 * @param {boolean} [options.includeIndirect=false] - Include indirect reports (transitive closure)
 * @returns {{ directReportUids: string[], indirectReportUids?: string[], teams: Array<{ id, name, orgKey, directReportUids: string[], totalMemberCount: number, metadata: object, boards: Array }> }}
 */
function getManagerPurview(managerUid, registry, teamsData, options = {}) {
  const directReportUidSet = getDirectReports(managerUid, registry);
  const directReportUids = [...directReportUidSet];

  let indirectReportUids;
  if (options.includeIndirect) {
    const managerMap = buildManagerMap(registry);
    const allManaged = getManagedUids(managerUid, managerMap);
    indirectReportUids = [...allManaged].filter(uid => !directReportUidSet.has(uid));
  }

  // All report UIDs to consider for team building
  const allReportUids = options.includeIndirect
    ? [...directReportUids, ...indirectReportUids]
    : directReportUids;

  if (!teamsData || !teamsData.teams) {
    const result = { directReportUids, teams: [] };
    if (options.includeIndirect) result.indirectReportUids = indirectReportUids;
    return result;
  }

  // Build a map: teamId -> list of direct report UIDs on that team
  const teamDirectReports = new Map();
  for (const uid of directReportUids) {
    const person = registry.people[uid];
    if (!person || !Array.isArray(person.teamIds)) continue;
    for (const teamId of person.teamIds) {
      if (!teamDirectReports.has(teamId)) {
        teamDirectReports.set(teamId, []);
      }
      teamDirectReports.get(teamId).push(uid);
    }
  }

  // Track which teams have any reports (direct or indirect) for team inclusion
  const teamsWithReports = new Set();
  for (const uid of allReportUids) {
    const person = registry.people[uid];
    if (!person || !Array.isArray(person.teamIds)) continue;
    for (const teamId of person.teamIds) {
      teamsWithReports.add(teamId);
    }
  }

  // Build a map: teamId -> total member count (all people assigned to the team)
  const teamMemberCounts = new Map();
  if (registry && registry.people) {
    for (const person of Object.values(registry.people)) {
      if (person.status !== 'active') continue;
      if (!Array.isArray(person.teamIds)) continue;
      for (const teamId of person.teamIds) {
        teamMemberCounts.set(teamId, (teamMemberCounts.get(teamId) || 0) + 1);
      }
    }
  }

  // Build the teams array from teams where at least one report is assigned
  const teams = [];
  for (const teamId of teamsWithReports) {
    const teamObj = teamsData.teams[teamId];
    if (!teamObj) continue;
    teams.push({
      id: teamObj.id,
      name: teamObj.name,
      orgKey: teamObj.orgKey,
      directReportUids: teamDirectReports.get(teamId) || [],
      totalMemberCount: teamMemberCounts.get(teamId) || 0,
      metadata: teamObj.metadata || {},
      boards: teamObj.boards || []
    });
  }

  const result = { directReportUids, teams };
  if (options.includeIndirect) result.indirectReportUids = indirectReportUids;
  return result;
}

module.exports = { getManagerPurview };
