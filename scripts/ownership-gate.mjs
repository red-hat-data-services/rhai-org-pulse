#!/usr/bin/env node
/**
 * Evaluate whether a pull request satisfies Org Pulse ownership policy.
 *
 * This intentionally uses only GitHub's API. The workflow that calls it runs
 * from the default branch and never checks out or executes pull-request code.
 */

import { pathToFileURL } from 'node:url';

export const STATUS_CONTEXT = 'Ownership Gate';
export const MAINTAINER_TEAM = '@red-hat-data-services/org-pulse-maintainers';
export const POLICY_PATHS = new Set([
  '.github/CODEOWNERS',
  '.github/workflows/ownership-gate.yml',
  'scripts/ownership-gate.mjs'
]);

const COMMENT_MARKER = '<!-- ownership-gate -->';
const WRITE_PERMISSIONS = new Set(['admin', 'maintain', 'write']);

function normalizePath(path) {
  return String(path || '').replace(/^\/+/, '').replace(/\\/g, '/');
}

function normalizeLogin(login) {
  return String(login || '').replace(/^@/, '').toLowerCase();
}

function isTeamOwner(owner) {
  return owner.startsWith('@') && owner.slice(1).includes('/');
}

function isBot(user) {
  return user?.type === 'Bot' || String(user?.login || '').endsWith('[bot]');
}

function escapeRegex(value) {
  return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}

/**
 * Turn a CODEOWNERS glob into a RegExp. GitHub does not support negation or
 * character ranges in CODEOWNERS, so failing closed on those constructs keeps
 * this evaluator from silently disagreeing with GitHub's parser.
 */
function globSource(pattern) {
  let source = '';
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];
    if (character === '*') {
      if (pattern[index + 1] === '*') {
        if (pattern[index + 2] === '/') {
          source += '(?:.*/)?';
          index += 2;
        } else {
          source += '.*';
          index += 1;
        }
      } else {
        source += '[^/]*';
      }
    } else if (character === '?') {
      source += '[^/]';
    } else {
      source += escapeRegex(character);
    }
  }
  return source;
}

function validatePattern(pattern) {
  if (!pattern) {
    throw new Error('CODEOWNERS contains an empty pattern.');
  }
  if (pattern.startsWith('!') || pattern.includes('[') || pattern.includes(']') || pattern.includes('\\')) {
    throw new Error(
      `Unsupported CODEOWNERS pattern "${pattern}". ` +
      'Ownership Gate supports GitHub CODEOWNERS patterns without negation, character ranges, or escapes.'
    );
  }
}

function validateOwner(owner) {
  if (!owner.startsWith('@')) {
    throw new Error(
      `Unsupported CODEOWNERS owner "${owner}". Ownership Gate requires GitHub user or team handles.`
    );
  }
  const handle = owner.slice(1);
  if (!handle || handle.split('/').length > 2) {
    throw new Error(`Unsupported CODEOWNERS owner "${owner}".`);
  }
}

/** Parse a CODEOWNERS file, retaining empty-owner exception rules. */
export function parseCodeowners(contents) {
  const entries = [];

  for (const [lineNumber, rawLine] of String(contents).split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const [pattern, ...owners] = line.split(/\s+/);
    validatePattern(pattern);
    owners.forEach(validateOwner);
    entries.push({
      line: lineNumber + 1,
      pattern,
      owners: owners.map(owner => owner.toLowerCase())
    });
  }

  if (!entries.length) {
    throw new Error('CODEOWNERS contains no ownership rules.');
  }
  return entries;
}

/**
 * Match the useful CODEOWNERS / gitignore-style patterns used by this repo.
 * Later matching entries win, which is essential for explicit no-owner paths.
 */
export function patternMatches(pattern, filePath) {
  validatePattern(pattern);
  const path = normalizePath(filePath);
  const anchored = pattern.startsWith('/');
  const body = anchored ? pattern.slice(1) : pattern;

  if (pattern === '*') {
    return true;
  }

  if (body.endsWith('/')) {
    const directory = body.slice(0, -1);
    if (anchored) {
      return path === directory || path.startsWith(`${directory}/`);
    }
    return path.split('/').some((_, index, parts) => {
      const candidate = parts.slice(index).join('/');
      return candidate === directory || candidate.startsWith(`${directory}/`);
    });
  }

  const source = globSource(body);
  if (anchored) {
    return new RegExp(`^${source}$`).test(path);
  }
  if (!body.includes('/')) {
    const segment = new RegExp(`^${source}$`);
    return path.split('/').some(part => segment.test(part));
  }
  return new RegExp(`(?:^|.*/)${source}$`).test(path);
}

/** Return the owners from the final CODEOWNERS rule matching a path. */
export function ownersForPath(entries, filePath) {
  let winner = null;
  for (const entry of entries) {
    if (patternMatches(entry.pattern, filePath)) {
      winner = entry;
    }
  }
  return winner ? [...winner.owners] : null;
}

function teamHasMember(teamMembers, owner, login) {
  const members = teamMembers instanceof Map ? teamMembers.get(owner) : teamMembers?.[owner];
  return Boolean(members && new Set(members).has(normalizeLogin(login)));
}

/** Whether a GitHub user matches any individual or team owner. */
export function userMatchesOwners(login, owners, teamMembers) {
  const normalizedLogin = normalizeLogin(login);
  return owners.some(owner => {
    if (isTeamOwner(owner)) {
      return teamHasMember(teamMembers, owner, normalizedLogin);
    }
    return normalizeLogin(owner) === normalizedLogin;
  });
}

function policyForPath(entries, filePath, maintainerTeam) {
  const path = normalizePath(filePath);
  if (POLICY_PATHS.has(path)) {
    return {
      kind: 'policy',
      owners: [maintainerTeam],
      allowAuthorSelfApproval: false
    };
  }

  const owners = ownersForPath(entries, path);
  if (!owners || owners.length === 0) {
    return {
      kind: 'unowned',
      owners: [maintainerTeam],
      allowAuthorSelfApproval: false
    };
  }

  return {
    kind: 'codeowner',
    owners,
    allowAuthorSelfApproval: true
  };
}

/**
 * Keep only approvals made on the PR's current head. A new push therefore
 * always requires any needed owner approval to be refreshed.
 */
export function currentApprovers(reviews, { headSha, authorLogin }) {
  const latestByReviewer = new Map();
  for (const review of reviews) {
    const reviewer = review.user;
    const login = normalizeLogin(reviewer?.login);
    if (!login || login === normalizeLogin(authorLogin) || isBot(reviewer)) {
      continue;
    }
    if (review.commit_id !== headSha) {
      continue;
    }
    const current = latestByReviewer.get(login);
    const submittedAt = Date.parse(review.submitted_at || 0) || 0;
    const currentSubmittedAt = Date.parse(current?.submitted_at || 0) || 0;
    if (!current || submittedAt >= currentSubmittedAt) {
      latestByReviewer.set(login, review);
    }
  }

  return [...latestByReviewer.entries()]
    .filter(([, review]) => review.state === 'APPROVED')
    .map(([login]) => login);
}

/**
 * Evaluate ownership for all changed paths. One approval may cover multiple
 * areas when the approving owner matches each area's CODEOWNERS rule.
 */
export function evaluateOwnership({
  entries,
  changedFiles,
  authorLogin,
  approvedReviewers,
  teamMembers,
  maintainerTeam = MAINTAINER_TEAM
}) {
  const grouped = new Map();
  for (const filePath of [...new Set(changedFiles.map(normalizePath))].sort()) {
    const policy = policyForPath(entries, filePath, maintainerTeam);
    const ownerKey = [...policy.owners].sort().join(',');
    const key = `${policy.kind}:${policy.allowAuthorSelfApproval}:${ownerKey}`;
    const area = grouped.get(key) || { ...policy, paths: [] };
    area.paths.push(filePath);
    grouped.set(key, area);
  }

  const areas = [...grouped.values()].map(area => {
    const authorOwns = area.allowAuthorSelfApproval &&
      userMatchesOwners(authorLogin, area.owners, teamMembers);
    const approver = authorOwns ? null : approvedReviewers.find(reviewer =>
      userMatchesOwners(reviewer, area.owners, teamMembers)
    );
    return {
      ...area,
      authorOwns,
      approver: approver || null,
      satisfied: authorOwns || Boolean(approver)
    };
  });

  return {
    passed: areas.every(area => area.satisfied),
    areas
  };
}

function formatOwners(owners) {
  return owners.map(owner => `\`${owner}\``).join(', ');
}

function formatPaths(paths) {
  return paths.map(path => `\`${path}\``).join(', ');
}

export function renderComment(result, authorLogin, headSha) {
  const title = result.passed ? '✅ passed' : '❌ approval required';
  const lines = [
    COMMENT_MARKER,
    `## Ownership Gate — ${title}`,
    '',
    `Evaluated current head \`${headSha.slice(0, 12)}\` for author \`@${authorLogin}\`.`,
    ''
  ];

  for (const area of result.areas) {
    const label = area.kind === 'policy'
      ? 'policy change'
      : area.kind === 'unowned'
        ? 'intentionally unowned path'
        : 'CODEOWNERS';

    if (area.authorOwns) {
      lines.push(`- ✅ ${formatPaths(area.paths)} — author owns this ${label}.`);
    } else if (area.approver) {
      lines.push(`- ✅ ${formatPaths(area.paths)} — approved by \`@${area.approver}\`.`);
    } else {
      lines.push(
        `- ❌ ${formatPaths(area.paths)} — requires approval from ${formatOwners(area.owners)}.`
      );
    }
  }

  lines.push('', '> Only approvals on the current PR head count.');
  return `${lines.join('\n')}\n`;
}

class GitHubApi {
  constructor({ token, repository, apiUrl }) {
    this.token = token;
    this.repository = repository;
    this.apiUrl = (apiUrl || 'https://api.github.com').replace(/\/$/, '');
  }

  async request(path, { method = 'GET', body } = {}) {
    const response = await fetch(`${this.apiUrl}${path}`, {
      method,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28'
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`${method} ${path} failed (${response.status}): ${text}`);
    }
    if (response.status === 204) {
      return null;
    }
    return response.json();
  }

  async paginated(path) {
    const all = [];
    for (let page = 1; ; page += 1) {
      const separator = path.includes('?') ? '&' : '?';
      const pageItems = await this.request(`${path}${separator}per_page=100&page=${page}`);
      all.push(...pageItems);
      if (pageItems.length < 100) {
        return all;
      }
    }
  }

  async getPullRequest(number) {
    return this.request(`/repos/${this.repository}/pulls/${number}`);
  }

  async getCodeowners(ref) {
    const content = await this.request(
      `/repos/${this.repository}/contents/.github/CODEOWNERS?ref=${encodeURIComponent(ref)}`
    );
    return Buffer.from(content.content, 'base64').toString('utf8');
  }

  async getChangedFiles(number) {
    return this.paginated(`/repos/${this.repository}/pulls/${number}/files`);
  }

  async getReviews(number) {
    return this.paginated(`/repos/${this.repository}/pulls/${number}/reviews`);
  }

  async getTeamMembers(owner) {
    const [organization, teamSlug] = owner.slice(1).split('/');
    const members = await this.paginated(
      `/orgs/${organization}/teams/${teamSlug}/members`
    );
    return new Set(members.map(member => normalizeLogin(member.login)));
  }

  async collaboratorPermission(login) {
    try {
      const result = await this.request(
        `/repos/${this.repository}/collaborators/${encodeURIComponent(login)}/permission`
      );
      return result.permission;
    } catch (error) {
      if (error.message.includes('(404)')) {
        return 'none';
      }
      throw error;
    }
  }

  async setStatus(sha, { state, description, targetUrl }) {
    return this.request(`/repos/${this.repository}/statuses/${sha}`, {
      method: 'POST',
      body: {
        state,
        context: STATUS_CONTEXT,
        description,
        target_url: targetUrl
      }
    });
  }

  async updateComment(prNumber, body, botLogin) {
    const comments = await this.paginated(
      `/repos/${this.repository}/issues/${prNumber}/comments`
    );
    const existing = comments.find(comment =>
      comment.user?.login === botLogin && comment.body?.includes(COMMENT_MARKER)
    );
    if (existing) {
      return this.request(`/repos/${this.repository}/issues/comments/${existing.id}`, {
        method: 'PATCH',
        body: { body }
      });
    }
    return this.request(`/repos/${this.repository}/issues/${prNumber}/comments`, {
      method: 'POST',
      body: { body }
    });
  }
}

function statusDetails(result) {
  if (result.passed) {
    return { state: 'success', description: 'Ownership policy satisfied' };
  }
  const missing = result.areas.filter(area => !area.satisfied).length;
  return {
    state: 'failure',
    description: `Approval required for ${missing} ownership area${missing === 1 ? '' : 's'}`
  };
}

function allTeamOwners(entries, maintainerTeam) {
  const owners = new Set([maintainerTeam]);
  for (const entry of entries) {
    for (const owner of entry.owners) {
      if (isTeamOwner(owner)) {
        owners.add(owner);
      }
    }
  }
  return [...owners];
}

function changedPathNames(files) {
  const paths = new Set();
  for (const file of files) {
    if (file.filename) {
      paths.add(normalizePath(file.filename));
    }
    // A rename can remove a protected or intentionally-unowned path, so
    // evaluate both sides of it rather than creating a bypass via rename.
    if (file.previous_filename) {
      paths.add(normalizePath(file.previous_filename));
    }
  }
  return [...paths];
}

function targetUrl() {
  const server = process.env.GITHUB_SERVER_URL || 'https://github.com';
  const runId = process.env.GITHUB_RUN_ID;
  return runId ? `${server}/${process.env.GITHUB_REPOSITORY}/actions/runs/${runId}` : undefined;
}

async function main() {
  const repository = process.env.GITHUB_REPOSITORY;
  const prNumber = process.env.PR_NUMBER;
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (!repository || !prNumber || !token) {
    throw new Error('GITHUB_REPOSITORY, PR_NUMBER, and GH_TOKEN are required.');
  }

  const api = new GitHubApi({
    token,
    repository,
    apiUrl: process.env.GITHUB_API_URL
  });
  const pullRequest = await api.getPullRequest(prNumber);
  const headSha = pullRequest.head.sha;
  process.env.OWNERSHIP_GATE_HEAD_SHA = headSha;
  const authorLogin = normalizeLogin(pullRequest.user.login);

  if (pullRequest.draft) {
    await api.setStatus(headSha, {
      state: 'pending',
      description: 'Draft pull request',
      targetUrl: targetUrl()
    });
    console.log('Ownership Gate is pending because this pull request is a draft.');
    return;
  }

  const entries = parseCodeowners(await api.getCodeowners(pullRequest.base.sha));
  const changedFiles = changedPathNames(await api.getChangedFiles(prNumber));
  const teamMembers = new Map();
  for (const team of allTeamOwners(entries, MAINTAINER_TEAM)) {
    teamMembers.set(team, await api.getTeamMembers(team));
  }

  const reviewers = currentApprovers(await api.getReviews(prNumber), {
    headSha,
    authorLogin
  });
  const approvedReviewers = [];
  for (const reviewer of reviewers) {
    const permission = await api.collaboratorPermission(reviewer);
    if (WRITE_PERMISSIONS.has(permission)) {
      approvedReviewers.push(reviewer);
    }
  }

  const result = evaluateOwnership({
    entries,
    changedFiles,
    authorLogin,
    approvedReviewers,
    teamMembers
  });
  const status = statusDetails(result);
  await api.setStatus(headSha, {
    ...status,
    targetUrl: targetUrl()
  });

  try {
    await api.updateComment(
      prNumber,
      renderComment(result, authorLogin, headSha),
      process.env.OWNERSHIP_GATE_BOT_LOGIN || 'rhai-org-pulse[bot]'
    );
  } catch (error) {
    // The commit status is the enforcement surface. A comment is helpful but
    // must not turn an otherwise correct policy result into an outage.
    console.warn(`Could not update Ownership Gate comment: ${error.message}`);
  }

  console.log(renderComment(result, authorLogin, headSha));
}

async function reportFatalError(error) {
  console.error(`Ownership Gate failed: ${error.stack || error.message}`);
  const repository = process.env.GITHUB_REPOSITORY;
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  const headSha = process.env.OWNERSHIP_GATE_HEAD_SHA;
  if (!repository || !token || !headSha) {
    return;
  }
  try {
    const api = new GitHubApi({ token, repository, apiUrl: process.env.GITHUB_API_URL });
    await api.setStatus(headSha, {
      state: 'error',
      description: 'Ownership Gate configuration error',
      targetUrl: targetUrl()
    });
  } catch (statusError) {
    console.error(`Could not publish Ownership Gate error status: ${statusError.message}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(async error => {
    await reportFatalError(error);
    process.exitCode = 1;
  });
}
