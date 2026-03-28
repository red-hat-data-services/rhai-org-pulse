/**
 * Merge LDAP org tree with Google Sheets enrichment data.
 * Pure function — does not read/write storage.
 */

const { normalizeNameForMatch } = require('./sheets');

/**
 * Enrich a single person with Sheets data.
 * Dynamically copies all fields from the sheets entry onto the person object.
 *
 * When a person appears in multiple sheets, prefer the entry whose sourceSheet
 * matches the org display name (the org they belong to in LDAP). This avoids
 * stale data from a previous org's sheet overriding the current assignment.
 */
function enrichPerson(person, sheetsMap, orgDisplayName) {
  const normalized = normalizeNameForMatch(person.name);
  const ssData = sheetsMap.get(normalized);
  if (!ssData) return;

  let primary;
  if (Array.isArray(ssData) && orgDisplayName) {
    const orgNameLower = orgDisplayName.toLowerCase();
    const match = ssData.find(e =>
      e.sourceSheet && e.sourceSheet.toLowerCase().includes(orgNameLower)
    );
    primary = match || ssData[0];
  } else {
    primary = Array.isArray(ssData) ? ssData[0] : ssData;
  }

  // Copy all fields from sheet data onto the person (except internal fields)
  for (const [key, value] of Object.entries(primary)) {
    if (key === 'originalName') continue;
    person[key] = value;
  }

  if (Array.isArray(ssData) && ssData.length > 1) {
    person.additionalAssignments = ssData.filter(e => e !== primary).map(function(e) {
      const assignment = {};
      for (const [key, value] of Object.entries(e)) {
        if (key === 'originalName' || key === 'sourceSheet') continue;
        assignment[key] = value;
      }
      return assignment;
    });
  }
}

/**
 * Build the full roster object from LDAP data + Sheets enrichment.
 *
 * @param {Array} orgRoots - Array of { uid, name, displayName }
 * @param {Object} ldapOrgs - Map of uid -> { leader, members }
 * @param {Map} sheetsData - Map of normalized name -> enrichment data (or null)
 * @param {Object} vpInfo - { name, uid } for the VP (optional)
 * @returns {Object} org-roster-full.json format
 */
function buildRoster(orgRoots, ldapOrgs, sheetsData, vpInfo) {
  const roster = {
    generatedAt: new Date().toISOString(),
    vp: vpInfo || null,
    orgs: {}
  };

  for (const root of orgRoots) {
    const orgData = ldapOrgs[root.uid];
    if (!orgData) continue;

    // Enrich with Sheets data if available
    if (sheetsData) {
      const orgDisplayName = root.displayName || root.name;
      enrichPerson(orgData.leader, sheetsData, orgDisplayName);
      for (const member of orgData.members) {
        enrichPerson(member, sheetsData, orgDisplayName);
      }
    }

    roster.orgs[root.uid] = {
      leader: orgData.leader,
      members: orgData.members
    };
  }

  return roster;
}

module.exports = {
  buildRoster,
  enrichPerson
};
