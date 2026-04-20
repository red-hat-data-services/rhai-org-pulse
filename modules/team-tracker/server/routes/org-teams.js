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

// Module-level holder for the triggerOrgSync function, assigned inside registerOrgTeamsRoutes
let _triggerOrgSync = null;

function isOrgSyncInProgress() {
  return orgSyncInProgress;
}

module.exports = function registerOrgTeamsRoutes(router, context) {
  const { storage, requireAdmin } = context;
  const { readFromStorage, writeToStorage } = storage;
  const DEMO_MODE = process.env.DEMO_MODE === 'true';

  function getSheetId() {
    const rosterSyncConfig = require('../../../../shared/server/roster-sync/config');
    const config = rosterSyncConfig.loadConfig(storage);
    return config?.googleSheetId || null;
  }

  function getOrgConfig() {
    return readFromStorage('org-roster/config.json') || {
      teamBoardsTab: '',
      componentsTab: '',
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
      if (!orgDisplay) continue;
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
    const boardNames = metaData?.boardNames || {};

    // Build a lookup of metadata by composite key for enrichment
    const metaByKey = {};
    if (metaData?.teams) {
      for (const mt of metaData.teams) {
        metaByKey[`${mt.org}::${mt.name}`] = mt;
      }
    }

    // Teams are derived from people's _teamGrouping values (the source of truth)
    const allPeople = getAllPeople(storage);
    const orgKeyToDisplay = buildOrgKeyToDisplayName();
    const orgTeamPeopleMap = groupPeopleByOrgTeam(allPeople, orgKeyToDisplay);

    const teams = [];
    for (const [compositeKey, teamPeople] of Object.entries(orgTeamPeopleMap)) {
      const sepIdx = compositeKey.indexOf('::');
      const org = compositeKey.substring(0, sepIdx);
      const name = compositeKey.substring(sepIdx + 2);
      if (orgFilter && org !== orgFilter) continue;

      const counts = calculateHeadcountByRole(teamPeople);
      const engLeads = getTeamRollup(teamPeople, 'engineeringLead');
      const productManagers = getTeamRollup(teamPeople, 'productManager');

      const filterCounts = {};
      for (const p of teamPeople) {
        const filter = p.jiraFilter || p.customFields?.jiraFilter;
        if (filter) filterCounts[filter] = (filterCounts[filter] || 0) + 1;
      }
      const jiraFilter = Object.entries(filterCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

      // Enrich with metadata (board URLs, etc.) if available
      const meta = metaByKey[compositeKey];
      const teamBoardUrls = meta?.boardUrls || [];
      const boards = teamBoardUrls.map(url => ({ url, name: boardNames[url] || null }));

      const components = [];
      for (const [comp, teamNames] of Object.entries(componentMap)) {
        if (teamNames.includes(name)) components.push(comp);
      }

      teams.push({ org, name, boardUrls: teamBoardUrls, boards, engLeads, productManagers, headcount: counts, components, memberCount: teamPeople.length, jiraFilter });
    }

    // Find people with no team assignment
    const relevantPeople = orgFilter
      ? allPeople.filter(p => (orgKeyToDisplay[p.orgKey] || '') === orgFilter)
      : allPeople;
    const unassigned = relevantPeople
      .filter(p => {
        const grouping = p._teamGrouping || p.miroTeam || '';
        return !grouping.trim();
      })
      .map(p => ({ name: p.name, orgKey: p.orgKey, org: orgKeyToDisplay[p.orgKey] || p.orgKey, title: p.title || '' }))
      .sort((a, b) => a.name.localeCompare(b.name));

    // Count unique people (a person on multiple teams should only count once)
    const uniquePeople = new Set();
    for (const teamPeople of Object.values(orgTeamPeopleMap)) {
      for (const p of teamPeople) {
        if (!orgFilter || (orgKeyToDisplay[p.orgKey] || '') === orgFilter) {
          uniquePeople.add(p.name);
        }
      }
    }
    for (const p of unassigned) uniquePeople.add(p.name);

    return { teams, unassigned, totalPeople: uniquePeople.size, fetchedAt: metaData?.fetchedAt || null };
  }

  // ─── GET /org-teams ───

  router.get('/org-teams', function(req, res) {
    try {
      const { teams, unassigned, totalPeople, fetchedAt } = buildEnrichedTeams(req.query.org);
      const rfeData = readFromStorage('org-roster/rfe-backlog.json');
      const enriched = rfeData ? teams.map(function(t) {
        const teamKey = `${t.org}::${t.name}`;
        const rfe = rfeData.byTeam?.[teamKey];
        return { ...t, rfeCount: rfe?.count || 0 };
      }) : teams;
      res.json({ teams: enriched, unassigned, totalPeople, fetchedAt });
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
      // Derive orgs and team counts from people data (source of truth)
      const allPeople = getAllPeople(storage);
      const orgKeyToDisplay = buildOrgKeyToDisplayName();
      const orgTeamPeopleMap = groupPeopleByOrgTeam(allPeople, orgKeyToDisplay);

      const orgMap = {};
      const orgPeople = {};
      for (const [compositeKey] of Object.entries(orgTeamPeopleMap)) {
        const sepIdx = compositeKey.indexOf('::');
        const org = compositeKey.substring(0, sepIdx);
        if (!orgMap[org]) orgMap[org] = { name: org, teamCount: 0 };
        orgMap[org].teamCount++;
      }

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

  async function triggerOrgSync() {
    if (orgSyncInProgress) return { status: 'already_running' };
    orgSyncInProgress = true;

    const sheetId = getSheetId();  // may be null — runSync handles it
    const config = getOrgConfig();

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
      return { status: 'success' };
    } catch (err) {
      console.error('[team-tracker] Org sync error:', err.message);
      writeToStorage('org-roster/sync-status.json', { lastSyncAt: new Date().toISOString(), status: 'error', error: err.message });
      return { status: 'error', error: err.message };
    } finally {
      orgSyncInProgress = false;
    }
  }

  // Export triggerOrgSync for unified endpoint
  _triggerOrgSync = triggerOrgSync;

  router.post('/org-sync/trigger', requireAdmin, async function(req, res) {
    if (orgSyncInProgress) return res.status(409).json({ error: 'Sync already in progress' });

    res.json({ status: 'started' });
    triggerOrgSync();
  });

  // ─── Schedule org sync ───

  if (!DEMO_MODE) {
    setTimeout(function() {
      const rosterData = readFromStorage('team-data/registry.json');
      if (rosterData) {
        triggerOrgSync().catch(function(err) {
          console.error('[team-tracker] Initial org sync error:', err.message);
        });
      }

      if (orgDailyTimer) clearInterval(orgDailyTimer);
      orgDailyTimer = setInterval(function() {
        triggerOrgSync().catch(function(err) {
          console.error('[team-tracker] Scheduled org sync error:', err.message);
        });
      }, TWENTY_FOUR_HOURS);
      if (orgDailyTimer.unref) orgDailyTimer.unref();
    }, 5 * 60 * 1000);
  }
};

module.exports.isOrgSyncInProgress = isOrgSyncInProgress;
module.exports.getTriggerOrgSync = function() { return _triggerOrgSync; };
