#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const PLATFORM_DIR = path.join(__dirname, '..', 'platform')
const ABOUT_TABS_DIR = path.join(PLATFORM_DIR, 'about-tabs')

let errors = 0

function error(msg) {
  console.error(`  ERROR: ${msg}`)
  errors++
}

if (!fs.existsSync(PLATFORM_DIR)) {
  console.log('No platform/ directory found — skipping validation (core-only build)')
  process.exit(0)
}

if (!fs.existsSync(ABOUT_TABS_DIR)) {
  console.log('No platform/about-tabs/ directory found — skipping about-tabs validation')
  process.exit(0)
}

const manifestPath = path.join(ABOUT_TABS_DIR, 'manifest.json')
if (!fs.existsSync(manifestPath)) {
  error('platform/about-tabs/manifest.json not found')
  process.exit(1)
}

let manifest
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
} catch (e) {
  error(`manifest.json is not valid JSON: ${e.message}`)
  process.exit(1)
}

console.log('Validating platform/about-tabs/manifest.json...')

if (!Array.isArray(manifest.tabs)) {
  error('"tabs" field must be an array')
  process.exit(1)
}

const REQUIRED_TAB_FIELDS = ['id', 'label', 'icon', 'component']
const seenIds = new Set()

for (const tab of manifest.tabs) {
  for (const field of REQUIRED_TAB_FIELDS) {
    if (typeof tab[field] !== 'string' || !tab[field]) {
      error(`Tab "${tab.id || '(unnamed)'}" is missing required string field "${field}"`)
    }
  }

  if (tab.id) {
    if (seenIds.has(tab.id)) {
      error(`Duplicate tab ID: "${tab.id}"`)
    }
    seenIds.add(tab.id)
  }

  if (tab.component) {
    const componentPath = path.join(ABOUT_TABS_DIR, tab.component.replace(/^\.\//, ''))
    if (!fs.existsSync(componentPath)) {
      error(`Component file not found: ${tab.component} (expected at ${componentPath})`)
    }
  }

  if (tab.order !== undefined && typeof tab.order !== 'number') {
    error(`Tab "${tab.id}": "order" must be a number`)
  }

  if (tab.requireRole !== undefined && typeof tab.requireRole !== 'string') {
    error(`Tab "${tab.id}": "requireRole" must be a string`)
  }
}

if (errors > 0) {
  console.error(`\n${errors} error(s) found in platform manifests`)
  process.exit(1)
}

console.log(`  ${manifest.tabs.length} tab(s) validated successfully`)
