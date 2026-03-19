#!/usr/bin/env node

/**
 * Merge spreadsheet team/component/specialty data into org-roster-full.json.
 *
 * Usage:
 *   node scripts/merge-spreadsheet-data.js
 *
 * Reads:
 *   - data/org-roster-full.json (from build-org-roster.js)
 *   - ~/Downloads/AI Eng Org - Jira Component and Scrum team breakdown.xlsx
 *
 * Outputs:
 *   - data/org-roster-full.json (updated in place)
 */

const XLSX = require('xlsx')
const fs = require('fs')
const path = require('path')

const ROSTER_PATH = path.join(__dirname, '..', 'data', 'org-roster-full.json')
const SPREADSHEET_PATH = path.join(
  process.env.HOME,
  'Downloads',
  'AI Eng Org - Jira Component and Scrum team breakdown.xlsx'
)

// Sheets that contain per-person team breakdown data, with consistent column structure
const TEAM_BREAKDOWN_SHEETS = [
  'AI Platform - Team Breakdown',
  'AAET - Team Breakdown',
  'AI Platform Core Components',
  'Inference Engineering',
  'AI Innovation',
  'WatsonX.ai'
]

function normalizeNameForMatch(name) {
  if (!name) return ''
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/[''`]/g, '')          // strip apostrophes
    .replace(/\s+/g, ' ')
    .trim()
}

function loadSpreadsheetPeople(filePath) {
  const wb = XLSX.readFile(filePath)
  const people = new Map() // normalized name -> spreadsheet data

  for (const sheetName of TEAM_BREAKDOWN_SHEETS) {
    const sheet = wb.Sheets[sheetName]
    if (!sheet) {
      console.log(`  Sheet "${sheetName}" not found, skipping`)
      continue
    }

    const rows = XLSX.utils.sheet_to_json(sheet)
    console.log(`  Sheet "${sheetName}": ${rows.length} rows`)

    for (const row of rows) {
      const name = row["Associate's Name"]
      if (!name || typeof name !== 'string') continue

      const normalized = normalizeNameForMatch(name)
      const existing = people.get(normalized)

      const entry = {
        originalName: name,
        manager: row["Manager's Name"] || null,
        miroTeam: row["Miro Team Name"] || null,
        jiraComponent: row["Primary Jira Component"] || null,
        jiraTeam: row["Jira Team Name (from Shared Teams View)"] || null,
        pm: row["PM"] || null,
        engLead: row["Eng Lead (Staff Engineer)"] || null,
        status: row["Status"] || null,
        specialty: row["Engineering Speciality"] || null,
        subcomponent: row["Subcomponent Area of Work"] || null,
        region: row["Region"] || null,
        sourceSheet: sheetName
      }

      if (existing) {
        // Person appears in multiple sheets — keep both entries
        if (!Array.isArray(existing)) {
          people.set(normalized, [existing, entry])
        } else {
          existing.push(entry)
        }
      } else {
        people.set(normalized, entry)
      }
    }
  }

  return people
}

function mergeData() {
  console.log('Loading org roster...')
  const roster = JSON.parse(fs.readFileSync(ROSTER_PATH, 'utf8'))

  console.log('Loading spreadsheet...')
  const spreadsheetPeople = loadSpreadsheetPeople(SPREADSHEET_PATH)
  console.log(`  Total unique names from spreadsheet: ${spreadsheetPeople.size}`)

  // Collect all people from roster for matching
  let matchCount = 0
  let missCount = 0
  const unmatched = []

  function enrichPerson(person) {
    const normalized = normalizeNameForMatch(person.name)
    const ssData = spreadsheetPeople.get(normalized)

    if (ssData) {
      // Take the first entry if multiple (or the single entry)
      const primary = Array.isArray(ssData) ? ssData[0] : ssData
      person.miroTeam = primary.miroTeam
      person.jiraComponent = primary.jiraComponent
      person.jiraTeam = primary.jiraTeam
      person.pm = primary.pm
      person.engLead = primary.engLead
      person.specialty = primary.specialty
      person.status = primary.status
      person.subcomponent = primary.subcomponent
      person.region = primary.region
      person.sourceSheet = primary.sourceSheet

      // If multiple entries, store additional team assignments
      if (Array.isArray(ssData) && ssData.length > 1) {
        person.additionalAssignments = ssData.slice(1).map(e => ({
          miroTeam: e.miroTeam,
          jiraComponent: e.jiraComponent,
          jiraTeam: e.jiraTeam,
          specialty: e.specialty
        }))
      }

      matchCount++
    } else {
      missCount++
      unmatched.push(person.name)
    }
  }

  for (const orgKey of Object.keys(roster.orgs)) {
    const org = roster.orgs[orgKey]
    enrichPerson(org.leader)
    for (const member of org.members) {
      enrichPerson(member)
    }
  }

  console.log(`\nMatched: ${matchCount}`)
  console.log(`Unmatched: ${missCount}`)

  if (unmatched.length > 0 && unmatched.length <= 50) {
    console.log('\nUnmatched names:')
    for (const name of unmatched) {
      console.log(`  - ${name}`)
    }
  } else if (unmatched.length > 50) {
    console.log(`\nFirst 50 unmatched names:`)
    for (const name of unmatched.slice(0, 50)) {
      console.log(`  - ${name}`)
    }
    console.log(`  ... and ${unmatched.length - 50} more`)
  }

  // Write updated roster
  fs.mkdirSync(path.dirname(ROSTER_PATH), { recursive: true })
  fs.writeFileSync(ROSTER_PATH, JSON.stringify(roster, null, 2))
  console.log(`\nUpdated ${ROSTER_PATH}`)
}

mergeData()
