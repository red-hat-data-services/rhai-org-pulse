/**
 * Org roster metadata sync and team derivation.
 * Optionally fetches team-level data from a configurable spreadsheet tab
 * and component mapping. When no sheet is configured or the fetch fails,
 * teams are derived from people's _teamGrouping values in the roster.
 *
 * People data comes from shared/server/roster.js (reads team-data/registry.json
 * and transforms to legacy roster format).
 */

const { fetchRawSheet } = require('../../../shared/server/google-sheets');
const { getOrgDisplayNames } = require('../../../shared/server/roster-sync/config');
const { getAllPeople } = require('../../../shared/server/roster');

/**
 * Parse the "Scrum Team Boards" tab into team metadata objects.
 * Columns: Organization, Scrum Team Name, JIRA Board, PM
 * (headcount role columns are ignored — calculated dynamically from people data)
 */
function parseTeamBoardsTab(headers, rows) {
  if (!headers || headers.length === 0) return [];

  const teams = [];
  const colIdx = {};
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].toLowerCase();
    if (h === 'organization') colIdx.org = i;
    else if (h === 'scrum team name') colIdx.teamName = i;
    else if (h === 'jira board') colIdx.board = i;
  }

  if (colIdx.org === undefined || colIdx.teamName === undefined) {
    console.warn('[org-roster sync] Scrum Team Boards tab missing required columns');
    return [];
  }

  // Track last-seen org for merged cells (spreadsheet only fills org in the first row of each section)
  let lastOrg = '';
  for (const row of rows) {
    const orgCell = row[colIdx.org];
    if (orgCell) lastOrg = String(orgCell).trim();
    const teamName = row[colIdx.teamName];
    if (!lastOrg || !teamName) continue;

    const boardRaw = row[colIdx.board] || '';
    const boardUrls = String(boardRaw).split(/[\n\r]+/).map(u => u.trim()).filter(Boolean);

    teams.push({
      org: lastOrg,
      name: String(teamName).trim(),
      boardUrls,
    });
  }

  return teams;
}

/**
 * Parse "Summary components per team" tab.
 * Layout: Row 0 has org names as headers (AI platform, AAET, etc.) with empty columns between.
 * Row 1 has column labels (Team, Component(s)) repeated for each org section.
 * Row 2+ has the actual data.
 * Returns a map of component name -> team name(s).
 */
function parseComponentsTab(headers, rows) {
  if (!headers || headers.length === 0 || rows.length === 0) return {};

  const components = {};

  // The actual column labels (Team, Component(s)) are in the first data row
  // The header row contains org names
  const labelRow = rows[0];
  const dataRows = rows.slice(1);

  // Find all team/component column pairs from the label row
  const columnPairs = []; // [{ teamIdx, compIdx, org }]
  for (let i = 0; i < labelRow.length; i++) {
    const label = (labelRow[i] || '').toLowerCase().trim();
    if (label.includes('team') || label.includes('scrum')) {
      // Look for a component column as the next column
      for (let j = i + 1; j < Math.min(i + 3, labelRow.length); j++) {
        const lj = (labelRow[j] || '').toLowerCase().trim();
        if (lj.includes('component')) {
          // Org name comes from the header row at this column position (or nearby)
          let org = '';
          for (let k = i; k >= 0; k--) {
            if (headers[k] && String(headers[k]).trim()) {
              org = String(headers[k]).trim();
              break;
            }
          }
          columnPairs.push({ teamIdx: i, compIdx: j, org });
          break;
        }
      }
    }
  }

  // Fallback: if no label row pattern found, try headers directly
  if (columnPairs.length === 0) {
    for (let i = 0; i < headers.length; i++) {
      const h = (headers[i] || '').toLowerCase().trim();
      if ((h.includes('team') || h.includes('scrum'))) {
        for (let j = i + 1; j < Math.min(i + 3, headers.length); j++) {
          const hj = (headers[j] || '').toLowerCase().trim();
          if (hj.includes('component')) {
            columnPairs.push({ teamIdx: i, compIdx: j, org: '' });
            break;
          }
        }
      }
    }
    // Use all rows as data in fallback mode
    if (columnPairs.length > 0) {
      return parseComponentRows(columnPairs, rows, components);
    }
  }

  if (columnPairs.length === 0) return {};

  return parseComponentRows(columnPairs, dataRows, components);
}

function parseComponentRows(columnPairs, rows, components) {
  // Track which column pairs have hit an empty row (end of their section).
  // The spreadsheet has multiple sections (Team→Components, PM→Components,
  // Component→Teams) separated by empty rows. We only want the first section.
  const stopped = new Set();

  for (const row of rows) {
    for (const pair of columnPairs) {
      if (stopped.has(pair)) continue;
      const { teamIdx, compIdx } = pair;

      const teamRaw = row[teamIdx] ? String(row[teamIdx]).trim() : '';
      const compRaw = row[compIdx] ? String(row[compIdx]).trim() : '';

      // Empty row for this column pair — stop processing this section
      if (!teamRaw && !compRaw) {
        stopped.add(pair);
        continue;
      }

      if (!compRaw || !teamRaw) continue;

      // Components can be comma-separated
      const compNames = compRaw.split(',').map(c => c.trim()).filter(Boolean);

      for (const compName of compNames) {
        if (!components[compName]) {
          components[compName] = [];
        }
        if (!components[compName].includes(teamRaw)) {
          components[compName].push(teamRaw);
        }
      }
    }
  }

  return components;
}

/**
 * Calculate headcount and FTE from people data.
 * A person on multiple teams counts as 1/N FTE per team.
 * teamCount comes from scrumTeams array length or miroTeam field.
 */
function calculateHeadcountByRole(people) {
  const headcount = {};
  const fte = {};
  let totalHeadcount = 0;
  let totalFte = 0;

  for (const person of people) {
    const role = person.engineeringSpeciality || person.specialty || 'Unspecified';
    headcount[role] = (headcount[role] || 0) + 1;
    totalHeadcount++;

    // FTE: if a person is on multiple teams, they're split
    const miroTeam = person._teamGrouping || person.miroTeam || '';
    const teamCount = miroTeam ? miroTeam.split(',').filter(t => t.trim()).length : 1;
    const personFte = 1 / Math.max(teamCount, 1);
    fte[role] = (fte[role] || 0) + personFte;
    totalFte += personFte;
  }

  return {
    byRole: headcount,
    byRoleFte: Object.fromEntries(
      Object.entries(fte).map(([k, v]) => [k, Math.round(v * 100) / 100])
    ),
    totalHeadcount,
    totalFte: Math.round(totalFte * 100) / 100
  };
}

/**
 * Extract the numeric board ID from a Jira board URL.
 * e.g. "https://redhat.atlassian.net/jira/software/c/projects/RHOAIENG/boards/1103" -> "1103"
 */
function extractBoardId(url) {
  const match = url.match(/\/boards\/(\d+)/);
  return match ? match[1] : null;
}

/**
 * Fetch board names from Jira Agile API for all unique board URLs across teams.
 * Returns a map of boardUrl -> boardName.
 */
async function resolveBoardNames(teams) {
  const fetch = require('node-fetch');
  const token = process.env.JIRA_TOKEN;
  const email = process.env.JIRA_EMAIL;
  if (!token || !email) {
    console.warn('[org-roster sync] JIRA_TOKEN or JIRA_EMAIL not set, skipping board name resolution');
    return {};
  }

  const auth = Buffer.from(`${email}:${token}`).toString('base64');
  const host = process.env.JIRA_HOST || 'https://redhat.atlassian.net';

  // Collect unique board URLs
  const urlToId = {};
  for (const team of teams) {
    for (const url of team.boardUrls || []) {
      const id = extractBoardId(url);
      if (id) urlToId[url] = id;
    }
  }

  const urlToName = {};
  const entries = Object.entries(urlToId);
  console.log(`[org-roster sync] Found ${entries.length} unique board URLs to resolve`);
  if (entries.length === 0) return urlToName;

  const BATCH_SIZE = 5;
  const BATCH_DELAY = 500;

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async ([url, boardId]) => {
        try {
          const res = await fetch(`${host}/rest/agile/1.0/board/${boardId}`, {
            headers: {
              'Authorization': `Basic ${auth}`,
              'Accept': 'application/json'
            }
          });
          if (res.ok) {
            const data = await res.json();
            return [url, data.name || null];
          }
          // Log detailed error for debugging
          const text = await res.text().catch(() => '');
          console.warn(`[org-roster sync] Board ${boardId}: HTTP ${res.status} ${text.slice(0, 200)}`);
        } catch (err) {
          console.warn(`[org-roster sync] Board ${boardId} fetch error: ${err.message}`);
        }
        return [url, null];
      })
    );
    for (const [url, name] of results) {
      if (name) urlToName[url] = name;
    }
    if (i + BATCH_SIZE < entries.length) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
    }
  }

  return urlToName;
}

/**
 * Derive teams from people's _teamGrouping (or miroTeam) values.
 * Used as a fallback when no team-boards spreadsheet tab is configured or available.
 */
function deriveTeamsFromPeople(storage) {
  const allPeople = getAllPeople(storage);
  const orgDisplayNames = getOrgDisplayNames(storage);
  const teamSet = new Map();

  for (const person of allPeople) {
    const org = orgDisplayNames[person.orgKey] || '';
    if (!org) continue;
    const grouping = person._teamGrouping || person.miroTeam || '';
    const teamNames = grouping.split(',').map(t => t.trim()).filter(Boolean);
    for (const teamName of teamNames) {
      const key = `${org}::${teamName}`;
      if (!teamSet.has(key)) {
        teamSet.set(key, { org, name: teamName, boardUrls: [] });
      }
    }
  }

  return [...teamSet.values()];
}

/**
 * Run a sync of metadata tabs from Google Sheets.
 * Does NOT sync people (those come from team-tracker's roster-sync via shared/server/roster.js).
 * sheetId may be null — in that case, teams are derived from people data.
 */
async function runSync(storage, sheetId, config) {
  const teamBoardsTab = config?.teamBoardsTab || null;
  const componentsTab = config?.componentsTab || null;
  const orgNameMapping = config?.orgNameMapping || {};

  console.log('[org-roster sync] Starting metadata sync...');

  // 0. Determine which orgs are configured
  const orgDisplayNames = getOrgDisplayNames(storage);
  const configuredOrgNames = new Set(Object.values(orgDisplayNames));
  if (configuredOrgNames.size === 0) {
    console.warn('[org-roster sync] No org roots configured — sync will include all orgs from sheet');
  }

  // 1. Fetch and parse Scrum Team Boards (conditional + try/catch)
  let rawTeams = [];
  if (teamBoardsTab && sheetId) {
    try {
      console.log(`[org-roster sync] Fetching "${teamBoardsTab}"...`);
      const boardData = await fetchRawSheet(sheetId, teamBoardsTab);
      const allTeams = parseTeamBoardsTab(boardData.headers, boardData.rows);
      console.log(`[org-roster sync] Found ${allTeams.length} teams in sheet`);

      // 2. Map sheet org names and filter to configured orgs
      if (configuredOrgNames.size > 0) {
        const skippedOrgs = new Set();
        for (const team of allTeams) {
          const mappedOrg = orgNameMapping[team.org] || team.org;
          if (configuredOrgNames.has(mappedOrg)) {
            rawTeams.push({ ...team, org: mappedOrg });
          } else {
            skippedOrgs.add(team.org);
          }
        }
        if (skippedOrgs.size > 0) {
          console.log(`[org-roster sync] Skipped unconfigured orgs: ${[...skippedOrgs].join(', ')}`);
        }
        console.log(`[org-roster sync] Kept ${rawTeams.length} teams in ${configuredOrgNames.size} configured orgs`);
      } else {
        rawTeams = allTeams;
      }
    } catch (err) {
      console.warn(`[org-roster sync] Failed to fetch team boards tab: ${err.message}`);
    }
  }

  // Fallback: derive teams from people data
  if (rawTeams.length === 0) {
    rawTeams = deriveTeamsFromPeople(storage);
    console.log(`[org-roster sync] Derived ${rawTeams.length} teams from people data`);
  }

  // 3. Fetch and parse component mapping, filtered to kept teams
  const keptTeamNames = new Set(rawTeams.map(t => t.name));
  let componentMap = {};
  if (componentsTab && sheetId) {
    try {
      console.log(`[org-roster sync] Fetching "${componentsTab}"...`);
      const compData = await fetchRawSheet(sheetId, componentsTab);
      const allComponents = parseComponentsTab(compData.headers, compData.rows);
      // Filter to only components associated with kept teams
      for (const [comp, teamNames] of Object.entries(allComponents)) {
        const filtered = teamNames.filter(t => keptTeamNames.has(t));
        if (filtered.length > 0) {
          componentMap[comp] = filtered;
        }
      }
      console.log(`[org-roster sync] Found ${Object.keys(componentMap).length} components (filtered from ${Object.keys(allComponents).length})`);
    } catch (err) {
      console.warn(`[org-roster sync] Failed to fetch components tab: ${err.message}`);
    }
  }

  // 4. Resolve Jira board names (only if any team has URLs)
  let boardNames = {};
  if (rawTeams.some(t => t.boardUrls.length > 0)) {
    try {
      console.log('[org-roster sync] Resolving Jira board names...');
      boardNames = await resolveBoardNames(rawTeams);
      console.log(`[org-roster sync] Resolved ${Object.keys(boardNames).length} board names`);
    } catch (err) {
      console.warn(`[org-roster sync] Failed to resolve board names: ${err.message}`);
    }
  }

  // 5. Write metadata files
  storage.writeToStorage('org-roster/teams-metadata.json', {
    fetchedAt: new Date().toISOString(),
    boardNames,
    teams: rawTeams
  });

  storage.writeToStorage('org-roster/components.json', {
    fetchedAt: new Date().toISOString(),
    components: componentMap
  });

  storage.writeToStorage('org-roster/sync-status.json', {
    lastSyncAt: new Date().toISOString(),
    status: 'success',
    error: null,
    teamCount: rawTeams.length,
    componentCount: Object.keys(componentMap).length
  });

  console.log(`[org-roster sync] Complete: ${rawTeams.length} teams, ${Object.keys(componentMap).length} components`);

  return {
    status: 'success',
    teamCount: rawTeams.length,
    componentCount: Object.keys(componentMap).length
  };
}

module.exports = {
  runSync,
  parseTeamBoardsTab,
  parseComponentsTab,
  calculateHeadcountByRole,
  deriveTeamsFromPeople,
};
