#!/usr/bin/env node

/**
 * Infer missing GitHub usernames by matching people against
 * a GitHub org's member list. Updates data/org-roster-full.json in place.
 *
 * Usage:
 *   node scripts/infer-github-from-org.js <org-name>
 *
 * Example:
 *   node scripts/infer-github-from-org.js red-hat-data-services
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const ROSTER_PATH = path.join(__dirname, '..', 'data', 'org-roster-full.json')

const orgName = process.argv[2]
if (!orgName) {
  console.error('Usage: node scripts/infer-github-from-org.js <org-name>')
  process.exit(1)
}

function fetchOrgMembers(org) {
  console.log(`Fetching ${org} org members...`)
  try {
    const raw = execSync(
      `gh api --paginate "/orgs/${org}/members?per_page=100" --jq ".[].login"`,
      { encoding: 'utf8', timeout: 60000, maxBuffer: 5 * 1024 * 1024 }
    )
    const logins = raw.trim().split('\n').filter(Boolean)
    console.log(`  Found ${logins.length} org members`)
    return logins
  } catch (err) {
    console.error(`  Failed to fetch ${org} members:`, err.message)
    process.exit(1)
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

function tryMatch(person, orgMembers, detailsCache) {
  const normalizedName = normalizeForMatch(person.name)
  const emailPrefix = person.email ? person.email.split('@')[0].toLowerCase() : ''
  const [firstName, ...lastParts] = person.name.split(' ')
  const lastName = lastParts[lastParts.length - 1] || ''

  for (const login of orgMembers) {
    if (!detailsCache[login]) {
      detailsCache[login] = fetchGithubUserDetails(login) || { login }
    }
    const details = detailsCache[login]

    // Match by GitHub profile name
    if (details.name && normalizeForMatch(details.name) === normalizedName) {
      return login
    }

    // Match by GitHub profile email
    if (details.email && person.email && details.email.toLowerCase() === person.email.toLowerCase()) {
      return login
    }

    // Match by login resembling email prefix / uid
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

// Main
const data = JSON.parse(fs.readFileSync(ROSTER_PATH, 'utf8'))
const orgMembers = fetchOrgMembers(orgName)
const detailsCache = {}

// Collect all people missing GitHub usernames
const needsInference = []
for (const org of Object.values(data.orgs)) {
  for (const m of org.members) {
    if (!m.githubUsername) needsInference.push(m)
  }
  if (!org.leader.githubUsername) needsInference.push(org.leader)
}

console.log(`\nAttempting to match ${needsInference.length} people against ${orgName}...\n`)

let inferredCount = 0
for (const person of needsInference) {
  const match = tryMatch(person, orgMembers, detailsCache)
  if (match) {
    person.githubUsername = match
    person.githubInferred = true
    person.githubValidated = true
    inferredCount++
    console.log(`  MATCH: ${person.name} -> ${match}`)
  }
}

console.log(`\nInferred ${inferredCount} GitHub usernames from ${orgName}`)

if (inferredCount > 0) {
  data.generatedAt = new Date().toISOString()
  fs.mkdirSync(path.dirname(ROSTER_PATH), { recursive: true })
  fs.writeFileSync(ROSTER_PATH, JSON.stringify(data, null, 2))
  console.log(`Updated ${ROSTER_PATH}`)
}

// Report remaining
const stillMissing = []
for (const org of Object.values(data.orgs)) {
  for (const m of org.members) {
    if (!m.githubUsername) stillMissing.push(m)
  }
}
console.log(`Still missing GitHub usernames: ${stillMissing.length}`)
