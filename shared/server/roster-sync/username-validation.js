/**
 * Validate GitHub/GitLab username candidates via their APIs.
 *
 * When IPA rhatSocialUrl contains multiple entries (personal profile + org
 * associations), heuristics may not resolve which is the user's personal
 * account. This module calls the GitHub/GitLab API to check whether a
 * candidate is a User or an Organization, picking the correct one.
 */

var _fetch = globalThis.fetch;

var BATCH_DELAY_MS = 200;

// Allow tests to inject a mock fetch
function _getFetch() { return _fetch; }
function _setFetch(fn) { _fetch = fn; }

function delay(ms) {
  return new Promise(function(resolve) { setTimeout(resolve, ms); });
}

/**
 * Validate GitHub candidates for a single person.
 * Calls GET /users/:login and checks `type === "User"`.
 *
 * @param {string[]} candidates - GitHub login candidates
 * @returns {string|null} The first candidate that is a User, or null
 */
async function validateGithubCandidates(candidates, options) {
  var token = (options && options.githubToken) || null;
  var headers = {
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'team-tracker'
  };
  if (token) {
    headers['Authorization'] = 'token ' + token;
  }

  for (var i = 0; i < candidates.length; i++) {
    try {
      var url = 'https://api.github.com/users/' + encodeURIComponent(candidates[i]);
      var res = await _getFetch()(url, { headers: headers });
      if (res.ok) {
        var data = await res.json();
        if (data.type === 'User') {
          return candidates[i];
        }
      }
      if (i < candidates.length - 1) await delay(BATCH_DELAY_MS);
    } catch {
      // Skip failed lookups
    }
  }

  return null;
}

/**
 * Validate GitLab candidates for a single person.
 * Calls GET /api/v4/users?username=:login — returns users only (not groups).
 *
 * @param {string[]} candidates - GitLab username candidates
 * @param {{ baseUrl?: string }} [options]
 * @returns {string|null} The first candidate that is a user, or null
 */
async function validateGitlabCandidates(candidates, options) {
  var token = (options && options.gitlabToken) || null;
  var baseUrl = (options && options.baseUrl) || 'https://gitlab.com';
  var headers = { 'Accept': 'application/json' };
  if (token) {
    headers['PRIVATE-TOKEN'] = token;
  }

  for (var i = 0; i < candidates.length; i++) {
    try {
      var url = baseUrl + '/api/v4/users?username=' + encodeURIComponent(candidates[i]);
      var res = await _getFetch()(url, { headers: headers });
      if (res.ok) {
        var data = await res.json();
        // GitLab returns an array; if a user with that username exists, it's a user account
        if (Array.isArray(data) && data.length > 0) {
          return candidates[i];
        }
      }
      if (i < candidates.length - 1) await delay(BATCH_DELAY_MS);
    } catch {
      // Skip failed lookups
    }
  }

  return null;
}

/**
 * Validate ambiguous usernames for all people who have _usernameValidation metadata.
 *
 * @param {object[]} people - Array of person objects from entryToPerson
 * @param {{ githubToken?: string, gitlabToken?: string }} [tokens] - API tokens for validation
 * @returns {{ githubValidated: number, gitlabValidated: number, githubCleared: number, gitlabCleared: number }}
 */
async function validateAmbiguousUsernames(people, tokens) {
  var stats = { githubValidated: 0, gitlabValidated: 0, githubCleared: 0, gitlabCleared: 0 };

  var needsValidation = people.filter(function(p) { return p._usernameValidation; });
  if (needsValidation.length === 0) return stats;

  console.log('[username-validation] Validating ' + needsValidation.length + ' people with ambiguous usernames');

  for (var i = 0; i < needsValidation.length; i++) {
    var person = needsValidation[i];
    var validation = person._usernameValidation;

    if (validation.github) {
      var ghUser = await validateGithubCandidates(validation.github, tokens);
      if (ghUser) {
        person.githubUsername = ghUser;
        stats.githubValidated++;
        console.log('[username-validation] GitHub: ' + person.name + ' -> ' + ghUser + ' (validated from ' + validation.github.length + ' candidates)');
      } else {
        person.githubUsername = null;
        stats.githubCleared++;
        console.log('[username-validation] GitHub: ' + person.name + ' -> cleared (no valid user among ' + validation.github.join(', ') + ')');
      }
    }

    if (validation.gitlab) {
      var glUser = await validateGitlabCandidates(validation.gitlab, tokens);
      if (glUser) {
        person.gitlabUsername = glUser;
        stats.gitlabValidated++;
        console.log('[username-validation] GitLab: ' + person.name + ' -> ' + glUser + ' (validated from ' + validation.gitlab.length + ' candidates)');
      } else {
        person.gitlabUsername = null;
        stats.gitlabCleared++;
        console.log('[username-validation] GitLab: ' + person.name + ' -> cleared (no valid user among ' + validation.gitlab.join(', ') + ')');
      }
    }

    // Clean up internal metadata
    delete person._usernameValidation;

    // Delay between people to avoid API rate limiting
    if (i < needsValidation.length - 1) await delay(BATCH_DELAY_MS);
  }

  console.log('[username-validation] Complete: GitHub validated=' + stats.githubValidated + ' cleared=' + stats.githubCleared +
    ', GitLab validated=' + stats.gitlabValidated + ' cleared=' + stats.gitlabCleared);

  return stats;
}

module.exports = { validateAmbiguousUsernames, validateGithubCandidates, validateGitlabCandidates, _setFetch };
