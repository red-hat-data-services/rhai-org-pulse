const { fetchAllJqlResults } = require('../../../../shared/server/jira');
const { extractLabelDate } = require('./rfe-fetcher');
const { validateJqlSafeString } = require('../config');

const DOC_LABELS = ['ai1st-doc-start', 'ai1st-doc-invoked', 'ai1st-doc-contributed'];

function extractLabelAdditionEvents(changelog, targetLabels, issueKey) {
  if (!changelog?.histories) return [];
  const events = [];
  const targetSet = new Set(targetLabels);

  for (const history of changelog.histories) {
    for (const item of history.items) {
      if (item.field !== 'labels') continue;
      const before = (item.fromString || '').split(/\s+/).filter(Boolean);
      const after = (item.toString || '').split(/\s+/).filter(Boolean);
      const beforeSet = new Set(before);

      for (const label of after) {
        if (targetSet.has(label) && !beforeSet.has(label)) {
          events.push({ label, date: history.created, issueKey });
        }
      }
    }
  }

  return events;
}

function extractMrUrlFromAdf(adfDoc) {
  if (!adfDoc || !adfDoc.content) return null;

  for (const block of adfDoc.content) {
    if (!block.content) continue;
    for (const inline of block.content) {
      if (inline.type === 'inlineCard' && inline.attrs?.url) {
        return inline.attrs.url;
      }
      if (!inline.marks) continue;
      for (const mark of inline.marks) {
        if (mark.type === 'link' && mark.attrs?.href) {
          return mark.attrs.href;
        }
      }
    }
  }

  return null;
}

function processIssue(issue, config) {
  const labels = issue.fields.labels || [];
  const hasDocContributed = labels.includes(config.docContributedLabel);
  const hasDocInvoked = labels.includes(config.docInvokedLabel);

  let docContributedDate = null;
  let docInvokedDate = null;

  if (hasDocContributed) {
    docContributedDate = extractLabelDate(issue.changelog, config.docContributedLabel)
      || issue.fields.created;
  }
  if (hasDocInvoked) {
    docInvokedDate = extractLabelDate(issue.changelog, config.docInvokedLabel)
      || issue.fields.created;
  }

  return {
    key: issue.key,
    summary: issue.fields.summary,
    status: issue.fields.status?.name || 'Unknown',
    labels,
    created: issue.fields.created,
    updated: issue.fields.updated,
    hasDocContributed,
    hasDocInvoked,
    docContributedDate,
    docInvokedDate,
    ccsEpic: null,
    mrLinks: []
  };
}

function computeDocMetrics(issues, labelEvents) {
  const demandCount = issues.length;
  const coverageCount = issues.filter(i => i.hasDocContributed).length;
  const coverageRate = demandCount > 0
    ? Math.round((coverageCount / demandCount) * 100)
    : 0;
  const invokedCount = issues.filter(i => i.hasDocInvoked).length;

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentEvents = labelEvents.filter(e => new Date(e.date) >= thirtyDaysAgo);
  const totalLabelEvents = recentEvents.length;

  return { demandCount, coverageCount, coverageRate, invokedCount, totalLabelEvents };
}

function buildDocTrendData(issues, labelEvents) {
  const now = new Date();
  const points = [];

  for (let d = 29; d >= 0; d--) {
    const date = new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().slice(0, 10);
    const dateEnd = dateStr + 'T23:59:59Z';

    // Graph A: demand — issues created on or before this date (in the pool by this day)
    const demand = issues.filter(i => i.created <= dateEnd).length;

    // Graph B: coverage — issues with doc-contributed label added on or before this date
    const coverageCount = issues.filter(i =>
      i.hasDocContributed && i.docContributedDate && i.docContributedDate <= dateEnd
    ).length;
    const coverageRate = demand > 0 ? Math.round((coverageCount / demand) * 100) : 0;

    // Graph C: daily event counts (used to compute second derivative below)
    const dayEvents = labelEvents.filter(e => e.date.slice(0, 10) === dateStr);
    const invokedDaily = dayEvents.filter(e => e.label === 'ai1st-doc-invoked').length;
    const contributedDaily = dayEvents.filter(e => e.label === 'ai1st-doc-contributed').length;

    points.push({
      date: dateStr,
      demand,
      coverageCount,
      coverageRate,
      _invokedDaily: invokedDaily,
      _contributedDaily: contributedDaily
    });
  }

  // Second derivative: smoothed rate change (7-day rolling average, then day-over-day delta)
  const WINDOW = 7;
  function rollingAvg(arr, idx) {
    let sum = 0;
    let count = 0;
    for (let i = Math.max(0, idx - WINDOW + 1); i <= idx; i++) {
      sum += arr[i];
      count++;
    }
    return sum / count;
  }

  const invokedDailyArr = points.map(p => p._invokedDaily);
  const contributedDailyArr = points.map(p => p._contributedDaily);
  const totalDailyArr = points.map((p, i) => invokedDailyArr[i] + contributedDailyArr[i]);

  for (let i = 0; i < points.length; i++) {
    const currRate = rollingAvg(totalDailyArr, i);
    const prevRate = i > 0 ? rollingAvg(totalDailyArr, i - 1) : currRate;
    points[i].activityRate = Math.round(currRate * 100) / 100;
    points[i].activityAccel = Math.round((currRate - prevRate) * 100) / 100;

    const invokedRate = rollingAvg(invokedDailyArr, i);
    const contributedRate = rollingAvg(contributedDailyArr, i);
    points[i].invokedRate = Math.round(invokedRate * 100) / 100;
    points[i].contributedRate = Math.round(contributedRate * 100) / 100;

    delete points[i]._invokedDaily;
    delete points[i]._contributedDaily;
  }

  return points;
}

async function resolveChildCcsEpics(jiraRequest, issues) {
  if (issues.length === 0) return;

  const batchSize = 50;
  const epicMap = {};

  for (let i = 0; i < issues.length; i += batchSize) {
    const batch = issues.slice(i, i + batchSize);
    const keys = batch.map(issue => `"${issue.key}"`).join(', ');

    const jql = `parent IN (${keys}) AND (summary ~ "CCS" OR summary ~ "DOCS") AND issuetype = Epic`;
    const fields = 'summary,status,parent';

    try {
      const epics = await fetchAllJqlResults(jiraRequest, jql, fields);
      for (const epic of epics) {
        const parentKey = epic.fields.parent?.key;
        if (parentKey && !epicMap[parentKey]) {
          epicMap[parentKey] = {
            key: epic.key,
            summary: epic.fields.summary,
            status: epic.fields.status?.name || 'Unknown'
          };
        }
      }
    } catch (err) {
      console.error(`[ai-impact/doc] CCS epic resolution failed for batch: ${err.message}`);
    }

    if (i + batchSize < issues.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  for (const issue of issues) {
    if (epicMap[issue.key]) {
      issue.ccsEpic = epicMap[issue.key];
    }
  }
}

async function resolveMRLinks(jiraRequest, issues, config) {
  const issuesWithEpic = issues.filter(i => i.ccsEpic);
  if (issuesWithEpic.length === 0) return;

  const mrFieldId = config.docMrFieldId || 'customfield_10875';
  const batchSize = 50;

  const epicToParent = {};
  for (const issue of issuesWithEpic) {
    epicToParent[issue.ccsEpic.key] = issue.key;
  }

  const epicKeys = Object.keys(epicToParent);
  for (let i = 0; i < epicKeys.length; i += batchSize) {
    const batch = epicKeys.slice(i, i + batchSize);
    const keys = batch.map(k => `"${k}"`).join(', ');

    const docLabel = config.docContributedLabel || 'ai1st-doc-contributed';
    const jql = `parent IN (${keys}) AND labels = "${docLabel}"`;
    const fields = `summary,parent,labels,${mrFieldId}`;

    try {
      const tasks = await fetchAllJqlResults(jiraRequest, jql, fields);
      for (const task of tasks) {
        const epicKey = task.fields.parent?.key;
        if (!epicKey) continue;
        const parentKey = epicToParent[epicKey];
        if (!parentKey) continue;

        const mrField = task.fields[mrFieldId];
        if (!mrField) continue;

        const mrUrl = extractMrUrlFromAdf(mrField);
        if (!mrUrl) continue;

        const issue = issues.find(i => i.key === parentKey);
        if (issue && !issue.mrLinks.includes(mrUrl)) {
          issue.mrLinks.push(mrUrl);
        }
      }
    } catch (err) {
      console.error(`[ai-impact/doc] MR link resolution failed for batch: ${err.message}`);
    }

    if (i + batchSize < epicKeys.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
}

async function fetchDocData(jiraRequest, config) {
  const {
    docProject,
    docRequiredStatus,
    docContributedLabel,
    docInvokedLabel
  } = config;

  validateJqlSafeString(docProject, 'docProject');
  validateJqlSafeString(docRequiredStatus, 'docRequiredStatus');

  const jql = `project = "${docProject}" AND status = "${docRequiredStatus}" AND "Product Documentation Required" = "Yes" ORDER BY created DESC`;
  const fields = 'summary,status,created,updated,labels';

  const rawIssues = await fetchAllJqlResults(jiraRequest, jql, fields, { expand: 'changelog' });

  const issues = rawIssues.map(issue => processIssue(issue, config));

  const labelEvents = [];
  const targetLabels = [docInvokedLabel, docContributedLabel].filter(Boolean);
  for (const raw of rawIssues) {
    const events = extractLabelAdditionEvents(raw.changelog, targetLabels, raw.key);
    labelEvents.push(...events);
  }

  await resolveChildCcsEpics(jiraRequest, issues);
  await resolveMRLinks(jiraRequest, issues, config);

  return { issues, labelEvents };
}

async function fetchDocActivityEvents(jiraRequest, config) {
  const { docContributedLabel, docInvokedLabel } = config;

  validateJqlSafeString(docContributedLabel, 'docContributedLabel');
  validateJqlSafeString(docInvokedLabel, 'docInvokedLabel');

  const jql = `project IN ("RHAISTRAT", "RHOAIENG") AND labels IN ("${docInvokedLabel}", "${docContributedLabel}") AND updated >= -30d ORDER BY updated DESC`;
  const fields = 'labels';

  const rawIssues = await fetchAllJqlResults(jiraRequest, jql, fields, { expand: 'changelog' });

  const targetLabels = [docInvokedLabel, docContributedLabel];
  const events = [];
  for (const issue of rawIssues) {
    const issueEvents = extractLabelAdditionEvents(issue.changelog, targetLabels, issue.key);
    events.push(...issueEvents);
  }

  console.log(`[ai-impact/doc] Activity events: ${rawIssues.length} issues, ${events.length} label events`);
  return events;
}

async function fetchDocCumulativeStats(jiraRequest, config) {
  const { docContributedLabel, docInvokedLabel } = config;

  validateJqlSafeString(docContributedLabel, 'docContributedLabel');
  validateJqlSafeString(docInvokedLabel, 'docInvokedLabel');

  const fields = 'key';

  async function count(jql) {
    const issues = await fetchAllJqlResults(jiraRequest, jql, fields);
    return issues.length;
  }

  const [
    stratsContributed,
    allContributed,
    allInvoked,
    allResolvedContributed,
    stratsResolvedContributed
  ] = await Promise.all([
    count(`project = "RHAISTRAT" AND labels = "${docContributedLabel}"`),
    count(`project IN ("RHAISTRAT", "RHOAIENG") AND labels = "${docContributedLabel}"`),
    count(`project IN ("RHAISTRAT", "RHOAIENG") AND labels = "${docInvokedLabel}"`),
    count(`project IN ("RHAISTRAT", "RHOAIENG") AND status IN ("Resolved", "Closed") AND labels = "${docContributedLabel}"`),
    count(`project = "RHAISTRAT" AND status IN ("Resolved", "Closed") AND labels = "${docContributedLabel}"`)
  ]);

  return {
    stratsContributed,
    allContributed,
    allInvoked,
    allResolvedContributed,
    stratsResolvedContributed
  };
}

async function fetchDocCompletedData(jiraRequest, config) {
  const { docProject, docContributedLabel } = config;

  validateJqlSafeString(docProject, 'docProject');
  validateJqlSafeString(docContributedLabel, 'docContributedLabel');

  const jql = `project = "${docProject}" AND status IN ("Resolved", "Closed") AND "Product Documentation Required" = "Yes" AND labels = "${docContributedLabel}" AND updated >= -30d ORDER BY updated DESC`;
  const fields = 'summary,status,created,updated,labels';

  const rawIssues = await fetchAllJqlResults(jiraRequest, jql, fields);

  const issues = rawIssues.map(issue => processIssue(issue, config));

  await resolveChildCcsEpics(jiraRequest, issues);
  await resolveMRLinks(jiraRequest, issues, config);

  return issues;
}

module.exports = {
  fetchDocData,
  fetchDocActivityEvents,
  fetchDocCumulativeStats,
  fetchDocCompletedData,
  processIssue,
  extractLabelAdditionEvents,
  extractMrUrlFromAdf,
  computeDocMetrics,
  buildDocTrendData,
  resolveChildCcsEpics,
  resolveMRLinks,
  DOC_LABELS
};
