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

function searchEntries(client, baseDn, filter, attrs) {
  return new Promise(function(resolve, reject) {
    var opts = {
      filter: filter,
      scope: 'sub',
      attributes: attrs || LDAP_ATTRS
    };

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

function extractGithubUsername(entry) {
  var urls = entry.rhatSocialUrl;
  if (!urls) return null;
  var list = Array.isArray(urls) ? urls : [urls];
  for (var i = 0; i < list.length; i++) {
    var match = list[i].match(/^Github->https?:\/\/github\.com\/([^/\s]+)\/?$/);
    if (match) return match[1];
  }
  return null;
}

function extractGitlabUsername(entry) {
  var urls = entry.rhatSocialUrl;
  if (!urls) return null;
  var list = Array.isArray(urls) ? urls : [urls];
  for (var i = 0; i < list.length; i++) {
    var match = list[i].match(/^Gitlab->https?:\/\/gitlab\.com\/([^/\s]+)\/?$/);
    if (match) return match[1];
  }
  return null;
}

function extractManagerUid(entry) {
  if (!entry.manager) return null;
  var val = Array.isArray(entry.manager) ? entry.manager[0] : entry.manager;
  var match = val.match(/^uid=([^,]+),/);
  return match ? match[1] : null;
}

function entryToPerson(entry) {
  return {
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
    githubUsername: extractGithubUsername(entry),
    gitlabUsername: extractGitlabUsername(entry)
  };
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

module.exports = {
  createClient,
  bindClient,
  traverseOrg,
  lookupPerson,
  testConnection,
  getIpaStatus,
  entryToPerson,
  escapeLdapFilter,
  extractGithubUsername,
  extractGitlabUsername
};
