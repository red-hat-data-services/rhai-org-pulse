const { runSync, parseTeamBoardsTab } = require('./sync');
const { calculateHeadcountByRole } = require('./sync');
const { fetchAllRfeBacklog } = require('./rfe');
const { isSyncInProgress, setSyncInProgress, scheduleDaily } = require('./scheduler');
const { getAllPeople, getTeamRollup } = require('../../../shared/server/roster');
const { fetchRawSheet } = require('../../../shared/server/google-sheets');
const { getOrgDisplayNames } = require('../../team-tracker/server/roster-sync/config');

module.exports = function registerRoutes(router, context) {
  const { storage, requireAdmin } = context;
  const { readFromStorage, writeToStorage } = storage;

  const DEMO_MODE = process.env.DEMO_MODE === 'true';

  function getSheetId() {
    const config = readFromStorage('roster-sync-config.json');
    return config?.googleSheetId || null;
  }

  function getModuleConfig() {
    return readFromStorage('org-roster/config.json') || {
      teamBoardsTab: 'Scrum Team Boards',
      componentsTab: 'Summary: components per team',
      jiraProject: 'RHAIRFE',
      rfeIssueType: 'Feature Request',
      orgNameMapping: {},
      componentMapping: {}
    };
  }

  /**
   * Build a map of orgKey (LDAP UID) -> org display name.
   */
  function buildOrgKeyToDisplayName() {
    return getOrgDisplayNames(storage);
  }

  /**
   * Group people by composite key (orgDisplayName::teamName) using their
   * LDAP orgKey to determine which org they belong to.
   */
  function groupPeopleByOrgTeam(allPeople, orgKeyToDisplay) {
    const map = {};
    for (const person of allPeople) {
      const orgDisplay = orgKeyToDisplay[person.orgKey] || '';
      const groupingValue = person._teamGrouping || person.miroTeam || '';
      const teamNames = groupingValue
        ? groupingValue.split(',').map(t => t.trim()).filter(Boolean)
        : [];
      for (const teamName of teamNames) {
        const compositeKey = `${orgDisplay}::${teamName}`;
        if (!map[compositeKey]) map[compositeKey] = [];
        map[compositeKey].push(person);
      }
    }
    return map;
  }

  /**
   * Build enriched teams by combining metadata (board URLs, PMs) from Sheets
   * with dynamically-computed headcount/FTE from people data (org-roster-full.json).
   */
  function buildEnrichedTeams(orgFilter) {
    const metaData = readFromStorage('org-roster/teams-metadata.json');
    const compData = readFromStorage('org-roster/components.json');
    const componentMap = compData?.components || {};

    if (!metaData || !metaData.teams) return { teams: [], fetchedAt: null };

    const boardNames = metaData.boardNames || {};
    let rawTeams = metaData.teams;
    if (orgFilter) {
      rawTeams = rawTeams.filter(t => t.org === orgFilter);
    }

    // Get people from shared roster and group by org::team composite key
    const allPeople = getAllPeople(storage);
    const orgKeyToDisplay = buildOrgKeyToDisplayName();
    const orgTeamPeopleMap = groupPeopleByOrgTeam(allPeople, orgKeyToDisplay);

    const teams = rawTeams.map(function(team) {
      const compositeKey = `${team.org}::${team.name}`;
      const teamPeople = orgTeamPeopleMap[compositeKey] || [];
      const counts = calculateHeadcountByRole(teamPeople);

      // Find components for this team
      const components = [];
      for (const [comp, teamNames] of Object.entries(componentMap)) {
        if (teamNames.includes(team.name)) {
          components.push(comp);
        }
      }

      // Eng leads and PMs from person-level fields
      const engLeads = getTeamRollup(teamPeople, 'engineeringLead');
      const productManagers = getTeamRollup(teamPeople, 'productManager');

      // Derive jiraFilter from most common value among team members
      const filterCounts = {};
      for (const p of teamPeople) {
        const filter = p.jiraFilter || p.customFields?.jiraFilter;
        if (filter) filterCounts[filter] = (filterCounts[filter] || 0) + 1;
      }
      const jiraFilter = Object.entries(filterCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

      // Enrich board URLs with resolved names
      const boards = (team.boardUrls || []).map(url => ({
        url,
        name: boardNames[url] || null
      }));

      return {
        ...team,
        boards,
        engLeads,
        productManagers,
        headcount: counts,
        components,
        memberCount: teamPeople.length,
        jiraFilter,
      };
    });

    return { teams, fetchedAt: metaData.fetchedAt };
  }

  /**
   * Get members for a specific team from the shared roster, scoped by org.
   */
  function getTeamMembers(orgName, teamName) {
    const allPeople = getAllPeople(storage);
    const orgKeyToDisplay = buildOrgKeyToDisplayName();
    return allPeople.filter(function(person) {
      const personOrg = orgKeyToDisplay[person.orgKey] || '';
      if (personOrg !== orgName) return false;
      const groupingValue = person._teamGrouping || person.miroTeam || '';
      const teamNames = groupingValue
        ? groupingValue.split(',').map(t => t.trim()).filter(Boolean)
        : [];
      return teamNames.includes(teamName);
    });
  }

  // ─── GET /teams ───

  router.get('/teams', function(req, res) {
    try {
      const { teams, fetchedAt } = buildEnrichedTeams(req.query.org);

      // Attach RFE data if available
      const rfeData = readFromStorage('org-roster/rfe-backlog.json');
      const enriched = rfeData ? teams.map(function(t) {
        const teamKey = `${t.org}::${t.name}`;
        const rfe = rfeData.byTeam?.[teamKey];
        return { ...t, rfeCount: rfe?.count || 0 };
      }) : teams;

      res.json({ teams: enriched, fetchedAt });
    } catch (error) {
      console.error('[org-roster] GET /teams error:', error);
      res.status(500).json({ error: 'Failed to load team data' });
    }
  });

  // ─── GET /teams/:teamKey ───

  router.get('/teams/:teamKey', function(req, res) {
    try {
      const teamKey = decodeURIComponent(req.params.teamKey);
      const sepIdx = teamKey.indexOf('::');
      if (sepIdx === -1) {
        return res.status(400).json({ error: 'teamKey must be org::teamName format' });
      }

      const orgName = teamKey.substring(0, sepIdx);
      const teamName = teamKey.substring(sepIdx + 2);

      const { teams } = buildEnrichedTeams(orgName);
      const team = teams.find(t => t.name === teamName);
      if (!team) return res.status(404).json({ error: 'Team not found' });

      // Attach RFE data
      const rfeData = readFromStorage('org-roster/rfe-backlog.json');
      const rfe = rfeData?.byTeam?.[teamKey];

      res.json({ ...team, rfeCount: rfe?.count || 0 });
    } catch (error) {
      console.error('[org-roster] GET /teams/:teamKey error:', error);
      res.status(500).json({ error: 'Failed to load team detail' });
    }
  });

  // ─── GET /teams/:teamKey/members ───

  router.get('/teams/:teamKey/members', function(req, res) {
    try {
      const teamKey = decodeURIComponent(req.params.teamKey);
      const sepIdx = teamKey.indexOf('::');
      if (sepIdx === -1) {
        return res.status(400).json({ error: 'teamKey must be org::teamName format' });
      }

      const orgName = teamKey.substring(0, sepIdx);
      const teamName = teamKey.substring(sepIdx + 2);
      const members = getTeamMembers(orgName, teamName);

      res.json({ members });
    } catch (error) {
      console.error('[org-roster] GET /teams/:teamKey/members error:', error);
      res.status(500).json({ error: 'Failed to load team members' });
    }
  });

  // ─── GET /people ───

  router.get('/people', function(req, res) {
    try {
      const allPeople = getAllPeople(storage);
      let people = allPeople;

      if (req.query.org) {
        const orgKeyToDisplay = buildOrgKeyToDisplayName();
        people = people.filter(p => (orgKeyToDisplay[p.orgKey] || '') === req.query.org);
      }
      if (req.query.team) {
        people = people.filter(function(p) {
          const groupingValue = p._teamGrouping || p.miroTeam || '';
          return groupingValue.split(',').map(t => t.trim()).includes(req.query.team);
        });
      }
      if (req.query.status) {
        people = people.filter(p => (p.status || p.customFields?.status || 'Confirmed') === req.query.status);
      }

      res.json({ people });
    } catch (error) {
      console.error('[org-roster] GET /people error:', error);
      res.status(500).json({ error: 'Failed to load people data' });
    }
  });

  // ─── GET /orgs ───

  router.get('/orgs', function(req, res) {
    try {
      const metaData = readFromStorage('org-roster/teams-metadata.json');
      if (!metaData) return res.json({ orgs: [] });

      const orgMap = {};
      for (const team of metaData.teams) {
        if (!orgMap[team.org]) {
          orgMap[team.org] = { name: team.org, teamCount: 0 };
        }
        orgMap[team.org].teamCount++;
      }

      // Add headcount from people data, scoped by LDAP orgKey
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
      console.error('[org-roster] GET /orgs error:', error);
      res.status(500).json({ error: 'Failed to load org data' });
    }
  });

  // ─── GET /orgs/:orgName/summary ───

  router.get('/orgs/:orgName/summary', function(req, res) {
    try {
      const orgName = decodeURIComponent(req.params.orgName);
      const isAll = orgName === '_all';

      // For "all", don't filter by org; for specific org, filter
      const { teams } = buildEnrichedTeams(isAll ? undefined : orgName);

      if (teams.length === 0) {
        return res.status(404).json({ error: 'No data available for this org' });
      }

      // People scoped by LDAP orgKey
      const allPeople = getAllPeople(storage);
      const orgKeyToDisplay = buildOrgKeyToDisplayName();
      const orgPeople = isAll ? allPeople : allPeople.filter(function(person) {
        const personOrg = orgKeyToDisplay[person.orgKey] || '';
        return personOrg === orgName;
      });

      // Role breakdown
      const roleHeadcount = {};
      const roleFte = {};
      for (const person of orgPeople) {
        const role = person.engineeringSpeciality || person.specialty || 'Unspecified';
        roleHeadcount[role] = (roleHeadcount[role] || 0) + 1;
        const miroTeam = person._teamGrouping || person.miroTeam || '';
        const teamCount = miroTeam ? miroTeam.split(',').filter(t => t.trim()).length : 1;
        roleFte[role] = (roleFte[role] || 0) + (1 / Math.max(teamCount, 1));
      }

      // Components
      const compData = readFromStorage('org-roster/components.json');
      const orgComponents = [];
      if (compData) {
        for (const [comp, teamNames] of Object.entries(compData.components || {})) {
          if (teams.some(t => teamNames.includes(t.name))) {
            orgComponents.push(comp);
          }
        }
      }

      // RFE summary
      const rfeData = readFromStorage('org-roster/rfe-backlog.json');
      let totalRfeCount = 0;
      const rfeByComponent = {};
      if (rfeData) {
        for (const comp of orgComponents) {
          const rfe = rfeData.byComponent?.[comp];
          if (rfe) {
            rfeByComponent[comp] = rfe.count;
            totalRfeCount += rfe.count;
          }
        }
      }

      const uniquePeople = new Set(orgPeople.map(p => p.name)).size;

      res.json({
        org: isAll ? 'All Organizations' : orgName,
        teamCount: teams.length,
        headcount: uniquePeople,
        roleBreakdown: roleHeadcount,
        roleFteBreakdown: Object.fromEntries(
          Object.entries(roleFte).map(([k, v]) => [k, Math.round(v * 100) / 100])
        ),
        components: orgComponents,
        totalRfeCount,
        rfeByComponent,
        teams: teams.map(t => ({
          name: t.name,
          org: t.org,
          memberCount: t.memberCount,
          rfeCount: rfeData?.byTeam?.[`${t.org}::${t.name}`]?.count || 0
        }))
      });
    } catch (error) {
      console.error('[org-roster] GET /orgs/:orgName/summary error:', error);
      res.status(500).json({ error: 'Failed to load org summary' });
    }
  });

  // ─── GET /components ───

  router.get('/components', function(req, res) {
    try {
      const data = readFromStorage('org-roster/components.json');
      res.json(data || { components: {} });
    } catch (error) {
      console.error('[org-roster] GET /components error:', error);
      res.status(500).json({ error: 'Failed to load component data' });
    }
  });

  // ─── GET /rfe-backlog ───

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
    } catch (error) {
      console.error('[org-roster] GET /rfe-backlog error:', error);
      res.status(500).json({ error: 'Failed to load RFE backlog data' });
    }
  });

  // ─── GET /sync/status ───

  router.get('/sync/status', function(req, res) {
    try {
      const data = readFromStorage('org-roster/sync-status.json');
      res.json(data || { lastSyncAt: null, status: 'never', syncing: isSyncInProgress() });
    } catch (error) {
      console.error('[org-roster] GET /sync/status error:', error);
      res.status(500).json({ error: 'Failed to load sync status' });
    }
  });

  // ─── POST /sync/trigger ───

  router.post('/sync/trigger', requireAdmin, async function(req, res) {
    if (isSyncInProgress()) {
      return res.status(409).json({ error: 'Sync already in progress' });
    }

    const sheetId = getSheetId();
    if (!sheetId) {
      return res.status(400).json({ error: 'No Google Sheet ID configured. Configure it in Team Tracker settings.' });
    }

    const config = getModuleConfig();
    setSyncInProgress(true);
    res.json({ status: 'started' });

    try {
      const result = await runSync(storage, sheetId, config);
      console.log('[org-roster] Manual sync complete:', result);

      // Also refresh RFE backlog
      try {
        const { teams } = buildEnrichedTeams();
        const allComponents = [...new Set(teams.flatMap(t => t.components || []))];
        if (allComponents.length > 0) {
          const rfeResult = await fetchAllRfeBacklog(allComponents, teams, {
            jiraProject: config.jiraProject,
            rfeIssueType: config.rfeIssueType,
            componentMapping: config.componentMapping
          });
          writeToStorage('org-roster/rfe-backlog.json', {
            fetchedAt: new Date().toISOString(),
            ...rfeResult
          });
        }
      } catch (rfeErr) {
        console.warn('[org-roster] RFE refresh failed (continuing):', rfeErr.message);
      }
    } catch (err) {
      console.error('[org-roster] Manual sync error:', err.message);
      writeToStorage('org-roster/sync-status.json', {
        lastSyncAt: new Date().toISOString(),
        status: 'error',
        error: err.message
      });
    } finally {
      setSyncInProgress(false);
    }
  });

  // ─── POST /sync/sheets/trigger ───

  router.post('/sync/sheets/trigger', requireAdmin, async function(req, res) {
    if (isSyncInProgress()) {
      return res.status(409).json({ error: 'Sync already in progress' });
    }

    const sheetId = getSheetId();
    if (!sheetId) {
      return res.status(400).json({ error: 'No Google Sheet ID configured. Configure it in Team Tracker settings.' });
    }

    const config = getModuleConfig();
    setSyncInProgress(true);
    res.json({ status: 'started' });

    try {
      const result = await runSync(storage, sheetId, config);
      console.log('[org-roster] Sheets-only sync complete:', result);
    } catch (err) {
      console.error('[org-roster] Sheets-only sync error:', err.message);
      writeToStorage('org-roster/sync-status.json', {
        lastSyncAt: new Date().toISOString(),
        status: 'error',
        error: err.message
      });
    } finally {
      setSyncInProgress(false);
    }
  });

  // ─── POST /sync/rfe/trigger ───

  router.post('/sync/rfe/trigger', requireAdmin, async function(req, res) {
    try {
      const { teams } = buildEnrichedTeams();
      if (teams.length === 0) {
        return res.status(400).json({ error: 'No team data available. Run a full sync first.' });
      }

      const allComponents = [...new Set(teams.flatMap(t => t.components || []))];
      if (allComponents.length === 0) {
        return res.json({ status: 'skipped', message: 'No components to query' });
      }

      const config = getModuleConfig();
      res.json({ status: 'started' });

      const rfeResult = await fetchAllRfeBacklog(allComponents, teams, {
        jiraProject: config.jiraProject,
        rfeIssueType: config.rfeIssueType
      });
      writeToStorage('org-roster/rfe-backlog.json', {
        fetchedAt: new Date().toISOString(),
        ...rfeResult
      });
      console.log('[org-roster] RFE refresh complete');
    } catch (error) {
      console.error('[org-roster] RFE refresh error:', error);
    }
  });

  // ─── GET /config ───

  router.get('/config', requireAdmin, function(req, res) {
    try {
      res.json(getModuleConfig());
    } catch (error) {
      console.error('[org-roster] GET /config error:', error);
      res.status(500).json({ error: 'Failed to load configuration' });
    }
  });

  // ─── GET /sheet-orgs ───
  // Lightweight endpoint: fetches org names from the spreadsheet without running a full sync

  router.get('/sheet-orgs', requireAdmin, async function(req, res) {
    try {
      const sheetId = getSheetId();
      if (!sheetId) {
        return res.status(400).json({ error: 'No Google Sheet ID configured.' });
      }

      const config = getModuleConfig();
      const tabName = config.teamBoardsTab || 'Scrum Team Boards';
      const boardData = await fetchRawSheet(sheetId, tabName);
      const teams = parseTeamBoardsTab(boardData.headers, boardData.rows);
      const sheetOrgs = [...new Set(teams.map(t => t.org))].sort();

      res.json({ sheetOrgs });
    } catch (error) {
      console.error('[org-roster] GET /sheet-orgs error:', error);
      res.status(500).json({ error: 'Failed to fetch org names from sheet' });
    }
  });

  // ─── GET /configured-orgs ───
  // Returns display names of orgs configured in Team Tracker org roots

  router.get('/configured-orgs', function(req, res) {
    try {
      const displayNames = getOrgDisplayNames(storage);
      const orgs = Object.values(displayNames).sort();
      res.json({ configuredOrgs: orgs });
    } catch (error) {
      console.error('[org-roster] GET /configured-orgs error:', error);
      res.status(500).json({ error: 'Failed to load configured orgs' });
    }
  });

  // ─── GET /rfe-config ───
  // Returns Jira config needed to build RFE search URLs (public, no admin required)

  router.get('/rfe-config', function(req, res) {
    try {
      const config = getModuleConfig();
      res.json({
        jiraHost: process.env.JIRA_HOST || 'https://redhat.atlassian.net',
        jiraProject: config.jiraProject || 'RHAIRFE',
        rfeIssueType: config.rfeIssueType || 'Feature Request',
        componentMapping: config.componentMapping || {}
      });
    } catch (error) {
      console.error('[org-roster] GET /rfe-config error:', error);
      res.status(500).json({ error: 'Failed to load RFE config' });
    }
  });

  // ─── GET /jira-components ───
  // Fetches component names from the configured Jira project

  router.get('/jira-components', requireAdmin, async function(req, res) {
    try {
      const fetch = require('node-fetch');
      const token = process.env.JIRA_TOKEN;
      const email = process.env.JIRA_EMAIL;
      if (!token || !email) {
        return res.status(400).json({ error: 'JIRA_TOKEN and JIRA_EMAIL not configured' });
      }
      const auth = Buffer.from(`${email}:${token}`).toString('base64');
      const host = process.env.JIRA_HOST || 'https://redhat.atlassian.net';
      const config = getModuleConfig();
      const project = config.jiraProject || 'RHAIRFE';

      const response = await fetch(`${host}/rest/api/2/project/${project}/components`, {
        headers: { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json' }
      });
      if (!response.ok) {
        const text = await response.text();
        return res.status(response.status).json({ error: `Jira API error: ${text.slice(0, 200)}` });
      }
      const data = await response.json();
      const jiraComponents = data.map(c => c.name).sort();
      res.json({ jiraComponents });
    } catch (error) {
      console.error('[org-roster] GET /jira-components error:', error);
      res.status(500).json({ error: 'Failed to fetch Jira components' });
    }
  });

  // ─── POST /config ───

  router.post('/config', requireAdmin, function(req, res) {
    try {
      const { teamBoardsTab, componentsTab, jiraProject, rfeIssueType, orgNameMapping, componentMapping } = req.body;
      const config = getModuleConfig();
      if (teamBoardsTab) config.teamBoardsTab = teamBoardsTab;
      if (componentsTab) config.componentsTab = componentsTab;
      if (jiraProject) config.jiraProject = jiraProject;
      if (rfeIssueType) config.rfeIssueType = rfeIssueType;
      if (orgNameMapping !== undefined) config.orgNameMapping = orgNameMapping;
      if (componentMapping !== undefined) config.componentMapping = componentMapping;
      writeToStorage('org-roster/config.json', config);
      res.json({ status: 'saved', config });
    } catch (error) {
      console.error('[org-roster] POST /config error:', error);
      res.status(500).json({ error: 'Failed to save configuration' });
    }
  });

  // ─── Diagnostics Hook ───

  if (context.registerDiagnostics) {
    context.registerDiagnostics(async function() {
      const config = getModuleConfig();
      const syncStatus = readFromStorage('org-roster/sync-status.json');
      const metaData = readFromStorage('org-roster/teams-metadata.json');
      const compData = readFromStorage('org-roster/components.json');
      const rfeData = readFromStorage('org-roster/rfe-backlog.json');
      const rosterData = readFromStorage('org-roster-full.json');
      const sheetId = getSheetId();

      // Config info
      const configInfo = {
        teamBoardsTab: config.teamBoardsTab,
        componentsTab: config.componentsTab,
        jiraProject: config.jiraProject,
        rfeIssueType: config.rfeIssueType,
        orgNameMappingCount: Object.keys(config.orgNameMapping || {}).length,
        componentMappingCount: Object.keys(config.componentMapping || {}).length
      };

      // Sync status
      const syncInfo = {
        lastSyncAt: syncStatus?.lastSyncAt || null,
        status: syncStatus?.status || 'never',
        error: syncStatus?.error || null,
        syncInProgress: isSyncInProgress()
      };

      // Scheduler info
      const schedulerInfo = {
        dailySyncScheduled: !DEMO_MODE && !!sheetId,
        intervalMs: 86400000,
        startupDelayMs: 300000,
        dependsOnRosterData: true,
        rosterDataExists: !!rosterData
      };

      // Teams metadata
      const teamsInfo = { exists: false };
      if (metaData && metaData.teams) {
        teamsInfo.exists = true;
        teamsInfo.fetchedAt = metaData.fetchedAt || null;
        teamsInfo.teamCount = metaData.teams.length;
        teamsInfo.orgNames = [...new Set(metaData.teams.map(function(t) { return t.org }))].sort();
        const boardNames = metaData.boardNames || {};
        let withBoards = 0, withoutBoards = 0, resolvedNames = 0, unresolvedUrls = 0;
        for (const team of metaData.teams) {
          if (team.boardUrls && team.boardUrls.length > 0) {
            withBoards++;
            for (const url of team.boardUrls) {
              if (boardNames[url]) resolvedNames++;
              else unresolvedUrls++;
            }
          } else {
            withoutBoards++;
          }
        }
        teamsInfo.teamsWithBoardUrls = withBoards;
        teamsInfo.teamsWithoutBoardUrls = withoutBoards;
        teamsInfo.resolvedBoardNames = resolvedNames;
        teamsInfo.unresolvedBoardUrls = unresolvedUrls;
      }

      // Components
      const componentsInfo = { exists: false };
      if (compData) {
        componentsInfo.exists = true;
        componentsInfo.fetchedAt = compData.fetchedAt || null;
        const componentMap = compData.components || {};
        componentsInfo.componentCount = Object.keys(componentMap).length;
        const teamsWithComps = new Set();
        for (const teamNames of Object.values(componentMap)) {
          for (const t of teamNames) teamsWithComps.add(t);
        }
        componentsInfo.teamsWithComponents = teamsWithComps.size;
      }

      // RFE backlog
      const rfeInfo = { exists: false };
      if (rfeData) {
        rfeInfo.exists = true;
        rfeInfo.fetchedAt = rfeData.fetchedAt || null;
        const byComp = rfeData.byComponent || {};
        rfeInfo.totalComponents = Object.keys(byComp).length;
        let withRfes = 0, withErrors = 0, totalRfeCount = 0, teamCount = 0;
        for (const val of Object.values(byComp)) {
          if (val.error) withErrors++;
          if (val.count > 0) withRfes++;
          totalRfeCount += val.count || 0;
        }
        if (rfeData.byTeam) teamCount = Object.keys(rfeData.byTeam).length;
        rfeInfo.componentsWithRfes = withRfes;
        rfeInfo.componentsWithErrors = withErrors;
        rfeInfo.totalRfeCount = totalRfeCount;
        rfeInfo.teamCount = teamCount;
      }

      // Data integrity checks
      const dataIntegrity = {
        teamsInMetadataNotInRoster: [],
        rosterTeamsNotInMetadata: [],
        componentsWithNoTeam: [],
        sheetOrgsMissingFromConfig: []
      };

      if (metaData && rosterData) {
        const allPeople = getAllPeople(storage);
        const orgKeyToDisplay = buildOrgKeyToDisplayName();
        const orgTeamPeopleMap = groupPeopleByOrgTeam(allPeople, orgKeyToDisplay);
        const rosterCompositeKeys = new Set(Object.keys(orgTeamPeopleMap));

        // Teams in metadata not in roster
        const metaCompositeKeys = new Set();
        for (const team of metaData.teams) {
          const key = team.org + '::' + team.name;
          metaCompositeKeys.add(key);
          if (!rosterCompositeKeys.has(key)) {
            dataIntegrity.teamsInMetadataNotInRoster.push(key);
          }
        }

        // Roster teams not in metadata
        for (const key of rosterCompositeKeys) {
          if (!metaCompositeKeys.has(key)) {
            dataIntegrity.rosterTeamsNotInMetadata.push(key);
          }
        }
      }

      // Components with no team
      if (compData && metaData) {
        const allTeamNames = new Set(metaData.teams.map(function(t) { return t.name }));
        for (const [comp, teamNames] of Object.entries(compData.components || {})) {
          const hasTeam = teamNames.some(function(t) { return allTeamNames.has(t) });
          if (!hasTeam) dataIntegrity.componentsWithNoTeam.push(comp);
        }
      }

      // Sheet orgs missing from config
      if (metaData) {
        const configuredOrgs = new Set(Object.values(buildOrgKeyToDisplayName()));
        const sheetOrgs = [...new Set(metaData.teams.map(function(t) { return t.org }))];
        for (const org of sheetOrgs) {
          if (!configuredOrgs.has(org)) {
            dataIntegrity.sheetOrgsMissingFromConfig.push(org);
          }
        }
      }

      return {
        config: configInfo,
        syncStatus: syncInfo,
        scheduler: schedulerInfo,
        teamsMetadata: teamsInfo,
        components: componentsInfo,
        rfeBacklog: rfeInfo,
        dataIntegrity
      };
    });
  }

  // ─── Schedule daily sync ───
  if (!DEMO_MODE) {
    // Delay startup sync by 5 minutes to avoid overlapping with team-tracker's roster-sync
    setTimeout(function() {
      const sheetId = getSheetId();
      if (sheetId) {
        // Run initial sync
        if (!isSyncInProgress()) {
          const rosterData = readFromStorage('org-roster-full.json');
          if (rosterData) {
            // Only sync if roster data exists (team-tracker has run)
            setSyncInProgress(true);
            const config = getModuleConfig();
            runSync(storage, sheetId, config)
              .then(function() {
                // Also refresh RFE
                const { teams } = buildEnrichedTeams();
                const allComponents = [...new Set(teams.flatMap(t => t.components || []))];
                if (allComponents.length > 0) {
                  return fetchAllRfeBacklog(allComponents, teams, {
                    jiraProject: config.jiraProject,
                    rfeIssueType: config.rfeIssueType
                  }).then(function(rfeResult) {
                    writeToStorage('org-roster/rfe-backlog.json', {
                      fetchedAt: new Date().toISOString(),
                      ...rfeResult
                    });
                  });
                }
              })
              .catch(function(err) {
                console.error('[org-roster] Initial sync error:', err.message);
              })
              .finally(function() {
                setSyncInProgress(false);
              });
          }
        }

        // Schedule daily recurring sync
        scheduleDaily(async function() {
          if (isSyncInProgress()) return;
          setSyncInProgress(true);
          try {
            const config = getModuleConfig();
            await runSync(storage, sheetId, config);
            const { teams } = buildEnrichedTeams();
            const allComponents = [...new Set(teams.flatMap(t => t.components || []))];
            if (allComponents.length > 0) {
              const rfeResult = await fetchAllRfeBacklog(allComponents, teams, {
                jiraProject: config.jiraProject,
                rfeIssueType: config.rfeIssueType
              });
              writeToStorage('org-roster/rfe-backlog.json', {
                fetchedAt: new Date().toISOString(),
                ...rfeResult
              });
            }
          } catch (err) {
            console.error('[org-roster] Scheduled sync error:', err.message);
          } finally {
            setSyncInProgress(false);
          }
        });
      }
    }, 5 * 60 * 1000); // 5-minute delay
  }
};
