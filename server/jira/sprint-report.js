/**
 * Sprint Report Processor
 *
 * Transforms raw Jira Greenhopper sprint report API response
 * into the normalized data model used by the team tracker.
 */

const TRACKED_TYPES = new Set(['Story', 'Bug', 'Task']);

// Greenhopper API may return typeId (numeric string) instead of typeName.
// Includes both Data Center and Cloud typeId mappings.
const TYPE_ID_MAP = {
  '1': 'Bug',
  '3': 'Task',
  '5': 'Sub-task',
  '16': 'Epic',
  '17': 'Story',
  // Cloud typeIds
  '10001': 'Story',
  '10003': 'Task',
  '10004': 'Bug',
  '10005': 'Sub-task',
  '10006': 'Epic',
  '10014': 'Task'
};

/**
 * Extract story points from a sprint report issue.
 * The sprint report API stores points in currentEstimateStatistic.
 */
function getStoryPoints(issue) {
  const stat = issue.currentEstimateStatistic?.statFieldValue?.value;
  if (stat != null && !isNaN(stat)) return stat;

  // Fallback: check estimateStatistic (original estimate)
  const origStat = issue.estimateStatistic?.statFieldValue?.value;
  if (origStat != null && !isNaN(origStat)) return origStat;

  return null;
}

/**
 * Normalize a sprint report issue into our Issue model.
 */
function normalizeIssue(rawIssue, { jiraHost, addedKeys, completedKeys: _completedKeys }) {
  const typeName = rawIssue.typeName || TYPE_ID_MAP[rawIssue.typeId] || rawIssue.typeId || '';
  const storyPoints = getStoryPoints(rawIssue);
  const isEstimated = storyPoints != null && storyPoints > 0;
  const effectivePoints = isEstimated ? storyPoints : 1;
  const wasAddedMidSprint = addedKeys.has(rawIssue.key);
  const assigneeName = rawIssue.assigneeName || rawIssue.assignee || null;
  const assigneeKey = rawIssue.assigneeKey || null;

  return {
    key: rawIssue.key,
    summary: rawIssue.summary || '',
    type: typeName,
    status: rawIssue.statusName || rawIssue.status?.name || '',
    assignee: assigneeName ? { displayName: assigneeName, key: assigneeKey } : null,
    storyPoints: storyPoints,
    effectivePoints,
    isEstimated,
    wasAddedMidSprint,
    url: `${jiraHost}/browse/${rawIssue.key}`
  };
}

/**
 * Build a category summary from a list of normalized issues.
 */
function buildCategorySummary(issues) {
  let totalPoints = 0;
  let estimatedCount = 0;
  let unestimatedCount = 0;
  let defaultedPoints = 0;

  for (const issue of issues) {
    totalPoints += issue.effectivePoints;
    if (issue.isEstimated) {
      estimatedCount++;
    } else {
      unestimatedCount++;
      defaultedPoints += 1;
    }
  }

  return {
    issues,
    totalPoints,
    estimatedCount,
    unestimatedCount,
    defaultedPoints
  };
}

/**
 * Build per-assignee breakdown from committed + delivered issues.
 */
function buildAssigneeBreakdown(allIssues, completedKeys) {
  const byAssignee = {};

  for (const issue of allIssues) {
    const name = issue.assignee?.displayName || 'Unassigned';
    if (!byAssignee[name]) {
      byAssignee[name] = {
        pointsCompleted: 0,
        issuesCompleted: 0,
        pointsAssigned: 0,
        issuesAssigned: 0,
        completionRate: 0,
        issues: []
      };
    }

    const entry = byAssignee[name];
    entry.pointsAssigned += issue.effectivePoints;
    entry.issuesAssigned += 1;
    entry.issues.push(issue);

    if (completedKeys.has(issue.key)) {
      entry.pointsCompleted += issue.effectivePoints;
      entry.issuesCompleted += 1;
    }
  }

  // Compute completion rates
  for (const entry of Object.values(byAssignee)) {
    entry.completionRate = entry.issuesAssigned > 0
      ? Math.round((entry.issuesCompleted / entry.issuesAssigned) * 100)
      : 0;
  }

  return byAssignee;
}

/**
 * Process raw sprint report into normalized data model.
 *
 * @param {object} rawReport - Raw response from greenhopper sprint report API
 * @param {number} boardId - Board ID
 * @param {string} jiraHost - Jira host URL
 * @returns {object} Normalized sprint data
 */
function processSprintReport(rawReport, boardId, jiraHost) {
  const sprint = rawReport.sprint || {};
  const contents = rawReport.contents || {};

  // Build sets for categorization
  const addedKeys = new Set(
    Object.keys(contents.issueKeysAddedDuringSprint || {})
  );

  const completedRaw = contents.completedIssues || [];
  const incompleteRaw = contents.issuesNotCompletedInCurrentSprint || [];
  const removedRaw = contents.puntedIssues || [];

  const completedKeys = new Set(completedRaw.map(i => i.key));

  // Normalize all issues (filter to tracked types)
  const normalizeOpts = { jiraHost, addedKeys, completedKeys };

  const allCompleted = completedRaw
    .map(i => normalizeIssue(i, normalizeOpts))
    .filter(i => TRACKED_TYPES.has(i.type));

  const allIncomplete = incompleteRaw
    .map(i => normalizeIssue(i, normalizeOpts))
    .filter(i => TRACKED_TYPES.has(i.type));

  const allRemoved = removedRaw
    .map(i => normalizeIssue(i, normalizeOpts))
    .filter(i => TRACKED_TYPES.has(i.type));

  // Categorize:
  // - Committed = all issues that were NOT added mid-sprint (completed + incomplete + removed that weren't added)
  // - Delivered = completed issues
  // - Added mid-sprint = issues from any category that were added during sprint
  // - Removed = punted issues
  // - Incomplete = not completed, not removed

  const committedIssues = [
    ...allCompleted.filter(i => !i.wasAddedMidSprint),
    ...allIncomplete.filter(i => !i.wasAddedMidSprint),
    ...allRemoved.filter(i => !i.wasAddedMidSprint)
  ];

  const deliveredIssues = allCompleted;

  const addedMidSprintIssues = [
    ...allCompleted.filter(i => i.wasAddedMidSprint),
    ...allIncomplete.filter(i => i.wasAddedMidSprint),
    ...allRemoved.filter(i => i.wasAddedMidSprint)
  ];

  const removedIssues = allRemoved;
  const incompleteIssues = allIncomplete;

  // Build category summaries
  const committed = buildCategorySummary(committedIssues);
  const delivered = buildCategorySummary(deliveredIssues);
  const addedMidSprint = buildCategorySummary(addedMidSprintIssues);
  const removed = buildCategorySummary(removedIssues);
  const incomplete = buildCategorySummary(incompleteIssues);

  // Build assignee breakdown from all issues in the sprint (committed + added)
  const allSprintIssues = [
    ...committedIssues,
    ...addedMidSprintIssues.filter(i => !committedIssues.some(c => c.key === i.key))
  ];
  const byAssignee = buildAssigneeBreakdown(allSprintIssues, completedKeys);

  // Compute metrics
  const commitmentReliabilityPoints = committed.totalPoints > 0
    ? Math.round((delivered.totalPoints / committed.totalPoints) * 100)
    : 0;

  const committedCount = committed.issues.length;
  const deliveredCount = delivered.issues.length;
  const commitmentReliabilityCount = committedCount > 0
    ? Math.round((deliveredCount / committedCount) * 100)
    : 0;

  const metrics = {
    commitmentReliabilityPoints,
    commitmentReliabilityCount,
    velocityPoints: delivered.totalPoints,
    velocityCount: deliveredCount,
    scopeChangeCount: addedMidSprint.issues.length + removed.issues.length
  };

  return {
    sprint: {
      id: sprint.id,
      name: sprint.name,
      state: sprint.state,
      startDate: sprint.startDate || sprint.isoStartDate || null,
      endDate: sprint.endDate || sprint.isoEndDate || null,
      completeDate: sprint.completeDate || sprint.isoCompleteDate || null,
      boardId
    },
    committed,
    delivered,
    addedMidSprint,
    removed,
    incomplete,
    byAssignee,
    metrics
  };
}

module.exports = { processSprintReport, normalizeIssue, buildCategorySummary, getStoryPoints };
