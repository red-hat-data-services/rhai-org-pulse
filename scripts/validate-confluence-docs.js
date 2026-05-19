#!/usr/bin/env node
'use strict';

/**
 * Validates that every module in the modules/ directory has corresponding
 * Confluence documentation artifacts:
 *   1. An entry in docs/confluence/confluence.config.json (owner, audience)
 *   2. A hand-authored partial at docs/confluence/partials/{slug}.md
 *
 * Reports warnings for missing artifacts. The generation script will still
 * produce stub pages, but this check nudges contributors to add full docs.
 *
 * Usage:
 *   node scripts/validate-confluence-docs.js
 *   node scripts/validate-confluence-docs.js --strict   (exit 1 on warnings)
 *
 * Designed to run alongside scripts/validate-modules.js in CI.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MODULES_DIR = path.join(ROOT, 'modules');
const CONFLUENCE_DIR = path.join(ROOT, 'docs', 'confluence');
const CONFIG_PATH = path.join(CONFLUENCE_DIR, 'confluence.config.json');
const PARTIALS_DIR = path.join(CONFLUENCE_DIR, 'partials');

const strict = process.argv.includes('--strict');

let warnings = 0;
let errors = 0;

function warn(msg) {
  console.log(`WARN:  ${msg}`);
  warnings++;
}

function error(msg) {
  console.error(`ERROR: ${msg}`);
  errors++;
}

function main() {
  console.log('=== Confluence Documentation Validator ===\n');

  // Check that the Confluence docs directory exists
  if (!fs.existsSync(CONFLUENCE_DIR)) {
    error('docs/confluence/ directory not found. Confluence docs-as-code has not been set up.');
    process.exit(1);
  }

  // Load config
  if (!fs.existsSync(CONFIG_PATH)) {
    error('docs/confluence/confluence.config.json not found.');
    process.exit(1);
  }

  let config;
  try {
    config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch (err) {
    error(`Failed to parse confluence.config.json: ${err.message}`);
    process.exit(1);
  }

  // Discover modules
  if (!fs.existsSync(MODULES_DIR)) {
    error('modules/ directory not found.');
    process.exit(1);
  }

  const moduleDirs = fs.readdirSync(MODULES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.') && !d.name.startsWith('_'));

  const modules = [];
  for (const dir of moduleDirs) {
    const manifestPath = path.join(MODULES_DIR, dir.name, 'module.json');
    if (fs.existsSync(manifestPath)) {
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        modules.push({ slug: manifest.slug || dir.name, name: manifest.name || dir.name, dir: dir.name });
      } catch {
        // Skip modules with invalid JSON — validate-modules.js handles that
        continue;
      }
    }
  }

  if (modules.length === 0) {
    console.log('No modules found. Nothing to validate.\n');
    process.exit(0);
  }

  console.log(`Found ${modules.length} module(s). Checking Confluence documentation...\n`);

  const configModules = config.modules || {};
  let fullyDocumented = 0;

  for (const mod of modules) {
    const hasConfigEntry = !!configModules[mod.slug];
    const partialPath = path.join(PARTIALS_DIR, `${mod.slug}.md`);
    const hasPartial = fs.existsSync(partialPath);

    if (hasConfigEntry && hasPartial) {
      console.log(`  [OK]   ${mod.slug}`);
      fullyDocumented++;
    } else {
      const missing = [];
      if (!hasConfigEntry) missing.push('confluence.config.json entry (owner, audience)');
      if (!hasPartial) missing.push(`partials/${mod.slug}.md`);
      warn(`${mod.slug} — missing ${missing.join(' and ')}`);
      console.log(`         A stub page will be auto-generated, but full docs are recommended.`);
      console.log(`         See: docs/confluence/partials/team-tracker.md for an example.\n`);
    }
  }

  // Summary
  console.log(`\n--- Summary ---`);
  console.log(`Modules:          ${modules.length}`);
  console.log(`Fully documented: ${fullyDocumented}`);
  console.log(`Missing docs:     ${modules.length - fullyDocumented}`);
  console.log(`Warnings:         ${warnings}`);
  console.log(`Errors:           ${errors}`);

  if (errors > 0) {
    console.log('\nFailed with errors.');
    process.exit(1);
  }

  if (strict && warnings > 0) {
    console.log('\nFailed (--strict mode: warnings treated as errors).');
    console.log('Add Confluence docs for the modules listed above, or remove --strict to allow stubs.');
    process.exit(1);
  }

  if (warnings > 0) {
    console.log('\nPassed with warnings. Stub pages will be generated for undocumented modules.');
  } else {
    console.log('\nAll modules are fully documented.');
  }

  process.exit(0);
}

main();
