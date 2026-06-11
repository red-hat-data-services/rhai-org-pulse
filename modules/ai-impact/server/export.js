/**
 * AI Impact export hook for anonymized test data.
 *
 * Handles: rfe-data, autofix-data, doc-data, doc-mr-kpi-data, config,
 * assessments, test-plans, features (legacy), component-onboarding-data
 */

const PREFIX = 'ai-impact';

module.exports = async function aiImpactExport(addFile, storage, mapping) {
  const { readFromStorage } = storage;

  await exportRfeData(addFile, readFromStorage, mapping);
  await exportAutofixData(addFile, readFromStorage, mapping);
  await exportDocData(addFile, readFromStorage, mapping);
  await exportDocMrKpiData(addFile, readFromStorage, mapping);
  await exportConfig(addFile, readFromStorage);
  await exportAssessments(addFile, readFromStorage, mapping);
  await exportTestPlans(addFile, readFromStorage, mapping);
  await exportFeatures(addFile, readFromStorage, mapping);
  await exportComponentOnboarding(addFile, readFromStorage, mapping);
};

function anonymizeIssue(issue, mapping) {
  const result = { ...issue };
  if (result.key) result.key = mapping.anonymizeJiraKey(result.key);
  if (result.summary) result.summary = mapping.anonymizeIssueSummary(result.key || result.summary);
  if (result.creator) result.creator = mapping.getOrCreateUidMapping(result.creator);
  if (result.creatorDisplayName) result.creatorDisplayName = mapping.getOrCreateNameMapping(result.creatorDisplayName);
  if (result.assignee && result.assignee !== 'Unassigned') {
    result.assignee = mapping.getOrCreateNameMapping(result.assignee);
  }
  if (result.accountId) result.accountId = mapping.getOrCreateAccountIdMapping(result.accountId);
  if (result.linkedFeature) {
    result.linkedFeature = {
      ...result.linkedFeature,
      key: mapping.anonymizeJiraKey(result.linkedFeature.key),
      summary: mapping.anonymizeIssueSummary(result.linkedFeature.key)
    };
  }
  if (result.ccsEpic) {
    result.ccsEpic = {
      ...result.ccsEpic,
      key: mapping.anonymizeJiraKey(result.ccsEpic.key),
      summary: mapping.anonymizeIssueSummary(result.ccsEpic.key)
    };
  }
  if (Array.isArray(result.mrLinks)) {
    result.mrLinks = result.mrLinks.map((_, i) =>
      `https://gitlab.example.com/docs/project/-/merge_requests/${1000 + i}`
    );
  }
  if (result.mrStatuses && typeof result.mrStatuses === 'object') {
    const newStatuses = {};
    let i = 0;
    for (const status of Object.values(result.mrStatuses)) {
      newStatuses[`https://gitlab.example.com/docs/project/-/merge_requests/${1000 + i}`] = status;
      i++;
    }
    result.mrStatuses = newStatuses;
  }
  return result;
}

async function exportRfeData(addFile, readFromStorage, mapping) {
  const data = readFromStorage(`${PREFIX}/rfe-data.json`);
  if (!data) return;

  const anonymized = { ...data };
  if (Array.isArray(anonymized.issues)) {
    anonymized.issues = anonymized.issues.map(issue => anonymizeIssue(issue, mapping));
  }
  addFile(`${PREFIX}/rfe-data.json`, anonymized);
}

async function exportAutofixData(addFile, readFromStorage, mapping) {
  const data = readFromStorage(`${PREFIX}/autofix-data.json`);
  if (!data) return;

  const anonymized = { ...data };
  if (Array.isArray(anonymized.issues)) {
    anonymized.issues = anonymized.issues.map(issue => anonymizeIssue(issue, mapping));
  }
  addFile(`${PREFIX}/autofix-data.json`, anonymized);
}

async function exportDocData(addFile, readFromStorage, mapping) {
  const data = readFromStorage(`${PREFIX}/doc-data.json`);
  if (!data) return;

  const anonymized = { ...data };
  if (Array.isArray(anonymized.issues)) {
    anonymized.issues = anonymized.issues.map(issue => anonymizeIssue(issue, mapping));
  }
  if (Array.isArray(anonymized.completedIssues)) {
    anonymized.completedIssues = anonymized.completedIssues.map(issue => anonymizeIssue(issue, mapping));
  }
  if (Array.isArray(anonymized.labelEvents)) {
    anonymized.labelEvents = anonymized.labelEvents.map(e => ({
      ...e,
      issueKey: e.issueKey ? mapping.anonymizeJiraKey(e.issueKey) : e.issueKey
    }));
  }
  if (Array.isArray(anonymized.activityEvents)) {
    anonymized.activityEvents = anonymized.activityEvents.map(e => ({
      ...e,
      issueKey: e.issueKey ? mapping.anonymizeJiraKey(e.issueKey) : e.issueKey
    }));
  }
  addFile(`${PREFIX}/doc-data.json`, anonymized);
}

async function exportDocMrKpiData(addFile, readFromStorage, mapping) {
  const data = readFromStorage(`${PREFIX}/doc-mr-kpi-data.json`);
  if (!data) return;

  const anonymized = { ...data };
  if (Array.isArray(anonymized.mergeRequests)) {
    anonymized.mergeRequests = anonymized.mergeRequests.map((mr, i) => ({
      ...mr,
      title: `docs: update documentation ${i + 1}`,
      author: mapping.getOrCreateGitlabMapping(mr.author || ''),
      webUrl: `https://gitlab.example.com/docs/project/-/merge_requests/${mr.iid || (1000 + i)}`,
      sourceProject: 'docs/example-documentation',
      sourceHost: 'https://gitlab.example.com'
    }));
  }
  addFile(`${PREFIX}/doc-mr-kpi-data.json`, anonymized);
}

async function exportConfig(addFile, readFromStorage) {
  const { getConfig } = require('./config');
  const config = getConfig(readFromStorage);
  if (!config) return;

  addFile(`${PREFIX}/config.json`, config);
}

async function exportAssessments(addFile, readFromStorage, mapping) {
  const { readAssessments } = require('./assessments/storage');
  const data = readAssessments(readFromStorage);
  if (!data.assessments || Object.keys(data.assessments).length === 0) return;

  const anonymized = { ...data, assessments: {} };
  for (const [key, entry] of Object.entries(data.assessments)) {
    const anonKey = mapping.anonymizeJiraKey(key);
    anonymized.assessments[anonKey] = {
      latest: anonymizeAssessment(entry.latest, mapping),
      history: (entry.history || []).map(h => anonymizeAssessment(h, mapping))
    };
  }
  addFile(`${PREFIX}/assessments.json`, anonymized);
}

function anonymizeAssessment(assessment, mapping) {
  if (!assessment) return assessment;
  const result = { ...assessment };
  if (result.approvedBy) result.approvedBy = mapping.getOrCreateNameMapping(result.approvedBy);
  return result;
}

async function exportTestPlans(addFile, readFromStorage, mapping) {
  const { readTestPlans } = require('./test-plans/storage');
  const data = readTestPlans(readFromStorage);
  if (!data.testPlans || Object.keys(data.testPlans).length === 0) return;

  const anonymized = { ...data, testPlans: {} };
  for (const [key, entry] of Object.entries(data.testPlans)) {
    const anonKey = mapping.anonymizeJiraKey(key);
    anonymized.testPlans[anonKey] = {
      latest: anonymizeTestPlan(entry.latest, mapping),
      history: (entry.history || []).map(h => anonymizeTestPlan(h, mapping))
    };
  }
  addFile(`${PREFIX}/test-plans.json`, anonymized);
}

function anonymizeTestPlan(plan, mapping) {
  if (!plan) return plan;
  const result = { ...plan };
  if (result.key) result.key = mapping.anonymizeJiraKey(result.key);
  if (result.sourceKey) result.sourceKey = mapping.anonymizeJiraKey(result.sourceKey);
  if (result.feature) result.feature = mapping.anonymizeIssueSummary(result.key || result.feature);
  if (result.jiraTitle) result.jiraTitle = mapping.anonymizeIssueSummary(result.key || result.jiraTitle);
  if (result.approvedBy) result.approvedBy = mapping.getOrCreateNameMapping(result.approvedBy);
  if (result.gitlabPath) result.gitlabPath = 'example/test-plan-path';
  return result;
}

async function exportFeatures(addFile, readFromStorage, mapping) {
  const data = readFromStorage(`${PREFIX}/features.json`);
  if (!data || !data.features) return;

  const anonymized = { ...data, features: {} };
  for (const [key, entry] of Object.entries(data.features)) {
    const anonKey = mapping.anonymizeJiraKey(key);
    anonymized.features[anonKey] = {
      latest: anonymizeFeatureReview(entry.latest, mapping),
      history: (entry.history || []).map(h => anonymizeFeatureReview(h, mapping))
    };
  }
  addFile(`${PREFIX}/features.json`, anonymized);
}

function anonymizeFeatureReview(review, mapping) {
  if (!review) return review;
  const result = { ...review };
  if (result.key) result.key = mapping.anonymizeJiraKey(result.key);
  if (result.title) result.title = mapping.anonymizeIssueSummary(result.key || result.title);
  if (result.sourceRfe) result.sourceRfe = mapping.anonymizeJiraKey(result.sourceRfe);
  if (result.approvedBy) result.approvedBy = mapping.getOrCreateNameMapping(result.approvedBy);
  return result;
}

async function exportComponentOnboarding(addFile, readFromStorage, mapping) {
  const { readComponentOnboarding } = require('./component-onboarding/storage');
  const data = readComponentOnboarding(readFromStorage);
  if (!data.components || Object.keys(data.components).length === 0) return;

  const anonymized = { ...data, components: {} };
  for (const [key, entry] of Object.entries(data.components)) {
    const anonKey = mapping.anonymizeJiraKey(key);
    anonymized.components[anonKey] = {
      latest: anonymizeComponent(entry.latest, mapping),
      history: (entry.history || []).map(h => anonymizeComponent(h, mapping))
    };
  }
  addFile(`${PREFIX}/component-onboarding-data.json`, anonymized);
}

function anonymizeComponent(component, mapping) {
  if (!component) return component;
  const result = { ...component };
  if (result.key) result.key = mapping.anonymizeJiraKey(result.key);
  if (result.summary) result.summary = mapping.anonymizeIssueSummary(result.key || result.summary);
  if (Array.isArray(result.linkedFeatures)) {
    result.linkedFeatures = result.linkedFeatures.map(k => mapping.anonymizeJiraKey(k));
  }
  if (result.featureTitles && typeof result.featureTitles === 'object') {
    const newTitles = {};
    for (const k of Object.keys(result.featureTitles)) {
      newTitles[mapping.anonymizeJiraKey(k)] = mapping.anonymizeIssueSummary(k);
    }
    result.featureTitles = newTitles;
  }
  return result;
}
