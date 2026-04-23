/**
 * Universal PII mapping engine for test data export.
 *
 * Builds a deterministic mapping from roster data and provides
 * functions to anonymize names, UIDs, emails, usernames,
 * Jira account IDs, issue keys, summaries, and board URLs.
 */

const SEED = 42;

// Generic issue summaries pool (~35 entries)
const ISSUE_SUMMARIES = [
  'Implement feature for module',
  'Fix bug in processing logic',
  'Update configuration settings',
  'Add unit tests for service',
  'Refactor data handling code',
  'Improve error handling',
  'Add logging for debugging',
  'Update API endpoint',
  'Fix validation issue',
  'Add caching mechanism',
  'Optimize database queries',
  'Update dependencies',
  'Add input validation',
  'Fix race condition',
  'Implement retry logic',
  'Add monitoring metrics',
  'Update documentation',
  'Fix memory leak',
  'Add pagination support',
  'Implement search feature',
  'Fix authentication issue',
  'Add rate limiting',
  'Update error messages',
  'Fix data migration',
  'Add health check endpoint',
  'Implement webhook handler',
  'Fix timezone handling',
  'Add export functionality',
  'Update notification system',
  'Fix concurrent access issue',
  'Add batch processing',
  'Implement data cleanup',
  'Fix sorting order',
  'Add filtering options',
  'Update access controls',
];

/**
 * Simple deterministic hash from a string, using the constant seed.
 */
function hashString(str) {
  let hash = SEED;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * Build the PII mapping from the roster data (derived from team-data/registry.json).
 *
 * @param {object} roster - The full roster object ({ vp, orgs })
 * @returns {object} mapping object with lookup functions and maps
 */
function buildMapping(roster) {
  const nameToFake = {};
  const uidToFake = {};
  const emailToFake = {};
  const githubToFake = {};
  const gitlabToFake = {};
  const accountIdToFake = {};
  const jiraProjectToFake = {};

  let personIndex = 0;
  let projectIndex = 0;
  let unmappedIndex = 0;

  function addPerson(person) {
    if (!person || nameToFake[person.name]) return;
    personIndex++;
    const fakeName = `Person ${personIndex}`;
    const fakeUid = `person${personIndex}`;
    const fakeEmail = `${fakeUid}@example.com`;
    const fakeGithub = `ghuser-${personIndex}`;
    const fakeGitlab = `gluser-${personIndex}`;

    nameToFake[person.name] = fakeName;
    uidToFake[person.uid] = fakeUid;
    if (person.email) emailToFake[person.email] = fakeEmail;
    if (person.githubUsername) githubToFake[person.githubUsername] = fakeGithub;
    if (person.gitlabUsername) gitlabToFake[person.gitlabUsername] = fakeGitlab;
  }

  // Process VP
  if (roster && roster.vp) {
    addPerson(roster.vp);
  }

  // Process orgs: leaders then members, sorted by org key for determinism
  if (roster && roster.orgs) {
    const orgKeys = Object.keys(roster.orgs).sort();
    for (const orgKey of orgKeys) {
      const org = roster.orgs[orgKey];
      if (org.leader) addPerson(org.leader);
      if (org.members) {
        for (const member of org.members) {
          addPerson(member);
        }
      }
    }
  }

  /**
   * Get or create mapping for a name not in roster (former members, etc.)
   */
  function getOrCreateNameMapping(name) {
    if (nameToFake[name]) return nameToFake[name];
    unmappedIndex++;
    const fakeName = `Former Member ${unmappedIndex}`;
    const fakeUid = `former${unmappedIndex}`;
    nameToFake[name] = fakeName;
    uidToFake[name.toLowerCase().replace(/\s+/g, '')] = fakeUid;
    emailToFake[`${name.toLowerCase().replace(/\s+/g, '')}@example.com`] = `${fakeUid}@example.com`;
    return fakeName;
  }

  /**
   * Get or create mapping for a UID not in roster.
   */
  function getOrCreateUidMapping(uid) {
    if (uidToFake[uid]) return uidToFake[uid];
    unmappedIndex++;
    const fakeUid = `former${unmappedIndex}`;
    uidToFake[uid] = fakeUid;
    return fakeUid;
  }

  /**
   * Get or create mapping for a GitHub username.
   */
  function getOrCreateGithubMapping(username) {
    if (githubToFake[username]) return githubToFake[username];
    unmappedIndex++;
    const fake = `ghuser-unmapped-${unmappedIndex}`;
    githubToFake[username] = fake;
    return fake;
  }

  /**
   * Get or create mapping for a GitLab username.
   */
  function getOrCreateGitlabMapping(username) {
    if (gitlabToFake[username]) return gitlabToFake[username];
    unmappedIndex++;
    const fake = `gluser-unmapped-${unmappedIndex}`;
    gitlabToFake[username] = fake;
    return fake;
  }

  /**
   * Get or create mapping for a Jira accountId.
   */
  function getOrCreateAccountIdMapping(accountId) {
    if (accountIdToFake[accountId]) return accountIdToFake[accountId];
    personIndex++;
    const fake = `fake-account-${personIndex}`;
    accountIdToFake[accountId] = fake;
    return fake;
  }

  /**
   * Get or create mapping for a Jira project prefix (e.g., "DEMO" from "DEMO-123").
   */
  function getOrCreateProjectMapping(projectPrefix) {
    if (jiraProjectToFake[projectPrefix]) return jiraProjectToFake[projectPrefix];
    projectIndex++;
    const fake = `TEST${projectIndex}`;
    jiraProjectToFake[projectPrefix] = fake;
    return fake;
  }

  /**
   * Anonymize a Jira issue key (e.g., "DEMO-123" -> "TEST1-123").
   */
  function anonymizeJiraKey(key) {
    if (!key || typeof key !== 'string') return key;
    const match = key.match(/^([A-Z][A-Z0-9]+)-(\d+)$/);
    if (!match) return key;
    const fakeProject = getOrCreateProjectMapping(match[1]);
    return `${fakeProject}-${match[2]}`;
  }

  /**
   * Anonymize a Jira issue summary using a deterministic pick from the pool.
   */
  function anonymizeIssueSummary(key) {
    if (!key) return 'Generic task description';
    const idx = hashString(key) % ISSUE_SUMMARIES.length;
    return ISSUE_SUMMARIES[idx];
  }

  /**
   * Anonymize a Jira board URL.
   */
  function anonymizeBoardUrl(url, boardIndex) {
    return `https://jira.example.com/jira/software/c/projects/TEST/boards/${boardIndex}`;
  }

  /**
   * Anonymize a value by checking all known mappings.
   * Returns the anonymized value or the original if not found.
   */
  function anonymizeValue(value) {
    if (!value || typeof value !== 'string') return value;
    if (nameToFake[value]) return nameToFake[value];
    if (uidToFake[value]) return uidToFake[value];
    if (emailToFake[value]) return emailToFake[value];
    if (githubToFake[value]) return githubToFake[value];
    if (gitlabToFake[value]) return gitlabToFake[value];
    if (accountIdToFake[value]) return accountIdToFake[value];
    return value;
  }

  return {
    nameToFake,
    uidToFake,
    emailToFake,
    githubToFake,
    gitlabToFake,
    accountIdToFake,
    jiraProjectToFake,
    anonymizeValue,
    getOrCreateNameMapping,
    getOrCreateUidMapping,
    getOrCreateGithubMapping,
    getOrCreateGitlabMapping,
    getOrCreateAccountIdMapping,
    getOrCreateProjectMapping,
    anonymizeJiraKey,
    anonymizeIssueSummary,
    anonymizeBoardUrl,
  };
}

module.exports = { buildMapping, hashString, ISSUE_SUMMARIES };
