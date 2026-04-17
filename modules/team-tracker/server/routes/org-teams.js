/**
 * Org team metadata routes for team-tracker.
 * Absorbed from modules/org-roster: team enrichment, RFE backlog,
 * sheets sync, components, and org-level config.
 */

const { runSync, calculateHeadcountByRole, parseTeamBoardsTab } = require('../org-sync');
const { fetchAllRfeBacklog } = require('../rfe');
const { getAllPeople, getTeamRollup } = require('../../../../shared/server/roster');
const { getOrgDisplayNames } = require('../../../../shared/server/roster-sync/config');
const { fetchRawSheet } = require('../../../../shared/server/google-sheets');

let orgSyncInProgress = false;
let orgDailyTimer = null;
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

module.exports = function registerOrgTeamsRoutes(router, context) {
  const { storage, requireAdmin } = context;
  const { readFromStorage, writeToStorage } = storage;
  const DEMO_MODE = process.env.DEMO_MODE === 'true';

  function getSheetId() {
    const config = readFromStorage('roster-sync-config.json');
    return config?.googleSheetId || null;
  }

  function getOrgConfig() {
    return readFromStorage('org-roster/config.json') || {
      teamBoardsTab: 'Scrum Team Boards',
      componentsTab: 'Summary: components per team',
      jiraProject: 'RHAIRFE',
      rfeIssueType: 'Feature Request',
      orgNameMapping: {},
      componentMapping: {}
    };
  }

  function buildOrgKeyToDisplayName() {
    return getOrgDisplayNames(storage);
  }

  function groupPeopleByOrgTeam(allPeople, orgKeyToDisplay) {
    const map = {};
    for (const person of allPeople) {
      const orgDisplay = orgKeyToDisplay[person.orgKey] || '';
      const groupingValue = person._teamGrouping || person.miroTeam || '';
      const teamNames = groupingValue ? groupingValue.split(',').map(t => t.trim()).filter(Boolean) : [];
      for (const teamName of teamNames) {
        const compositeKey = `${orgDisplay}::${teamName}`;
        if (!map[compositeKey]) map[compositeKey] = [];
        map[compositeKey].push(person);
      }
    }
    return map;
  }

  function buildEnrichedTeams(orgFilter) {
    const metaData = readFromStorage('org-roster/teams-metadata.json');
    const compData = readFromStorage('org-roster/components.json');
    const componentMap = compData?.components || {};

    if (!metaData || !metaData.teams) return { teams: [], fetchedAt: null };

    const boardNames = metaData.boardNames || {};
    let rawTeams = metaData.teams;
    if (orgFilter) rawTeams = rawTeams.filter(t => t.org === orgFilter);

    const allPeople = getAllPeople(storage);
    const orgKeyToDisplay = buildOrgKeyToDisplayName();
    const orgTeamPeopleMap = groupPeopleByOrgTeam(allPeople, orgKeyToDisplay);

    const teams = rawTeams.map(function(team) {
      const compositeKey = `${team.org}::${team.name}`;
      const teamPeople = orgTeamPeopleMap[compositeKey] || [];
      const counts = calculateHeadcountByRole(teamPeople);

      const components = [];
      for (const [comp, teamNames] of Object.entries(componentMap)) {
        if (teamNames.includes(team.name)) components.push(comp);
      }

      const engLeads = getTeamRollup(teamPeople, 'engineeringLead');
      const productManagers = getTeamRollup(teamPeople, 'productManager');

      const filterCounts = {};
      for (const p of teamPeople) {
        const filter = p.jiraFilter || p.customFields?.jiraFilter;
        if (filter) filterCounts[filter] = (filterCounts[filter] || 0) + 1;
      }
      const jiraFilter = Object.entries(filterCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

      const boards = (team.boardUrls || []).map(url => ({ url, name: boardNames[url] || null }));

      return { ...team, boards, engLeads, productManagers, headcount: counts, components, memberCount: teamPeople.length, jiraFilter };
    });

    return { teams, fetchedAt: metaData.fetchedAt };
  }

  // ─── GET /org-teams ───

  router.get('/org-teams', function(req, res) {
    try {
      const { teams, fetchedAt } = buildEnrichedTeams(req.query.org);
      const rfeData = readFromStorage('org-roster/rfe-backlog.json');
      const enriched = rfeData ? teams.map(function(t) {
        const teamKey = `${t.org}::${t.name}`;
        const rfe = rfeData.byTeam?.[teamKey];
        return { ...t, rfeCount: rfe?.count || 0 };
      }) : teams;
      res.json({ teams: enriched, fetchedAt });
    } catch (error) {
      console.error('[team-tracker] GET /org-teams error:', error);
      res.status(500).json({ error: 'Failed to load team data' });
    }
  });

  // ─── GET /org-teams/:teamKey ───

  router.get('/org-teams/:teamKey', function(req, res) {
    try {
      const teamKey = decodeURIComponent(req.params.teamKey);
      const sepIdx = teamKey.indexOf('::');
      if (sepIdx === -1) return res.status(400).json({ error: 'teamKey must be org::teamName format' });

      const orgName = teamKey.substring(0, sepIdx);
      const teamName = teamKey.substring(sepIdx + 2);
      const { teams } = buildEnrichedTeams(orgName);
      const team = teams.find(t => t.name === teamName);
      if (!team) return res.status(404).json({ error: 'Team not found' });

      const rfeData = readFromStorage('org-roster/rfe-backlog.json');
      const rfe = rfeData?.byTeam?.[teamKey];
      res.json({ ...team, rfeCount: rfe?.count || 0, rfeIssues: rfe?.issues || [] });
    } catch (error) {
      console.error('[team-tracker] GET /org-teams/:teamKey error:', error);
      res.status(500).json({ error: 'Failed to load team detail' });
    }
  });

  // ─── GET /org-teams/:teamKey/members ───

  router.get('/org-teams/:teamKey/members', function(req, res) {
    try {
      const teamKey = decodeURIComponent(req.params.teamKey);
      const sepIdx = teamKey.indexOf('::');
      if (sepIdx === -1) return res.status(400).json({ error: 'teamKey must be org::teamName format' });

      const orgName = teamKey.substring(0, sepIdx);
      const teamName = teamKey.substring(sepIdx + 2);
      const allPeople = getAllPeople(storage);
      const orgKeyToDisplay = buildOrgKeyToDisplayName();
      const members = allPeople.filter(function(person) {
        const personOrg = orgKeyToDisplay[person.orgKey] || '';
        if (personOrg !== orgName) return false;
        const groupingValue = person._teamGrouping || person.miroTeam || '';
        return groupingValue.split(',').map(t => t.trim()).includes(teamName);
      });
      res.json({ members });
    } catch (error) {
      console.error('[team-tracker] GET /org-teams/:teamKey/members error:', error);
      res.status(500).json({ error: 'Failed to load team members' });
    }
  });

  // ─── GET /org-list ───

  router.get('/org-list', function(req, res) {
    try {
      const metaData = readFromStorage('org-roster/teams-metadata.json');
      if (!metaData) return res.json({ orgs: [] });

      const orgMap = {};
      for (const team of metaData.teams) {
        if (!orgMap[team.org]) orgMap[team.org] = { name: team.org, teamCount: 0 };
        orgMap[team.org].teamCount++;
      }

      const allPeople = getAllPeople(storage);
      const orgKeyToDisplay = buildOrgKeyToDisplayName();
      const orgPeople = {};
      for (const person of allPeople) {
        const personOrg = orgKeyToDisplay[person.orgKey] || '';
        if (!personOrg || !orgMap[personOrg]) continue;
        if (!orgPeople[personOrg]) orgPeople[personOrg] = new Set();
        orgPeople[personOrg].add(person.name);
      }
      for (const [org, names] of Object.entries(orgPeople)) {
        if (orgMap[org]) orgMap[org].headcount = names.size;
      }

      res.json({ orgs: Object.values(orgMap) });
    } catch (error) {
      console.error('[team-tracker] GET /org-list error:', error);
      res.status(500).json({ error: 'Failed to load org data' });
    }
  });

  // ─── GET /org-summary/:orgName ───

  router.get('/org-summary/:orgName', function(req, res) {
    try {
      const orgName = decodeURIComponent(req.params.orgName);
      const isAll = orgName === '_all';
      const { teams } = buildEnrichedTeams(isAll ? undefined : orgName);

      if (teams.length === 0) return res.status(404).json({ error: 'No data available for this org' });

      const allPeople = getAllPeople(storage);
      const orgKeyToDisplay = buildOrgKeyToDisplayName();
      const orgPeople = isAll ? allPeople : allPeople.filter(function(person) {
        return (orgKeyToDisplay[person.orgKey] || '') === orgName;
      });

      const roleHeadcount = {};
      const roleFte = {};
      for (const person of orgPeople) {
        const role = person.engineeringSpeciality || person.specialty || 'Unspecified';
        roleHeadcount[role] = (roleHeadcount[role] || 0) + 1;
        const miroTeam = person._teamGrouping || person.miroTeam || '';
        const teamCount = miroTeam ? miroTeam.split(',').filter(t => t.trim()).length : 1;
        roleFte[role] = (roleFte[role] || 0) + (1 / Math.max(teamCount, 1));
      }

      const compData = readFromStorage('org-roster/components.json');
      const orgComponents = [];
      if (compData) {
        for (const [comp, teamNames] of Object.entries(compData.components || {})) {
          if (teams.some(t => teamNames.includes(t.name))) orgComponents.push(comp);
        }
      }

      const rfeData = readFromStorage('org-roster/rfe-backlog.json');
      let totalRfeCount = 0;
      const rfeByComponent = {};
      if (rfeData) {
        for (const comp of orgComponents) {
          const rfe = rfeData.byComponent?.[comp];
          if (rfe) { rfeByComponent[comp] = rfe.count; totalRfeCount += rfe.count; }
        }
      }

      res.json({
        org: isAll ? 'All Organizations' : orgName,
        teamCount: teams.length,
        headcount: new Set(orgPeople.map(p => p.name)).size,
        roleBreakdown: roleHeadcount,
        roleFteBreakdown: Object.fromEntries(Object.entries(roleFte).map(([k, v]) => [k, Math.round(v * 100) / 100])),
        components: orgComponents,
        totalRfeCount,
        rfeByComponent,
        teams: teams.map(t => ({ name: t.name, org: t.org, memberCount: t.memberCount, rfeCount: rfeData?.byTeam?.[`${t.org}::${t.name}`]?.count || 0 }))
      });
    } catch (error) {
      console.error('[team-tracker] GET /org-summary/:orgName error:', error);
      res.status(500).json({ error: 'Failed to load org summary' });
    }
  });

  // ─── Components & RFE ───

  router.get('/components', function(req, res) {
    try {
      res.json(readFromStorage('org-roster/components.json') || { components: {} });
    } catch {
      res.status(500).json({ error: 'Failed to load component data' });
    }
  });

  router.get('/rfe-backlog', function(req, res) {
    try {
      const data = readFromStorage('org-roster/rfe-backlog.json');
      if (!data) return res.json({ byComponent: {}, byTeam: {} });
      if (req.query.org) {
        const metaData = readFromStorage('org-roster/teams-metadata.json');
        if (metaData) {
          const orgTeams = metaData.teams.filter(t => t.org === req.query.org);
          const orgTeamKeys = new Set(orgTeams.map(t => `${t.org}::${t.name}`));
          const filteredByTeam = {};
          for (const [key, val] of Object.entries(data.byTeam || {})) {
            if (orgTeamKeys.has(key)) filteredByTeam[key] = val;
          }
          return res.json({ ...data, byTeam: filteredByTeam });
        }
      }
      res.json(data);
    } catch {
      res.status(500).json({ error: 'Failed to load RFE backlog data' });
    }
  });

  router.get('/rfe-config', function(req, res) {
    try {
      const config = getOrgConfig();
      res.json({
        jiraHost: process.env.JIRA_HOST || 'https://redhat.atlassian.net',
        jiraProject: config.jiraProject || 'RHAIRFE',
        rfeIssueType: config.rfeIssueType || 'Feature Request',
        componentMapping: config.componentMapping || {}
      });
    } catch {
      res.status(500).json({ error: 'Failed to load RFE config' });
    }
  });

  // ─── Org Config ───

  router.get('/org-config', requireAdmin, function(req, res) {
    try { res.json(getOrgConfig()); }
    catch { res.status(500).json({ error: 'Failed to load configuration' }); }
  });

  router.post('/org-config', requireAdmin, function(req, res) {
    try {
      const body = req.body;
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return res.status(400).json({ error: 'Request body must be a JSON object' });
      }

      const _allowedKeys = ['teamBoardsTab', 'componentsTab', 'jiraProject', 'rfeIssueType', 'orgNameMapping', 'componentMapping'];
      const config = getOrgConfig();

      if (body.teamBoardsTab !== undefined && typeof body.teamBoardsTab === 'string') config.teamBoardsTab = body.teamBoardsTab;
      if (body.componentsTab !== undefined && typeof body.componentsTab === 'string') config.componentsTab = body.componentsTab;
      if (body.jiraProject !== undefined && typeof body.jiraProject === 'string') config.jiraProject = body.jiraProject;
      if (body.rfeIssueType !== undefined && typeof body.rfeIssueType === 'string') config.rfeIssueType = body.rfeIssueType;
      if (body.orgNameMapping !== undefined && typeof body.orgNameMapping === 'object' && !Array.isArray(body.orgNameMapping)) config.orgNameMapping = body.orgNameMapping;
      if (body.componentMapping !== undefined && typeof body.componentMapping === 'object' && !Array.isArray(body.componentMapping)) config.componentMapping = body.componentMapping;

      writeToStorage('org-roster/config.json', config);
      res.json({ status: 'saved', config });
    } catch {
      res.status(500).json({ error: 'Failed to save configuration' });
    }
  });

  // ─── Sheet Orgs & Configured Orgs (for org name mapping UI) ───

  router.get('/sheet-orgs', requireAdmin, async function(req, res) {
    try {
      const config = getOrgConfig();
      const tabName = config.teamBoardsTab;

      if (tabName) {
        const sheetId = getSheetId();
        if (!sheetId) {
          return res.status(400).json({ error: 'No Google Sheet ID configured.' });
        }
        const boardData = await fetchRawSheet(sheetId, tabName);
        const teams = parseTeamBoardsTab(boardData.headers, boardData.rows);
        const sheetOrgs = [...new Set(teams.map(t => t.org))].sort();
        return res.json({ sheetOrgs });
      }

      const displayNames = getOrgDisplayNames(storage);
      const sheetOrgs = Object.values(displayNames).sort();
      res.json({ sheetOrgs });
    } catch (error) {
      console.error('[team-tracker] GET /sheet-orgs error:', error);
      res.status(500).json({ error: 'Failed to fetch org names from sheet' });
    }
  });

  router.get('/configured-orgs', function(req, res) {
    try {
      const displayNames = buildOrgKeyToDisplayName();
      const orgs = Object.values(displayNames).sort();
      res.json({ configuredOrgs: orgs });
    } catch (error) {
      console.error('[team-tracker] GET /configured-orgs error:', error);
      res.status(500).json({ error: 'Failed to load configured orgs' });
    }
  });

  // ─── Sheets Sync ───

  router.get('/org-sync/status', function(req, res) {
    try {
      const data = readFromStorage('org-roster/sync-status.json');
      res.json(data || { lastSyncAt: null, status: 'never', syncing: orgSyncInProgress });
    } catch {
      res.status(500).json({ error: 'Failed to load sync status' });
    }
  });

  router.post('/org-sync/trigger', requireAdmin, async function(req, res) {
    if (orgSyncInProgress) return res.status(409).json({ error: 'Sync already in progress' });
    orgSyncInProgress = true;

    const sheetId = getSheetId();
    if (!sheetId) {
      orgSyncInProgress = false;
      return res.status(400).json({ error: 'No Google Sheet ID configured.' });
    }

    const config = getOrgConfig();
    res.json({ status: 'started' });

    try {
      await runSync(storage, sheetId, config);
      try {
        const { teams } = buildEnrichedTeams();
        const allComponents = [...new Set(teams.flatMap(t => t.components || []))];
        if (allComponents.length > 0) {
          const rfeResult = await fetchAllRfeBacklog(allComponents, teams, {
            jiraProject: config.jiraProject, rfeIssueType: config.rfeIssueType, componentMapping: config.componentMapping
          });
          writeToStorage('org-roster/rfe-backlog.json', { fetchedAt: new Date().toISOString(), ...rfeResult });
        }
      } catch (rfeErr) {
        console.warn('[team-tracker] RFE refresh failed:', rfeErr.message);
      }
    } catch (err) {
      console.error('[team-tracker] Org sync error:', err.message);
      writeToStorage('org-roster/sync-status.json', { lastSyncAt: new Date().toISOString(), status: 'error', error: err.message });
    } finally {
      orgSyncInProgress = false;
    }
  });

  // ─── Schedule org sync ───

  if (!DEMO_MODE) {
    setTimeout(function() {
      const sheetId = getSheetId();
      if (sheetId) {
        if (!orgSyncInProgress) {
          const rosterData = readFromStorage('org-roster-full.json');
          if (rosterData) {
            orgSyncInProgress = true;
            const config = getOrgConfig();
            runSync(storage, sheetId, config)
              .then(function() {
                const { teams } = buildEnrichedTeams();
                const allComponents = [...new Set(teams.flatMap(t => t.components || []))];
                if (allComponents.length > 0) {
                  return fetchAllRfeBacklog(allComponents, teams, {
                    jiraProject: config.jiraProject, rfeIssueType: config.rfeIssueType, componentMapping: config.componentMapping
                  }).then(function(rfeResult) {
                    writeToStorage('org-roster/rfe-backlog.json', { fetchedAt: new Date().toISOString(), ...rfeResult });
                  });
                }
              })
              .catch(function(err) { console.error('[team-tracker] Initial org sync error:', err.message); })
              .finally(function() { orgSyncInProgress = false; });
          }
        }

        if (orgDailyTimer) clearInterval(orgDailyTimer);
        orgDailyTimer = setInterval(async function() {
          if (orgSyncInProgress) return;
          orgSyncInProgress = true;
          try {
            const config = getOrgConfig();
            await runSync(storage, sheetId, config);
            const { teams } = buildEnrichedTeams();
            const allComponents = [...new Set(teams.flatMap(t => t.components || []))];
            if (allComponents.length > 0) {
              const rfeResult = await fetchAllRfeBacklog(allComponents, teams, {
                jiraProject: config.jiraProject, rfeIssueType: config.rfeIssueType, componentMapping: config.componentMapping
              });
              writeToStorage('org-roster/rfe-backlog.json', { fetchedAt: new Date().toISOString(), ...rfeResult });
            }
          } catch (err) { console.error('[team-tracker] Scheduled org sync error:', err.message); }
          finally { orgSyncInProgress = false; }
        }, TWENTY_FOUR_HOURS);
        if (orgDailyTimer.unref) orgDailyTimer.unref();
      }
    }, 5 * 60 * 1000);
  }
};
