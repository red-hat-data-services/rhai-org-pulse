/**
 * Infer missing GitHub and GitLab usernames by matching roster people
 * against org/group member lists.
 *
 * Runs as an optional enrichment step after LDAP + Sheets merge.
 * Modifies person objects in place (adds githubUsername / gitlabUsername).
 */

const fetch = require('node-fetch');

const BATCH_DELAY_MS = 200;

function delay(ms) {
  return new Promise(function(resolve) { setTimeout(resolve, ms); });
}

function normalizeForMatch(name) {
  if (!name) return '';
  return name.toLowerCase().replace(/[^a-z]/g, '');
}

/**
 * Try to match a person against a list of org/group members.
 * Members should have { login/username, name?, email? }.
 */
function tryMatch(person, members) {
  const normalizedName = normalizeForMatch(person.name);
  const emailPrefix = person.email ? person.email.split('@')[0].toLowerCase() : '';
  const parts = person.name.split(' ');
  const firstName = parts[0] || '';
  const lastName = parts[parts.length - 1] || '';
  const firstLower = firstName.toLowerCase();
  const lastLower = lastName.toLowerCase();

  for (const member of members) {
    const login = (member.login || member.username || '').toLowerCase();
    if (!login) continue;

    // Match by profile name
    if (member.name && normalizeForMatch(member.name) === normalizedName) {
      return member.login || member.username;
    }

    // Match by profile email
    if (member.email && person.email && member.email.toLowerCase() === person.email.toLowerCase()) {
      return member.login || member.username;
    }

    // Match by login resembling email prefix / uid
    if (emailPrefix && login === emailPrefix) {
      return member.login || member.username;
    }

    // Match by login containing first+last name patterns
    if (lastLower.length > 2 && firstLower.length > 0) {
      if (login === `${firstLower}${lastLower}` ||
          login === `${firstLower}-${lastLower}` ||
          login === `${firstLower}.${lastLower}` ||
          login === `${firstLower[0]}${lastLower}`) {
        return member.login || member.username;
      }
    }
  }

  return null;
}

// ─── GitHub ───

/**
 * Fetch all members of a GitHub org via REST API.
 * Returns array of { login, name, email }.
 */
async function fetchGithubOrgMembers(orgName) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.warn('[username-inference] GITHUB_TOKEN not set, skipping GitHub inference');
    return null;
  }

  const headers = {
    'Authorization': `token ${token}`,
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'team-tracker'
  };

  console.log(`[username-inference] Fetching GitHub org members: ${orgName}`);
  const members = [];
  let page = 1;

  while (true) {
    const url = `https://api.github.com/orgs/${encodeURIComponent(orgName)}/members?per_page=100&page=${page}`;
    const res = await fetch(url, { headers });

    if (!res.ok) {
      console.error(`[username-inference] GitHub org members fetch failed: HTTP ${res.status}`);
      return null;
    }

    const data = await res.json();
    if (data.length === 0) break;
    members.push(...data.map(function(m) { return { login: m.login }; }));
    if (data.length < 100) break;
    page++;
    await delay(BATCH_DELAY_MS);
  }

  console.log(`[username-inference] GitHub: ${members.length} org members fetched`);

  // Fetch profile details (name, email) for matching — batch with delays
  console.log('[username-inference] Fetching GitHub user profiles for matching...');
  for (let i = 0; i < members.length; i++) {
    try {
      const res = await fetch(`https://api.github.com/users/${encodeURIComponent(members[i].login)}`, { headers });
      if (res.ok) {
        const profile = await res.json();
        members[i].name = profile.name || null;
        members[i].email = profile.email || null;
      }
    } catch {
      // Skip profile fetch failures
    }
    if (i > 0 && i % 50 === 0) {
      console.log(`[username-inference] GitHub profiles: ${i}/${members.length}`);
      await delay(BATCH_DELAY_MS);
    }
  }

  return members;
}

// ─── GitLab ───

/**
 * Fetch all members of a GitLab group via REST API.
 * Returns array of { username, name }.
 */
async function fetchGitlabGroupMembers(groupPath) {
  const token = process.env.GITLAB_TOKEN;
  const baseUrl = process.env.GITLAB_BASE_URL || 'https://gitlab.com';

  const headers = { 'Accept': 'application/json' };
  if (token) {
    headers['PRIVATE-TOKEN'] = token;
  } else {
    console.warn('[username-inference] GITLAB_TOKEN not set, skipping GitLab inference');
    return null;
  }

  console.log(`[username-inference] Fetching GitLab group members: ${groupPath}`);
  const members = [];
  let page = 1;

  while (true) {
    const url = `${baseUrl}/api/v4/groups/${encodeURIComponent(groupPath)}/members/all?per_page=100&page=${page}`;
    const res = await fetch(url, { headers });

    if (!res.ok) {
      console.error(`[username-inference] GitLab group members fetch failed: HTTP ${res.status}`);
      return null;
    }

    const data = await res.json();
    if (data.length === 0) break;
    members.push(...data.map(function(m) {
      return { username: m.username, name: m.name || null };
    }));

    const totalPages = parseInt(res.headers.get('x-total-pages') || '1', 10);
    if (page >= totalPages) break;
    page++;
    await delay(BATCH_DELAY_MS);
  }

  console.log(`[username-inference] GitLab: ${members.length} group members fetched`);
  return members;
}

// ─── Main inference ───

/**
 * Run username inference against the built roster.
 * Modifies person objects in place.
 *
 * @param {Object} roster - The full roster object (with orgs)
 * @param {Object} config - Sync config (may contain githubOrg, gitlabGroup)
 * @returns {Object} Summary of inferences made
 */
async function inferUsernames(roster, config) {
  const githubOrgs = normalizeToArray(config.githubOrgs || config.githubOrg);
  const gitlabGroups = normalizeToArray(config.gitlabGroups || config.gitlabGroup);

  if (githubOrgs.length === 0 && gitlabGroups.length === 0) {
    return { github: 0, gitlab: 0 };
  }

  // Collect all people from roster
  const allPeople = [];
  for (const org of Object.values(roster.orgs)) {
    allPeople.push(org.leader);
    for (const member of org.members) {
      allPeople.push(member);
    }
  }

  let githubInferred = 0;
  let gitlabInferred = 0;

  // GitHub inference — fetch members from all orgs, then match
  if (githubOrgs.length > 0) {
    const allGithubMembers = [];
    for (const orgName of githubOrgs) {
      const members = await fetchGithubOrgMembers(orgName);
      if (members) allGithubMembers.push(...members);
    }
    if (allGithubMembers.length > 0) {
      const needsGithub = allPeople.filter(function(p) { return !p.githubUsername; });
      console.log(`[username-inference] Matching ${needsGithub.length} people against ${githubOrgs.length} GitHub org(s)`);

      for (const person of needsGithub) {
        const match = tryMatch(person, allGithubMembers);
        if (match) {
          person.githubUsername = match;
          githubInferred++;
          console.log(`[username-inference] GitHub MATCH: ${person.name} -> ${match}`);
        }
      }
    }
  }

  // GitLab inference — fetch members from all groups, then match
  if (gitlabGroups.length > 0) {
    const allGitlabMembers = [];
    for (const groupPath of gitlabGroups) {
      const members = await fetchGitlabGroupMembers(groupPath);
      if (members) allGitlabMembers.push(...members);
    }
    if (allGitlabMembers.length > 0) {
      const needsGitlab = allPeople.filter(function(p) { return !p.gitlabUsername; });
      console.log(`[username-inference] Matching ${needsGitlab.length} people against ${gitlabGroups.length} GitLab group(s)`);

      for (const person of needsGitlab) {
        const match = tryMatch(person, allGitlabMembers);
        if (match) {
          person.gitlabUsername = match;
          gitlabInferred++;
          console.log(`[username-inference] GitLab MATCH: ${person.name} -> ${match}`);
        }
      }
    }
  }

  console.log(`[username-inference] Complete: ${githubInferred} GitHub, ${gitlabInferred} GitLab usernames inferred`);
  return { github: githubInferred, gitlab: gitlabInferred };
}

/**
 * Normalize a config value to an array.
 * Accepts a string, an array, null, or undefined.
 */
function normalizeToArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  return [value];
}

module.exports = { inferUsernames };
