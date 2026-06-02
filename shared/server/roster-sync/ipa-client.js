/**
 * IPA LDAP client for querying Red Hat org structure via LDAPS.
 *
 * Relocated from modules/team-data to shared/ so multiple modules
 * (org-roster, future modules) can access IPA without duplication.
 *
 * Connects to ipa.corp.redhat.com via LDAPS (TLS, port 636) with
 * authenticated bind using a service account. Credentials come from
 * environment variables -- never stored in config JSON.
 *
 * Environment:
 *   IPA_BIND_DN       - bind DN (required)
 *   IPA_BIND_PASSWORD - bind password (required)
 *   IPA_HOST          - defaults to ldaps://ipa.corp.redhat.com
 *   IPA_BASE_DN       - defaults to cn=users,cn=accounts,dc=ipa,dc=redhat,dc=com
 *   IPA_CA_CERT_PATH  - optional path to PEM CA certificate
 */

const ldap = require('ldapjs');
const fs = require('fs');
const path = require('path');
const tls = require('tls');

/**
 * Escape a value for safe use in an LDAP filter.
 * Per RFC 4515, these characters must be hex-escaped: *, (, ), \, NUL.
 */
function escapeLdapFilter(value) {
  if (!value) return '';
  return String(value)
    .replace(/\\/g, '\\5c')
    .replace(/\*/g, '\\2a')
    .replace(/\(/g, '\\28')
    .replace(/\)/g, '\\29')
    .replace(/\x00/g, '\\00'); // eslint-disable-line no-control-regex
}

const DEFAULT_HOST = 'ldaps://ipa.corp.redhat.com';
const DEFAULT_BASE_DN = 'cn=users,cn=accounts,dc=ipa,dc=redhat,dc=com';

const BUNDLED_CA_PATH = path.join(__dirname, '..', '..', '..', 'deploy', 'certs', 'internal-root-ca.pem');

const LDAP_ATTRS = [
  'cn', 'uid', 'mail', 'title', 'l', 'co',
  'manager', 'rhatGeo', 'rhatLocation', 'rhatOfficeLocation',
  'rhatCostCenter', 'rhatSocialUrl', 'memberOf'
];

function getConfig() {
  return {
    host: process.env.IPA_HOST || DEFAULT_HOST,
    baseDn: process.env.IPA_BASE_DN || DEFAULT_BASE_DN,
    bindDn: process.env.IPA_BIND_DN || '',
    bindPassword: process.env.IPA_BIND_PASSWORD || '',
    caCertPath: process.env.IPA_CA_CERT_PATH || ''
  };
}

function getIpaStatus() {
  return {
    bindDnSet: !!process.env.IPA_BIND_DN,
    passwordSet: !!process.env.IPA_BIND_PASSWORD,
    host: process.env.IPA_HOST || DEFAULT_HOST,
    baseDn: process.env.IPA_BASE_DN || DEFAULT_BASE_DN,
    caCertSet: !!process.env.IPA_CA_CERT_PATH,
    ready: !!(process.env.IPA_BIND_DN && process.env.IPA_BIND_PASSWORD)
  };
}

function buildTlsOptions(caCertPath) {
  var certPath = caCertPath || '';

  if (!certPath) {
    try {
      fs.accessSync(BUNDLED_CA_PATH);
      certPath = BUNDLED_CA_PATH;
    } catch {
      // no bundled cert available
    }
  }

  if (certPath) {
    try {
      var cert = fs.readFileSync(certPath);
      console.log('[ipa-client] Loaded CA cert from ' + certPath);
      return { ca: (tls.rootCertificates || []).concat([cert]) };
    } catch (err) {
      console.warn('[ipa-client] Could not read CA cert at ' + certPath + ': ' + err.message);
    }
  }

  return {};
}

function createClient() {
  var config = getConfig();

  if (!config.bindDn || !config.bindPassword) {
    throw new Error('IPA_BIND_DN and IPA_BIND_PASSWORD must be set');
  }

  var tlsOptions = buildTlsOptions(config.caCertPath);
  var client = ldap.createClient({
    url: config.host,
    connectTimeout: 10000,
    timeout: 30000,
    tlsOptions: tlsOptions,
    reconnect: false
  });

  client.on('error', function(err) {
    console.error('[ipa-client] LDAP client error:', err.message);
  });

  return { client: client, config: config };
}

function bindClient(client, bindDn, bindPassword) {
  return new Promise(function(resolve, reject) {
    client.bind(bindDn, bindPassword, function(err) {
      if (err) return reject(new Error('LDAP bind failed: ' + err.message));
      resolve();
    });
  });
}

function searchEntries(client, baseDn, filter, attrs, options) {
  return new Promise(function(resolve, reject) {
    var opts = {
      filter: filter,
      scope: 'sub',
      attributes: attrs || LDAP_ATTRS
    };
    if (options && options.sizeLimit) opts.sizeLimit = options.sizeLimit;

    client.search(baseDn, opts, function(err, res) {
      if (err) return reject(err);

      var entries = [];
      res.on('searchEntry', function(entry) {
        var obj = {};
        for (var i = 0; i < entry.attributes.length; i++) {
          var attr = entry.attributes[i];
          obj[attr.type] = attr.values.length === 1 ? attr.values[0] : attr.values;
        }
        entries.push(obj);
      });
      res.on('error', function(err) {
        reject(err);
      });
      res.on('end', function() {
        resolve(entries);
      });
    });
  });
}

/**
 * Extract all GitHub URL candidates from rhatSocialUrl.
 * IPA stores both personal profiles and org associations, so we
 * return all matches and let the caller pick the right one.
 */
function extractAllGithubCandidates(entry) {
  var urls = entry.rhatSocialUrl;
  if (!urls) return [];
  var list = Array.isArray(urls) ? urls : [urls];
  var candidates = [];
  for (var i = 0; i < list.length; i++) {
    var match = list[i].match(/^Github->https?:\/\/github\.com\/([^/\s]+)\/?$/);
    if (match) candidates.push(match[1]);
  }
  return candidates;
}

/**
 * Extract all GitLab URL candidates from rhatSocialUrl.
 */
function extractAllGitlabCandidates(entry) {
  var urls = entry.rhatSocialUrl;
  if (!urls) return [];
  var list = Array.isArray(urls) ? urls : [urls];
  var candidates = [];
  for (var i = 0; i < list.length; i++) {
    var match = list[i].match(/^Gitlab->https?:\/\/gitlab\.com\/([^/\s]+)\/?$/);
    if (match) candidates.push(match[1]);
  }
  return candidates;
}

/**
 * Pick the best candidate from a list of GitHub/GitLab usernames
 * by preferring one that resembles the person's uid or name.
 * Returns { username, needsValidation } — needsValidation is true
 * when we had multiple candidates and couldn't confidently pick one.
 */
function pickBestCandidate(candidates, entry) {
  if (candidates.length === 0) return { username: null, needsValidation: false };

  var uid = (entry.uid || '').toLowerCase();
  var nameParts = (entry.cn || '').toLowerCase().split(/\s+/);
  var firstName = nameParts[0] || '';
  var lastName = nameParts[nameParts.length - 1] || '';

  for (var i = 0; i < candidates.length; i++) {
    var c = candidates[i].toLowerCase();
    // Match against uid
    if (c === uid) return { username: candidates[i], needsValidation: false };
    // Match against name-based patterns
    if (firstName && lastName) {
      if (c === firstName + lastName ||
          c === firstName + '-' + lastName ||
          c === firstName + '.' + lastName ||
          c === firstName[0] + lastName) {
        return { username: candidates[i], needsValidation: false };
      }
    }
  }

  // No heuristic match — flag all candidates for API validation.
  // This catches single-entry cases where the URL is an org, not a user.
  return { username: candidates[0], needsValidation: true, candidates: candidates };
}

function extractGithubUsername(entry) {
  var candidates = extractAllGithubCandidates(entry);
  return pickBestCandidate(candidates, entry).username;
}

function extractGitlabUsername(entry) {
  var candidates = extractAllGitlabCandidates(entry);
  return pickBestCandidate(candidates, entry).username;
}

function extractManagerUid(entry) {
  if (!entry.manager) return null;
  var val = Array.isArray(entry.manager) ? entry.manager[0] : entry.manager;
  var match = val.match(/^uid=([^,]+),/);
  return match ? match[1] : null;
}

function entryToPerson(entry) {
  var ghResult = pickBestCandidate(extractAllGithubCandidates(entry), entry);
  var glResult = pickBestCandidate(extractAllGitlabCandidates(entry), entry);

  var person = {
    uid: entry.uid || '',
    name: entry.cn || '',
    email: entry.mail || '',
    title: entry.title || '',
    city: entry.l || '',
    country: entry.co || '',
    geo: entry.rhatGeo || '',
    location: entry.rhatLocation || '',
    officeLocation: entry.rhatOfficeLocation || '',
    costCenter: entry.rhatCostCenter || '',
    managerUid: extractManagerUid(entry),
    githubUsername: ghResult.username,
    gitlabUsername: glResult.username
  };

  // Attach validation metadata for the sync pipeline to resolve via API
  if (ghResult.needsValidation || glResult.needsValidation) {
    person._usernameValidation = {};
    if (ghResult.needsValidation) {
      person._usernameValidation.github = ghResult.candidates;
    }
    if (glResult.needsValidation) {
      person._usernameValidation.gitlab = glResult.candidates;
    }
  }

  return person;
}

/**
 * Recursively traverse an org tree starting from a root UID.
 * Returns { leader, people } where people is a flat array including the leader.
 */
async function traverseOrg(client, baseDn, rootUid, excludedTitles) {
  var rootEntries = await searchEntries(client, baseDn, '(uid=' + escapeLdapFilter(rootUid) + ')');
  if (rootEntries.length === 0) {
    throw new Error('Could not find ' + rootUid + ' in IPA');
  }

  var leader = entryToPerson(rootEntries[0]);
  var people = [leader];
  var visited = new Set();

  async function recurse(managerUid) {
    if (visited.has(managerUid)) return;
    visited.add(managerUid);
    var filter = '(manager=uid=' + escapeLdapFilter(managerUid) + ',' + baseDn + ')';
    var reports = await searchEntries(client, baseDn, filter);

    for (var i = 0; i < reports.length; i++) {
      // Skip deprovisioned accounts (no group memberships in IPA)
      if (!reports[i].memberOf) continue;

      var person = entryToPerson(reports[i]);

      if (excludedTitles && excludedTitles.length > 0) {
        var excluded = false;
        for (var j = 0; j < excludedTitles.length; j++) {
          if ((person.title || '').includes(excludedTitles[j])) {
            excluded = true;
            break;
          }
        }
        if (excluded) continue;
      }

      people.push(person);
      await recurse(person.uid);
    }
  }

  await recurse(rootUid);
  return { leader: leader, people: people };
}

/**
 * Look up a single person by UID.
 */
async function lookupPerson(client, baseDn, uid) {
  var entries = await searchEntries(client, baseDn, '(uid=' + escapeLdapFilter(uid) + ')');
  if (entries.length === 0) return null;
  return entryToPerson(entries[0]);
}

/**
 * Test the IPA connection. Returns { ok, message }.
 */
async function testConnection() {
  var conn;
  try {
    conn = createClient();
    await bindClient(conn.client, conn.config.bindDn, conn.config.bindPassword);
    return { ok: true, message: 'Connected and authenticated successfully' };
  } catch (err) {
    return { ok: false, message: err.message };
  } finally {
    if (conn && conn.client) {
      conn.client.unbind(function() {});
    }
  }
}

/**
 * Search for people across multiple LDAP fields (cn, uid, mail).
 * Returns an array of entryToPerson() results.
 *
 * @param {object} client - Bound LDAP client
 * @param {string} baseDn - LDAP base DN
 * @param {string} query - Search query string
 * @param {number} [limit=10] - Maximum results (passed as sizeLimit to LDAP)
 */
async function searchPeople(client, baseDn, query, limit) {
  if (!query || !query.trim()) return [];
  var escaped = escapeLdapFilter(query.trim());
  var filter = '(|(cn=*' + escaped + '*)(uid=*' + escaped + '*)(mail=*' + escaped + '*))';
  var sizeLimit = limit || 10;
  var entries = await searchEntries(client, baseDn, filter, LDAP_ATTRS, { sizeLimit: sizeLimit });
  return entries.map(entryToPerson);
}

/**
 * Create an IPA client with bound credentials.
 * Connection lifecycle is caller-managed: call createConnection() to get a raw
 * LDAP client, use it with traverseOrg/lookupPerson/searchPeople (which take
 * client + baseDn params), then unbind in a finally block.
 *
 * @param {{ bindDn: string, bindPassword: string, host?: string, baseDn?: string, caCertPath?: string }} config
 * @returns {{ createConnection: Function, bindClient: Function, traverseOrg: Function, lookupPerson: Function, searchPeople: Function, testConnection: Function, getIpaStatus: Function, getConfig: Function }}
 */
function createIpaClient(config) {
  var resolvedConfig = {
    host: (config && config.host) || DEFAULT_HOST,
    baseDn: (config && config.baseDn) || DEFAULT_BASE_DN,
    bindDn: (config && config.bindDn) || '',
    bindPassword: (config && config.bindPassword) || '',
    caCertPath: (config && config.caCertPath) || ''
  };

  function instanceCreateConnection() {
    if (!resolvedConfig.bindDn || !resolvedConfig.bindPassword) {
      throw new Error('IPA_BIND_DN and IPA_BIND_PASSWORD must be set');
    }

    var tlsOptions = buildTlsOptions(resolvedConfig.caCertPath);
    var client = ldap.createClient({
      url: resolvedConfig.host,
      connectTimeout: 10000,
      timeout: 30000,
      tlsOptions: tlsOptions,
      reconnect: false
    });

    client.on('error', function(err) {
      console.error('[ipa-client] LDAP client error:', err.message);
    });

    return { client: client, config: resolvedConfig };
  }

  function instanceGetIpaStatus() {
    return {
      bindDnSet: !!resolvedConfig.bindDn,
      passwordSet: !!resolvedConfig.bindPassword,
      host: resolvedConfig.host,
      baseDn: resolvedConfig.baseDn,
      caCertSet: !!resolvedConfig.caCertPath,
      ready: !!(resolvedConfig.bindDn && resolvedConfig.bindPassword)
    };
  }

  async function instanceTestConnection() {
    var conn;
    try {
      conn = instanceCreateConnection();
      await bindClient(conn.client, conn.config.bindDn, conn.config.bindPassword);
      return { ok: true, message: 'Connected and authenticated successfully' };
    } catch (err) {
      return { ok: false, message: err.message };
    } finally {
      if (conn && conn.client) {
        conn.client.unbind(function() {});
      }
    }
  }

  return {
    createConnection: instanceCreateConnection,
    bindClient: bindClient,
    traverseOrg: traverseOrg,
    lookupPerson: lookupPerson,
    searchPeople: searchPeople,
    testConnection: instanceTestConnection,
    getIpaStatus: instanceGetIpaStatus,
    getConfig: function() {
      return {
        host: resolvedConfig.host,
        baseDn: resolvedConfig.baseDn,
        bindDn: resolvedConfig.bindDn,
        bindPassword: resolvedConfig.bindPassword ? '***' : '',
        caCertPath: resolvedConfig.caCertPath
      };
    }
  };
}

module.exports = {
  createClient,
  bindClient,
  traverseOrg,
  lookupPerson,
  searchPeople,
  testConnection,
  getIpaStatus,
  getConfig,
  entryToPerson,
  escapeLdapFilter,
  extractGithubUsername,
  extractGitlabUsername,
  extractAllGithubCandidates,
  extractAllGitlabCandidates,
  pickBestCandidate,
  createIpaClient
};
