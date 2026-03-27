/**
 * Org Roster export hook for anonymized test data.
 *
 * Handles: org-roster/config.json, org-roster/teams-metadata.json,
 * org-roster/components.json, org-roster/rfe-backlog.json, org-roster/sync-status.json
 */

module.exports = async function orgRosterExport(addFile, storage, mapping) {
  const { readFromStorage } = storage;

  // 1. org-roster/config.json
  exportConfig(addFile, readFromStorage, mapping);

  // 2. org-roster/teams-metadata.json
  exportTeamsMetadata(addFile, readFromStorage, mapping);

  // 3. org-roster/components.json (pass through as-is, no PII)
  const components = readFromStorage('org-roster/components.json');
  if (components) {
    addFile('org-roster/components.json', components);
  }

  // 4. org-roster/rfe-backlog.json
  exportRfeBacklog(addFile, readFromStorage, mapping);

  // 5. org-roster/sync-status.json (pass through as-is)
  const syncStatus = readFromStorage('org-roster/sync-status.json');
  if (syncStatus) {
    addFile('org-roster/sync-status.json', syncStatus);
  }
};

function exportConfig(addFile, readFromStorage, mapping) {
  const data = readFromStorage('org-roster/config.json');
  if (!data) return;

  const anonymized = { ...data };

  // Map orgNameMapping keys (UIDs) and values (names)
  if (anonymized.orgNameMapping && typeof anonymized.orgNameMapping === 'object') {
    const newMapping = {};
    for (const [uid, name] of Object.entries(anonymized.orgNameMapping)) {
      const fakeUid = mapping.getOrCreateUidMapping(uid);
      const fakeName = typeof name === 'string' ? mapping.getOrCreateNameMapping(name) : name;
      newMapping[fakeUid] = fakeName;
    }
    anonymized.orgNameMapping = newMapping;
  }

  // Anonymize jiraProject
  if (anonymized.jiraProject) {
    anonymized.jiraProject = 'TESTPROJECT';
  }

  addFile('org-roster/config.json', anonymized);
}

function exportTeamsMetadata(addFile, readFromStorage, mapping) {
  const data = readFromStorage('org-roster/teams-metadata.json');
  if (!data) return;

  const anonymized = { ...data };
  let boardCounter = 0;

  if (anonymized.teams && Array.isArray(anonymized.teams)) {
    anonymized.teams = anonymized.teams.map(team => {
      const result = { ...team };

      // Map org field values (these are display names from orgNameMapping, not UIDs)
      // Since org names in teams-metadata come from the sheet, they may be mapped via
      // orgNameMapping. We check if the value is a known name and map it.
      if (result.org) {
        result.org = mapping.anonymizeValue(result.org) || result.org;
      }

      // Anonymize pms names
      if (result.pms && Array.isArray(result.pms)) {
        result.pms = result.pms.map(name => mapping.getOrCreateNameMapping(name));
      }

      // Anonymize board URLs
      if (result.boardUrls && Array.isArray(result.boardUrls)) {
        result.boardUrls = result.boardUrls.map(() => {
          boardCounter++;
          return mapping.anonymizeBoardUrl(null, boardCounter);
        });
      }

      return result;
    });
  }

  // Anonymize boardNames map if present
  if (anonymized.boardNames) {
    anonymized.boardNames = {};
  }

  addFile('org-roster/teams-metadata.json', anonymized);
}

function exportRfeBacklog(addFile, readFromStorage, mapping) {
  const data = readFromStorage('org-roster/rfe-backlog.json');
  if (!data) return;

  const anonymized = { ...data };

  // Map org-key part of byTeam composite keys
  if (anonymized.byTeam && typeof anonymized.byTeam === 'object') {
    const newByTeam = {};
    for (const [compositeKey, value] of Object.entries(anonymized.byTeam)) {
      const sepIdx = compositeKey.indexOf('::');
      if (sepIdx !== -1) {
        const orgPart = compositeKey.substring(0, sepIdx);
        const teamPart = compositeKey.substring(sepIdx + 2);
        const fakeOrgPart = mapping.anonymizeValue(orgPart) || orgPart;
        newByTeam[`${fakeOrgPart}::${teamPart}`] = value;
      } else {
        newByTeam[compositeKey] = value;
      }
    }
    anonymized.byTeam = newByTeam;
  }

  addFile('org-roster/rfe-backlog.json', anonymized);
}
