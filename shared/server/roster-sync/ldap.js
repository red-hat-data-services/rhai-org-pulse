/**
 * LDAP client for querying Red Hat org structure.
 * Uses ldapjs instead of shelling out to ldapsearch.
 */

const ldap = require('ldapjs');
const { LDAP_HOST, LDAP_USER_BASE, LDAP_ATTRS, EXCLUDED_TITLES } = require('./constants');

function createClient() {
  const client = ldap.createClient({
    url: LDAP_HOST,
    connectTimeout: 10000,
    timeout: 30000
  });
  return client;
}

function searchEntries(client, filter, attrs) {
  return new Promise(function(resolve, reject) {
    const opts = {
      filter: filter,
      scope: 'sub',
      attributes: attrs || LDAP_ATTRS
    };

    client.search(LDAP_USER_BASE, opts, function(err, res) {
      if (err) return reject(err);

      const entries = [];
      res.on('searchEntry', function(entry) {
        const obj = {};
        for (const attr of entry.attributes) {
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
  const urls = entry.rhatSocialUrl;
  if (!urls) return null;

  const list = Array.isArray(urls) ? urls : [urls];
  for (const url of list) {
    const match = url.match(/^Github->https?:\/\/github\.com\/([^/\s]+)\/?$/);
    if (match) return match[1];
  }
  return null;
}

function extractGitlabUsername(entry) {
  const urls = entry.rhatSocialUrl;
  if (!urls) return null;

  const list = Array.isArray(urls) ? urls : [urls];
  for (const url of list) {
    const match = url.match(/^Gitlab->https?:\/\/gitlab\.com\/([^/\s]+)\/?$/);
    if (match) return match[1];
  }
  return null;
}

function extractManagerUid(entry) {
  if (!entry.manager) return null;
  const val = Array.isArray(entry.manager) ? entry.manager[0] : entry.manager;
  const match = val.match(/^uid=([^,]+),/);
  return match ? match[1] : null;
}

function entryToPerson(entry) {
  return {
    name: entry.cn || '',
    uid: entry.uid || '',
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
 * Returns { leader, members } where members is a flat array.
 */
async function traverseOrg(client, rootUid) {
  const rootEntries = await searchEntries(client, `(uid=${rootUid})`);
  if (rootEntries.length === 0) {
    throw new Error(`Could not find ${rootUid} in LDAP`);
  }

  const leader = entryToPerson(rootEntries[0]);
  const members = [];

  async function recurse(managerUid, depth) {
    const filter = `(manager=uid=${managerUid},${LDAP_USER_BASE})`;
    const reports = await searchEntries(client, filter);

    for (const entry of reports) {
      const person = entryToPerson(entry);

      if (EXCLUDED_TITLES.some(t => (person.title || '').includes(t))) {
        continue;
      }

      members.push(person);
      await recurse(person.uid, depth + 1);
    }
  }

  await recurse(rootUid, 0);
  return { leader, members };
}

/**
 * Look up a single person by UID.
 */
async function lookupPerson(client, uid) {
  const entries = await searchEntries(client, `(uid=${uid})`);
  if (entries.length === 0) return null;
  return entryToPerson(entries[0]);
}

module.exports = {
  createClient,
  traverseOrg,
  lookupPerson,
  searchEntries,
  entryToPerson,
  extractGithubUsername
};
