#!/usr/bin/env node
'use strict';

/**
 * Fetches real component-onboarding Jira issues and writes them to
 * fixtures/ai-impact/component-onboarding-data.json.
 *
 * Required env vars (any combination):
 *   JIRA_EMAIL or JIRA_USER or JIRA_USER_EMAIL  — Jira account email
 *   JIRA_TOKEN                                   — Jira Cloud API token
 *
 * Usage:
 *   node scripts/fetch-component-onboarding-fixtures.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// ── Auth ──────────────────────────────────────────────────────────────────────

const JIRA_HOST = process.env.JIRA_HOST || 'https://redhat.atlassian.net';
const JIRA_EMAIL = process.env.JIRA_EMAIL || process.env.JIRA_USER_EMAIL || process.env.JIRA_USER;
const JIRA_TOKEN = process.env.JIRA_TOKEN;

if (!JIRA_EMAIL || !JIRA_TOKEN) {
  console.error('ERROR: JIRA_EMAIL (or JIRA_USER/JIRA_USER_EMAIL) and JIRA_TOKEN must be set.');
  process.exit(1);
}

const AUTH = Buffer.from(`${JIRA_EMAIL}:${JIRA_TOKEN}`).toString('base64');

// ── Label → step mapping (derived from real Jira label conventions) ──────────
// Multiple labels can map to the same step (mr-raised = in-progress, merged/done = complete).
// Any matching label sets the step to true (started or done).

const LABEL_TO_STEP = {
  // Step 1: YAML Validated
  'yaml-attached':                    'yamlValidated',
  'validation-successful':            'yamlValidated',

  // Step 2: Quay Repo (Both)
  'quay-mr-raised':                   'quayRepoCreated',
  'quay-mr-merged':                   'quayRepoCreated',
  'quay-repo-created':                'quayRepoCreated',

  // Step 3: Delivery Repo (RHOAI only)
  'delivery-repo-mr-raised':          'deliveryRepoProvisioned',
  'delivery-repo-created':            'deliveryRepoProvisioned',

  // Step 4: Konflux Release Data / KRD (Both)
  'konflux-mr-raised':                'konfluxOnboarded',
  'konflux-mr-merged':                'konfluxOnboarded',
  'krd-mr-merged':                    'konfluxOnboarded',

  // Step 5: Push Pipelines (rkc-* for RHOAI, tekton-* for ODH)
  'rkc-pr-raised':                    'pushPipelineConfigured',
  'tekton-pr-raised':                 'pushPipelineConfigured',
  'tekton-pr-merged':                 'pushPipelineConfigured',

  // Step 5b: Pull Pipelines (RHOAI only)
  'rkc-pull-changes-done':            'pullPipelineConfigured',

  // Step 6: ODH Konflux Central onboarder (ODH + cross-product RHOAI components)
  'okc-pr-raised':                    'odhKonfluxOnboarded',
  'okc-pr-merged':                    'odhKonfluxOnboarded',
  'okc-changes-done':                 'odhKonfluxOnboarded',

  // Step 7: Operator Integration (if operator)
  'operator-pr-raised':               'operatorIntegrated',
  'operator-pr-merged':               'operatorIntegrated',

  // Step 8: Bundle (Both — bundle-changes-done=new, obc-changes-done=old)
  'bundle-changes-done':              'bundleConfigured',
  'obc-changes-done':                 'bundleConfigured',

  // Step 9: Product Listing (RHOAI only)
  'product-listing-created':          'productListingUpdated',

  // Step 10: Auto Merge (RHOAI only)
  'auto-merge-setup-done':            'autoMergeSetup',

  // Step 11: Renovate (RHOAI only)
  'renovate-changes-done':            'renovateSetup',
  'renovate-sync-done':               'renovateSetup',
  'renovate-sync-triggered':          'renovateSetup'
};

// Ordered step keys (same order as the pipeline)
const STEP_KEYS = [
  'yamlValidated',
  'quayRepoCreated',
  'deliveryRepoProvisioned',
  'konfluxOnboarded',
  'pushPipelineConfigured',
  'pullPipelineConfigured',
  'odhKonfluxOnboarded',
  'operatorIntegrated',
  'bundleConfigured',
  'productListingUpdated',
  'autoMergeSetup',
  'renovateSetup'
];

// RHOAI template: RHOAIENG-17225, ODH template: RHOAIENG-35683
const RHOAI_TEMPLATE = 'RHOAIENG-17225';
const ODH_TEMPLATE   = 'RHOAIENG-35683';

// ── HTTP helper ───────────────────────────────────────────────────────────────

function jiraGet(urlPath) {
  return new Promise((resolve, reject) => {
    const url = `${JIRA_HOST}${urlPath}`;
    const opts = {
      method: 'GET',
      headers: {
        Authorization: `Basic ${AUTH}`,
        Accept:        'application/json'
      }
    };

    const req = https.request(url, opts, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode === 429) {
          const retryAfter = parseInt(res.headers['retry-after'] || '5', 10);
          console.warn(`[jira] Rate limited, waiting ${retryAfter}s…`);
          setTimeout(() => jiraGet(urlPath).then(resolve).catch(reject), retryAfter * 1000);
          return;
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`Jira HTTP ${res.statusCode}: ${body.slice(0, 300)}`));
        }
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error(`JSON parse error: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function fetchAllJql(jql, fields, expand) {
  const issues = [];
  let nextPageToken = null;

  while (true) {
    const params = new URLSearchParams({ jql, fields, maxResults: '100' });
    if (expand) params.set('expand', expand);
    if (nextPageToken) params.set('nextPageToken', nextPageToken);

    const data = await jiraGet(`/rest/api/3/search/jql?${params}`);
    if (!data.issues || data.issues.length === 0) break;

    issues.push(...data.issues);
    console.log(`  fetched ${issues.length} issues so far…`);

    if (!data.nextPageToken) break;
    nextPageToken = data.nextPageToken;
  }

  return issues;
}

// ── Processing helpers ────────────────────────────────────────────────────────

function deriveProductContext(issue) {
  const summary = issue.fields.summary || '';
  const labels  = issue.fields.labels || [];
  const links   = issue.fields.issuelinks || [];

  // Check if cloned from known template (most reliable)
  for (const link of links) {
    const linkedKey = link.inwardIssue?.key || link.outwardIssue?.key || '';
    if (linkedKey === RHOAI_TEMPLATE) return 'RHOAI';
    if (linkedKey === ODH_TEMPLATE)   return 'ODH';
  }

  // Derive from summary prefix: "RHOAI Konflux..." vs "ODH Konflux..."
  if (/^RHOAI\s/i.test(summary)) return 'RHOAI';
  if (/^ODH\s/i.test(summary))   return 'ODH';

  // Fall back to label hints
  if (labels.some(l => /^rhoai/i.test(l))) return 'RHOAI';
  if (labels.some(l => /^odh/i.test(l)))   return 'ODH';

  // RHODS- project keys are RHOAI product
  if (issue.key.startsWith('RHODS-')) return 'RHOAI';

  return 'RHOAI';
}

function deriveComponentName(issue) {
  const summary = issue.fields.summary || '';

  // Handle bracket format at end: "... [Component Name]"
  const bracketMatch = summary.match(/\[([^\]]+)\]\s*$/);
  if (bracketMatch) return bracketMatch[1].trim();

  // Handle suffix slug after "Onboarding": odh-something, kube-rbac-proxy, etc.
  const slugMatch = summary.match(/[Oo]nboarding\s+((?:odh-|rkc-|kube-)[a-z0-9-]+|[a-z][a-z0-9-]+)$/);
  if (slugMatch) return slugMatch[1].trim();

  return '';
}

function deriveOnboardingSteps(labels) {
  const labelSet = new Set(labels);
  const steps = {};

  for (const key of STEP_KEYS) {
    steps[key] = false;
  }

  for (const [label, stepKey] of Object.entries(LABEL_TO_STEP)) {
    if (labelSet.has(label)) {
      steps[stepKey] = true;
    }
  }

  return steps;
}

function deriveCompletionStatus(jiraStatus, labels) {
  const terminal = ['Resolved', 'Closed', 'Done', 'Cancelled'];
  if (terminal.includes(jiraStatus)) return 'completed';
  if (labels.includes('component-onboarding-completed')) return 'completed';
  return 'in-progress';
}

function extractLinkedFeatures(issuelinks) {
  const features = [];
  for (const link of issuelinks) {
    const linked = link.inwardIssue || link.outwardIssue;
    if (!linked) continue;
    if (linked.key.startsWith('RHAISTRAT-') || linked.key.startsWith('RHAIRFE-')) {
      features.push(linked.key);
    }
  }
  return [...new Set(features)];
}

function processIssue(issue) {
  const labels        = issue.fields.labels || [];
  const issuelinks    = issue.fields.issuelinks || [];
  const jiraStatus    = issue.fields.status?.name || 'Unknown';
  const resolutionDate = issue.fields.resolutiondate || null;

  const productContext    = deriveProductContext(issue);
  const componentName     = deriveComponentName(issue);
  const onboardingSteps   = deriveOnboardingSteps(labels);
  const completionStatus  = deriveCompletionStatus(jiraStatus, labels);
  const linkedFeatures    = extractLinkedFeatures(issuelinks);

  return {
    key:              issue.key,
    summary:          issue.fields.summary,
    status:           jiraStatus,
    completionStatus,
    productContext,
    componentName,
    repoUrl:          '',
    branch:           '',
    dockerfilePath:   '',
    contextPath:      '',
    isOperator:       false,
    linkedFeatures,
    labels,
    created:          issue.fields.created,
    resolved:         resolutionDate,
    onboardingSteps,
    syncedAt:         new Date().toISOString()
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Connecting to ${JIRA_HOST} as ${JIRA_EMAIL}…\n`);

  const jql = `project in (RHOAIENG, RHODS) AND labels = "component-onboarding" ORDER BY created DESC`;
  const fields = 'summary,status,labels,created,resolutiondate,issuelinks';

  console.log(`JQL: ${jql}`);
  console.log('Fetching…\n');

  let rawIssues;
  try {
    rawIssues = await fetchAllJql(jql, fields);
  } catch (err) {
    console.error('Jira fetch failed:', err.message);
    process.exit(1);
  }

  console.log(`\nFetched ${rawIssues.length} issues total.\n`);

  if (rawIssues.length === 0) {
    console.warn('No issues found. Keeping existing fixture.');
    process.exit(0);
  }

  const components = {};
  for (const issue of rawIssues) {
    const processed = processIssue(issue);
    components[processed.key] = {
      latest:  processed,
      history: []
    };
  }

  const output = {
    fetchedAt:       new Date().toISOString(),
    totalComponents: rawIssues.length,
    components
  };

  const outPath = path.resolve(__dirname, '..', 'fixtures', 'ai-impact', 'component-onboarding-data.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

  console.log(`Wrote ${rawIssues.length} components to:\n  ${outPath}`);

  // Summary
  const completed   = rawIssues.filter(i => components[i.key].latest.completionStatus === 'completed').length;
  const inProgress  = rawIssues.length - completed;
  const rhoai       = rawIssues.filter(i => components[i.key].latest.productContext === 'RHOAI').length;
  const odh         = rawIssues.filter(i => components[i.key].latest.productContext === 'ODH').length;

  console.log('\nSummary:');
  console.log(`  Completed:   ${completed}`);
  console.log(`  In Progress: ${inProgress}`);
  console.log(`  RHOAI:       ${rhoai}`);
  console.log(`  ODH:         ${odh}`);
}

main();
