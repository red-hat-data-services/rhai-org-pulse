#!/usr/bin/env node

/**
 * Converts a Jira CSV export of RHAISTRAT features into demo fixtures, so the
 * demo planner can show a release the frozen fixture set predates.
 *
 * Only raw Jira fields are written. FPDoR, risk, confidence and placement are
 * all derived at read time, so they must not be baked in here.
 *
 * Usage: node scripts/import-jira-features-fixture.js <export.csv> [--dry-run]
 */

const fs = require('fs');
const path = require('path');

const FEATURES_DIR = path.join(__dirname, '..', 'fixtures', 'releases', 'execution', 'features');
const INDEX_PATH = path.join(__dirname, '..', 'fixtures', 'releases', 'execution', 'index.json');

/** Jira exports quote any field containing a comma, quote or newline. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { quoted = false; }
      } else field += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (ch !== '\r') field += ch;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim()));
}

/** Jira repeats a column name per value, so collect every matching index. */
function columns(header, name) {
  const out = [];
  for (let i = 0; i < header.length; i++) if (header[i].trim() === name) out.push(i);
  return out;
}

function values(row, indexes) {
  const out = [];
  for (const i of indexes) {
    const v = (row[i] || '').trim();
    if (v && out.indexOf(v) === -1) out.push(v);
  }
  return out;
}

function statusCategory(status) {
  const s = (status || '').toLowerCase();
  if (s === 'closed' || s === 'done' || s === 'resolved') return 'Done';
  if (s === 'in progress') return 'In Progress';
  return 'To Do';
}

function main() {
  const csvPath = process.argv[2];
  const dryRun = process.argv.indexOf('--dry-run') !== -1;
  if (!csvPath) {
    console.error('Usage: node scripts/import-jira-features-fixture.js <export.csv> [--dry-run]');
    process.exit(1);
  }

  const rows = parseCsv(fs.readFileSync(csvPath, 'utf8'));
  const header = rows[0];
  const col = (name) => { const c = columns(header, name); return c.length ? c[0] : -1; };

  const iKey = col('Issue key');
  const iSummary = col('Summary');
  const iStatus = col('Status');
  const iPriority = col('Priority');
  const iCreated = col('Created');
  const iUpdated = col('Updated');
  const iPm = col('PM');
  const iAssignee = col('Assignee');
  const iAssigneeId = col('Assignee Id');
  const cComponents = columns(header, 'Components');
  const cTargetVersions = columns(header, 'Custom field (Target Version)');
  const cFixVersions = columns(header, 'Fix versions');

  if (iKey === -1) {
    console.error('No "Issue key" column found — is this a Jira CSV export?');
    process.exit(1);
  }

  const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  const byKey = new Map(index.features.map(f => [f.key, f]));
  let added = 0;
  let updated = 0;

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const key = (row[iKey] || '').trim();
    if (!key) continue;

    const feature = {
      key: key,
      summary: (row[iSummary] || '').trim(),
      status: (row[iStatus] || '').trim(),
      statusCategory: statusCategory(row[iStatus]),
      priority: (row[iPriority] || '').trim(),
      components: values(row, cComponents),
      targetVersions: values(row, cTargetVersions),
      fixVersions: values(row, cFixVersions),
      pm: iPm === -1 ? '' : (row[iPm] || '').trim(),
      assignee: {
        displayName: iAssignee === -1 ? '' : (row[iAssignee] || '').trim(),
        accountId: iAssigneeId === -1 ? '' : (row[iAssigneeId] || '').trim()
      },
      labels: [],
      created: iCreated === -1 ? null : (row[iCreated] || '').trim() || null,
      updated: iUpdated === -1 ? null : (row[iUpdated] || '').trim() || null,
      architect: null,
      parentKey: null,
      colorStatus: null,
      ownerStatusColor: null
    };

    if (dryRun && added === 0 && !byKey.has(key)) {
      console.log('first parsed feature:\n' + JSON.stringify(feature, null, 2));
    }
    // Merge rather than replace: existing fixtures carry derived and relational
    // fields (epics, metrics, bigRock, topology) the export knows nothing about.
    const featurePath = path.join(FEATURES_DIR, key + '.json');
    let merged = feature;
    if (fs.existsSync(featurePath)) {
      merged = Object.assign(JSON.parse(fs.readFileSync(featurePath, 'utf8')), feature);
    }
    if (!dryRun) {
      fs.writeFileSync(featurePath, JSON.stringify(merged, null, 2) + '\n');
    }

    const entry = {
      key: key,
      summary: feature.summary,
      status: feature.status,
      statusCategory: feature.statusCategory,
      priority: feature.priority,
      assignee: feature.assignee,
      fixVersions: feature.fixVersions,
      labels: feature.labels,
      targetVersions: feature.targetVersions,
      pm: feature.pm,
      architect: null,
      parentKey: null,
      colorStatus: null,
      ownerStatusColor: null,
      lastUpdated: feature.updated
    };

    if (byKey.has(key)) { Object.assign(byKey.get(key), entry); updated++; }
    else { index.features.push(entry); byKey.set(key, entry); added++; }
  }

  index.featureCount = index.features.length;
  if (!dryRun) fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2) + '\n');

  console.log((dryRun ? '[dry run] ' : '') + 'added ' + added + ', updated ' + updated + ', total ' + index.features.length);
}

main();
