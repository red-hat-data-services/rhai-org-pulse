import { classifyPipelineStage, buildTimeline } from './classify-stage.js'
import { classifyRfe } from './classify-rfe.js'
import { computeReadiness, deriveViolations, deriveHumanReviewStatus } from './compute-readiness.js'
import { computeWaitDays, sortPipelineItems } from './wait-days.js'
import { resolvePlaybook, resolveLinks, phaseContextLinks } from './resolve-links.js'

export { classifyRfe, classifyPipelineStage, buildTimeline }
export { computeReadiness, deriveViolations, deriveHumanReviewStatus }
export { computeWaitDays, sortPipelineItems }
export { resolvePlaybook, resolveLinks, phaseContextLinks }
export * from './constants.js'

/**
 * Build a full pipeline item from normalized issue + metadata.
 */
export function buildPipelineItem(issue, options = {}) {
  const { resources = [], playbooks = [], release = '3.5', jiraHost = 'https://redhat.atlassian.net' } = options

  const enriched = enrichIssue(issue)
  const stage = classifyPipelineStage(enriched, release)
  const playbook = stage.playbookSection
    ? resolvePlaybook(playbooks, resources, stage.playbookSection)
    : null

  const waitDays = computeWaitDays(enriched, stage)
  const timeline = buildTimeline(enriched, stage, release)
  const contextLinks = [
    ...phaseContextLinks(resources, stage.phase),
    ...(playbook?.links || [])
  ]

  const uniqueLinks = dedupeLinks(contextLinks)

  return {
    id: enriched.key,
    type: enriched.type,
    summary: enriched.summary,
    status: enriched.status,
    priority: enriched.priority || 'Normal',
    components: enriched.components || [],
    labels: enriched.labels || [],
    linkedRfe: enriched.linkedRfeKey || enriched.sourceRfe || null,
    linkedFeature: enriched.linkedFeature || null,
    stage: {
      id: stage.id,
      label: stage.label,
      phase: stage.phase,
      pmActionable: stage.pmActionable,
      playbookSection: stage.playbookSection
    },
    waitDays,
    pmActionable: stage.pmActionable,
    blocker: stage.failedGates?.length
      ? { failedGates: stage.failedGates, message: stage.failedGates.map(g => g.label).join('; ') }
      : stage.pmActionable
        ? { message: stage.label }
        : null,
    readiness: enriched.type === 'feature' ? computeReadiness(enriched) : null,
    playbook,
    timeline,
    links: {
      jira: `${jiraHost}/browse/${enriched.key}`,
      related: buildRelatedLinks(enriched, jiraHost),
      context: uniqueLinks
    },
    updated: enriched.updated,
    created: enriched.created
  }
}

function enrichIssue(issue) {
  const violations = issue.violations || deriveViolations(issue)
  const humanReviewStatus = deriveHumanReviewStatus(issue)
  return {
    ...issue,
    violations,
    humanReviewStatus,
    deliveryOwner: issue.deliveryOwner || issue.assignee || null
  }
}

function buildRelatedLinks(issue, jiraHost) {
  const links = []
  if (issue.linkedRfeKey) {
    links.push({ label: 'Source RFE', url: `${jiraHost}/browse/${issue.linkedRfeKey}` })
  }
  if (issue.sourceRfe && issue.sourceRfe !== issue.linkedRfeKey) {
    links.push({ label: 'Source RFE', url: `${jiraHost}/browse/${issue.sourceRfe}` })
  }
  if (issue.linkedFeature) {
    links.push({ label: 'Linked STRAT', url: `${jiraHost}/browse/${issue.linkedFeature}` })
  }
  return links
}

function dedupeLinks(links) {
  const seen = new Set()
  return links.filter(l => {
    const key = l.url || l.id
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/**
 * Classify and sort a list of normalized issues into pipeline items.
 */
export function buildPipeline(items, options = {}) {
  const pipelineItems = items.map(item => buildPipelineItem(item, options))
  return sortPipelineItems(pipelineItems)
}

/**
 * Summary stats for planning prep.
 */
export function buildStats(items) {
  const needAction = items.filter(i => i.pmActionable).length
  const inProgress = items.filter(i => !i.pmActionable && i.stage.phase < 4).length
  const ready = items.filter(i =>
    i.stage.id === 'planning-ready' || i.stage.id === 'release-gate-pending'
  ).length
  const complete = items.filter(i =>
    i.stage.id === 'epics-complete' || i.stage.id === 'complete'
  ).length
  return { needAction, inProgress, ready, complete, total: items.length }
}
