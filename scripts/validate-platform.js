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

// --- About Tabs Validation ---

const hasAboutTabs = fs.existsSync(ABOUT_TABS_DIR)
const ALLOCATION_DIR = path.join(PLATFORM_DIR, 'allocation-strategy')
const hasAllocation = fs.existsSync(ALLOCATION_DIR)

if (!hasAboutTabs && !hasAllocation) {
  console.log('No platform extensions found — skipping validation')
  process.exit(0)
}

if (!hasAboutTabs) {
  console.log('No platform/about-tabs/ — skipping about-tabs validation')
}

if (hasAboutTabs) {
  const manifestPath = path.join(ABOUT_TABS_DIR, 'manifest.json')
  if (!fs.existsSync(manifestPath)) {
    error('platform/about-tabs/manifest.json not found')
  } else {
    let manifest
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
    } catch (e) {
      error(`about-tabs manifest.json is not valid JSON: ${e.message}`)
    }

    if (manifest) {
      console.log('Validating platform/about-tabs/manifest.json...')

      if (!Array.isArray(manifest.tabs)) {
        error('"tabs" field must be an array')
      } else {
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

        if (errors === 0) {
          console.log(`  ${manifest.tabs.length} tab(s) validated successfully`)
        }
      }
    }
  }
}

// --- Allocation Strategy Validation ---

if (hasAllocation) {
  const allocManifestPath = path.join(ALLOCATION_DIR, 'manifest.json')
  if (!fs.existsSync(allocManifestPath)) {
    error('platform/allocation-strategy/manifest.json not found')
  } else {
    let allocManifest
    try {
      allocManifest = JSON.parse(fs.readFileSync(allocManifestPath, 'utf-8'))
    } catch (e) {
      error(`allocation-strategy manifest.json is not valid JSON: ${e.message}`)
    }

    if (allocManifest) {
      console.log('Validating platform/allocation-strategy/manifest.json...')

      const REQUIRED_FIELDS = ['id', 'name', 'categories', 'classify']
      for (const field of REQUIRED_FIELDS) {
        if (!allocManifest[field]) {
          error(`allocation-strategy manifest missing required field "${field}"`)
        }
      }

      if (!Array.isArray(allocManifest.categories)) {
        error('"categories" must be an array')
      } else {
        const REQUIRED_CAT_FIELDS = ['key', 'name', 'color', 'target']
        for (const cat of allocManifest.categories) {
          for (const field of REQUIRED_CAT_FIELDS) {
            if (cat[field] === undefined || cat[field] === null || cat[field] === '') {
              error(`Category "${cat.key || '(unnamed)'}" missing required field "${field}"`)
            }
          }
          if (typeof cat.target !== 'number') {
            error(`Category "${cat.key}": "target" must be a number`)
          }
        }

        const targetSum = allocManifest.categories.reduce((sum, c) => sum + (c.target || 0), 0)
        if (targetSum !== 100) {
          console.warn(`  WARNING: Category targets sum to ${targetSum}, expected 100`)
        }
      }

      if (allocManifest.classify) {
        const classifyFile = allocManifest.classify.replace(/^\.\//, '')
        const classifyPath = path.join(ALLOCATION_DIR, classifyFile)
        if (!fs.existsSync(classifyPath)) {
          error(`classify file not found: ${allocManifest.classify} (expected at ${classifyPath})`)
        }
      }

      if (allocManifest.settingsComponent) {
        const settingsFile = allocManifest.settingsComponent.replace(/^\.\//, '')
        const settingsPath = path.join(ALLOCATION_DIR, settingsFile)
        if (!fs.existsSync(settingsPath)) {
          error(`settingsComponent file not found: ${allocManifest.settingsComponent} (expected at ${settingsPath})`)
        }
      }

      if (errors === 0) {
        console.log(`  Strategy "${allocManifest.id}" with ${allocManifest.categories?.length || 0} categories validated successfully`)
      }
    }
  }
}

// --- Final Result ---

if (errors > 0) {
  console.error(`\n${errors} error(s) found in platform manifests`)
  process.exit(1)
}
