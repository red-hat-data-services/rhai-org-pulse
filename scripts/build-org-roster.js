#!/usr/bin/env node

/**
 * Build org roster from Red Hat LDAP + GitHub validation.
 *
 * Usage:
 *   node scripts/build-org-roster.js              # use all 6 hardcoded org roots
 *   node scripts/build-org-roster.js fjansen      # scope to fjansen's org only
 *   node scripts/build-org-roster.js fjansen shgriffi  # multiple roots
 *
 * Requirements:
 *   - VPN connection to ldap.corp.redhat.com
 *   - GitHub CLI authenticated (gh auth login)
 *
 * Outputs: data/org-roster-full.json
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const LDAP_HOST = 'ldap://ldap.corp.redhat.com'
const LDAP_BASE = 'dc=redhat,dc=com'
const LDAP_ATTRS = ['cn', 'uid', 'mail', 'title', 'l', 'co', 'manager', 'rhatGeo', 'rhatLocation', 'rhatOfficeLocation', 'rhatCostCenter', 'rhatSocialUrl']

// The 6 org leaders to traverse under (used when no CLI args are provided)
const DEFAULT_ORG_ROOTS = [
  { uid: 'tgunders', name: 'Tom Gundersen' },
  { uid: 'shgriffi', name: 'Sherard Griffin' },
  { uid: 'crobson', name: 'Catherine Weeks' },
  { uid: 'tibrahim', name: 'Taneem Ibrahim' },
  { uid: 'moromila', name: 'Monica Romila' },
  { uid: 'kaixu', name: 'Kai Xu' }
]

// Allow overriding org roots via CLI args (UIDs only; names are looked up from LDAP)
const cliUids = process.argv.slice(2)
const ORG_ROOTS = cliUids.length > 0
  ? cliUids.map(uid => ({ uid, name: uid }))  // names filled in during main()
  : DEFAULT_ORG_ROOTS

const OUTPUT_PATH = path.join(__dirname, '..', 'data', 'org-roster-full.json')

// ── LDAP helpers ──

function ldapSearch(filter) {
  const cmd = [
    'ldapsearch', '-x', '-LLL',
    '-H', LDAP_HOST,
    '-b', LDAP_BASE,
    `"${filter}"`,
    ...LDAP_ATTRS
  ].join(' ')

  try {
    const raw = execSync(cmd, { encoding: 'utf8', timeout: 30000, maxBuffer: 10 * 1024 * 1024 })
    return parseLdapEntries(raw)
  } catch (err) {
    console.error(`LDAP query failed for filter: ${filter}`)
    console.error(err.message)
    return []
  }
}

function parseLdapEntries(raw) {
  const entries = []
  let current = null

  for (const line of raw.split('\n')) {
    if (line.startsWith('dn: ')) {
      if (current) entries.push(current)
      current = { dn: line.slice(4) }
    } else if (line.startsWith(' ') && current) {
      // LDIF continuation line — append to last attribute value
      const lastKey = current._lastKey
      if (lastKey) {
        if (Array.isArray(current[lastKey])) {
          current[lastKey][current[lastKey].length - 1] += line.slice(1)
        } else {
          current[lastKey] += line.slice(1)
        }
      }
    } else if (line.includes(': ') && current) {
      const idx = line.indexOf(': ')
      const key = line.slice(0, idx)
      const val = line.slice(idx + 2)

      if (current[key] !== undefined) {
        if (!Array.isArray(current[key])) {
          current[key] = [current[key]]
        }
        current[key].push(val)
      } else {
        current[key] = val
      }
      current._lastKey = key
    }
  }
  if (current) entries.push(current)

  // Clean up internal tracking key
  for (const e of entries) delete e._lastKey

  return entries
}

function extractGithubFromSocialUrls(entry) {
  const urls = entry.rhatSocialUrl
  if (!urls) return null

  const list = Array.isArray(urls) ? urls : [urls]
  for (const url of list) {
    const match = url.match(/^Github->https?:\/\/github\.com\/([^/\s]+)\/?$/)
    if (match) return match[1]
  }
  return null
}

function extractManagerUid(entry) {
  if (!entry.manager) return null
  const match = entry.manager.match(/^uid=([^,]+),/)
  return match ? match[1] : null
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
    githubUsername: extractGithubFromSocialUrls(entry)
  }
}

// ── Recursive org traversal ──

function fetchDirectReports(managerUid) {
  const filter = `(manager=uid=${managerUid},ou=users,${LDAP_BASE})`
  return ldapSearch(filter)
}

function fetchPerson(uid) {
  const filter = `(uid=${uid})`
  const entries = ldapSearch(filter)
  return entries.length > 0 ? entries[0] : null
}

function traverseOrg(rootUid, allPeople, depth = 0) {
  const reports = fetchDirectReports(rootUid)
  const indent = '  '.repeat(depth)

  const EXCLUDED_TITLES = ['Intern', 'Collaborative Partner', 'Independent Contractor']

  for (const entry of reports) {
    const person = entryToPerson(entry)

    if (EXCLUDED_TITLES.includes(person.title)) {
      console.log(`${indent}  [SKIP] ${person.name} (${person.uid}) - ${person.title}`)
      continue
    }

    console.log(`${indent}  ${person.name} (${person.uid}) - ${person.title}`)
    allPeople.push(person)

    // Recurse into this person's reports
    traverseOrg(person.uid, allPeople, depth + 1)
  }

  return allPeople
}

// ── GitHub validation ──

function validateGithubUsername(username) {
  try {
    const raw = execSync(`gh api users/${encodeURIComponent(username)} --jq '.type'`, {
      encoding: 'utf8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe']
    })
    const type = raw.trim()
    if (type !== 'User') {
      console.log(`  REJECTED: ${username} is a ${type}, not a User`)
      return false
    }
    return true
  } catch {
    return false
  }
}

function fetchOdhOrgMembers() {
  console.log('\nFetching opendatahub-io org members...')
  try {
    const raw = execSync(
      'gh api --paginate "/orgs/opendatahub-io/members?per_page=100" --jq ".[].login"',
      { encoding: 'utf8', timeout: 60000, maxBuffer: 5 * 1024 * 1024 }
    )
    const logins = raw.trim().split('\n').filter(Boolean)
    console.log(`  Found ${logins.length} org members`)
    return logins
  } catch (err) {
    console.error('  Failed to fetch opendatahub-io members:', err.message)
    return []
  }
}

function fetchGithubUserDetails(login) {
  try {
    const raw = execSync(
      `gh api users/${encodeURIComponent(login)} --jq '{ login: .login, name: .name, email: .email }'`,
      { encoding: 'utf8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] }
    )
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function normalizeForMatch(name) {
  if (!name) return ''
  return name.toLowerCase().replace(/[^a-z]/g, '')
}

function tryInferGithubFromOrg(person, odhMembers, odhDetailsCache) {
  const normalizedName = normalizeForMatch(person.name)
  const emailPrefix = person.email ? person.email.split('@')[0].toLowerCase() : ''
  const [firstName, ...lastParts] = person.name.split(' ')
  const lastName = lastParts[lastParts.length - 1] || ''

  for (const login of odhMembers) {
    // Check if we already fetched details for this login
    if (!odhDetailsCache[login]) {
      odhDetailsCache[login] = fetchGithubUserDetails(login) || { login }
    }
    const details = odhDetailsCache[login]

    // Match by GitHub profile name
    if (details.name && normalizeForMatch(details.name) === normalizedName) {
      return login
    }

    // Match by GitHub profile email
    if (details.email && person.email && details.email.toLowerCase() === person.email.toLowerCase()) {
      return login
    }

    // Match by login resembling email prefix (e.g., uid or email prefix)
    if (emailPrefix && login.toLowerCase() === emailPrefix) {
      return login
    }

    // Match by login containing first+last name patterns
    const loginLower = login.toLowerCase()
    const firstLower = firstName.toLowerCase()
    const lastLower = lastName.toLowerCase()
    if (lastLower.length > 2 && firstLower.length > 0) {
      if (loginLower === `${firstLower}${lastLower}` ||
          loginLower === `${firstLower}-${lastLower}` ||
          loginLower === `${firstLower}.${lastLower}` ||
          loginLower === `${firstLower[0]}${lastLower}`) {
        return login
      }
    }
  }

  return null
}

// ── Main ──

async function main() {
  console.log('Building org roster from LDAP...\n')

  // If roots were specified via CLI args, resolve their display names from LDAP
  if (cliUids.length > 0) {
    for (const root of ORG_ROOTS) {
      const entry = fetchPerson(root.uid)
      if (entry) root.name = entry.cn || root.uid
    }
    console.log(`Using CLI-specified roots: ${ORG_ROOTS.map(r => `${r.name} (${r.uid})`).join(', ')}`)
  }

  const orgData = {
    generatedAt: new Date().toISOString(),
    vp: { name: 'Steven Huels', uid: 'shuels' },
    orgs: {}
  }

  const allPeople = []

  for (const root of ORG_ROOTS) {
    console.log(`\nTraversing org: ${root.name} (${root.uid})`)

    // Fetch the root person's details
    const rootEntry = fetchPerson(root.uid)
    if (!rootEntry) {
      console.error(`  Could not find ${root.uid} in LDAP, skipping`)
      continue
    }

    const rootPerson = entryToPerson(rootEntry)
    const reports = []
    traverseOrg(root.uid, reports, 1)

    orgData.orgs[root.uid] = {
      leader: rootPerson,
      members: reports
    }

    allPeople.push(rootPerson, ...reports)
    console.log(`  Total under ${root.name}: ${reports.length}`)
  }

  console.log(`\nTotal people found: ${allPeople.length}`)

  // ── GitHub validation & inference ──

  const withGithub = allPeople.filter(p => p.githubUsername)
  const withoutGithub = allPeople.filter(p => !p.githubUsername)
  console.log(`\nGitHub usernames from LDAP: ${withGithub.length}`)
  console.log(`Missing GitHub usernames: ${withoutGithub.length}`)

  // Validate existing GitHub usernames
  console.log('\nValidating GitHub usernames from LDAP...')
  let validCount = 0
  let invalidCount = 0
  for (const person of withGithub) {
    const valid = validateGithubUsername(person.githubUsername)
    if (valid) {
      person.githubValidated = true
      validCount++
    } else {
      console.log(`  INVALID: ${person.name} -> ${person.githubUsername}`)
      person.githubValidated = false
      person.githubUsernameOriginal = person.githubUsername
      person.githubUsername = null
      invalidCount++
    }
    // Rate limit: ~10 req/s is fine for gh cli
    if ((validCount + invalidCount) % 50 === 0) {
      console.log(`  Validated ${validCount + invalidCount}/${withGithub.length}...`)
    }
  }
  console.log(`  Valid: ${validCount}, Invalid: ${invalidCount}`)

  // Try to infer missing GitHub usernames from opendatahub-io org
  const needsInference = allPeople.filter(p => !p.githubUsername)
  if (needsInference.length > 0) {
    const odhMembers = fetchOdhOrgMembers()
    if (odhMembers.length > 0) {
      console.log(`\nAttempting to infer GitHub usernames for ${needsInference.length} people...`)
      const odhDetailsCache = {}
      let inferredCount = 0

      for (const person of needsInference) {
        const inferred = tryInferGithubFromOrg(person, odhMembers, odhDetailsCache)
        if (inferred) {
          person.githubUsername = inferred
          person.githubInferred = true
          person.githubValidated = true
          inferredCount++
          console.log(`  INFERRED: ${person.name} -> ${inferred}`)
        }
      }
      console.log(`  Inferred ${inferredCount} GitHub usernames from opendatahub-io org`)
    }
  }

  // Summary
  const finalWithGithub = allPeople.filter(p => p.githubUsername).length
  const finalWithout = allPeople.filter(p => !p.githubUsername).length
  console.log(`\nFinal GitHub coverage: ${finalWithGithub}/${allPeople.length} (${Math.round(finalWithGithub / allPeople.length * 100)}%)`)
  console.log(`Still missing: ${finalWithout}`)

  // Write output
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(orgData, null, 2))
  console.log(`\nWrote ${OUTPUT_PATH}`)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
