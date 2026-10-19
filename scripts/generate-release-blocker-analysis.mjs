#!/usr/bin/env node

import { createHash } from 'node:crypto'
import blockerAnalysis from '../modules/releases/server/delivery/blocker-analysis.js'

const {
  extractCommentSignals,
  getMostRecentProposedDate,
  normalizeDecision,
  normalizeCategory,
  normalizePreventionCategory,
  buildBlockerAnalysisAggregates,
  EARLY_DETECTION_CATEGORIES
} = blockerAnalysis

const JIRA_HOST = (process.env.JIRA_HOST || 'https://redhat.atlassian.net').replace(/\/$/, '')
const JIRA_EMAIL = process.env.JIRA_EMAIL
const JIRA_TOKEN = process.env.JIRA_TOKEN
const ORG_PULSE_URL = (process.env.ORG_PULSE_URL || '').replace(/\/$/, '')
const ORG_PULSE_TOKEN = process.env.ORG_PULSE_TOKEN
const AI_BASE_URL = (process.env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')
const AI_API_KEY = process.env.AI_API_KEY
const AI_MODEL = process.env.AI_MODEL || 'gpt-5'
const PROMPT_VERSION = 'release-blocker-analysis-v1'
const ANALYSIS_ENDPOINT = '/api/modules/releases/delivery/blockers/analysis'
const JQL = [
  'project in (RHAIENG, RHOAIENG)',
  '(labels not in (RHOAI-releases, RHOAI-internal, devtestops-service) OR labels is empty)',
  'component not in (Documentation, PXE)',
  'priority in (Blocker)',
  'cf[10847] in (16772, 16774)',
  'ORDER BY updated DESC'
].join(' AND ')

function requireEnv(name, value) {
  if (!value) throw new Error(`${name} must be set`)
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options)
  const text = await response.text()
  let body
  try { body = text ? JSON.parse(text) : null } catch { body = text }
  if (!response.ok) {
    const detail = typeof body === 'string' ? body : JSON.stringify(body)
    throw new Error(`${response.status} ${response.statusText}: ${detail}`)
  }
  return body
}

function jiraHeaders() {
  return {
    Authorization: `Basic ${Buffer.from(`${JIRA_EMAIL}:${JIRA_TOKEN}`).toString('base64')}`,
    Accept: 'application/json'
  }
}

async function jiraGet(path) {
  return requestJson(`${JIRA_HOST}${path}`, { headers: jiraHeaders() })
}

async function fetchIssues() {
  const issues = []
  let nextPageToken = null
  while (true) {
    const params = new URLSearchParams({ jql: JQL, fields: [
      'summary', 'status', 'components', 'fixVersions', 'labels', 'priority', 'issuetype',
      'created', 'updated', 'customfield_10847'
    ].join(','), maxResults: '100' })
    if (nextPageToken) params.set('nextPageToken', nextPageToken)
    const page = await jiraGet(`/rest/api/3/search/jql?${params}`)
    const values = Array.isArray(page.issues) ? page.issues : []
    issues.push(...values)
    if (page.isLast !== false || !page.nextPageToken || values.length === 0) break
    nextPageToken = page.nextPageToken
  }
  return issues
}

async function fetchPagedIssueData(key, resource, collectionKey) {
  const values = []
  let startAt = 0
  while (true) {
    const params = new URLSearchParams({ startAt: String(startAt), maxResults: '100' })
    const page = await jiraGet(`/rest/api/3/issue/${encodeURIComponent(key)}/${resource}?${params}`)
    const entries = Array.isArray(page[collectionKey]) ? page[collectionKey] : []
    values.push(...entries)
    if (entries.length === 0 || entries.length < Number(page.maxResults || 100) || values.length >= Number(page.total || values.length)) break
    startAt += entries.length
  }
  return values
}

function blockerLabel(field) {
  if (!field) return null
  if (field.value || field.name) return field.value || field.name
  return { '16772': 'Approved', '16774': 'Rejected' }[String(field.id)] || null
}

function names(values, key) {
  return (Array.isArray(values) ? values : []).map(value => {
    if (value && typeof value === 'object') return value[key] || value.name || value.value || null
    return value
  }).filter(Boolean).map(String)
}

function fingerprint(base, signals) {
  const stable = JSON.stringify({
    key: base.key,
    summary: base.summary,
    components: base.components,
    fixVersions: base.fixVersions,
    releaseBlocker: base.releaseBlocker,
    labels: base.labels,
    proposedDate: base.proposedDate,
    relevantExcerpts: signals.relevantExcerpts,
    earlyDetectionResponse: signals.earlyDetectionResponse,
    regressionEvidence: signals.regressionEvidence
  })
  return createHash('sha256').update(stable).digest('hex')
}

function parseModelContent(body) {
  let content = body && body.choices && body.choices[0] && body.choices[0].message && body.choices[0].message.content
  if (Array.isArray(content)) content = content.map(part => part.text || '').join(' ')
  if (!content) throw new Error('AI response did not contain message content')
  const cleaned = String(content).replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  return JSON.parse(cleaned)
}

async function aiChat(messages) {
  const body = { model: AI_MODEL, temperature: 0, messages, response_format: { type: 'json_object' } }
  let response = await fetch(`${AI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${AI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!response.ok) {
    // Some OpenAI-compatible services do not implement response_format.
    const fallback = { ...body }
    delete fallback.response_format
    response = await fetch(`${AI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${AI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(fallback)
    })
  }
  const text = await response.text()
  if (!response.ok) throw new Error(`AI request failed (${response.status}): ${text.slice(0, 500)}`)
  return parseModelContent(JSON.parse(text))
}

function normalizedAiIssue(result, signals) {
  const source = result && typeof result === 'object' ? result : {}
  return {
    regression: normalizeDecision(source.regression),
    regressionEvidence: source.regressionEvidence || signals.regressionEvidence.join(' ') || null,
    couldIdentifyEarlier: normalizeDecision(source.couldIdentifyEarlier),
    earlyDetectionResponse: signals.earlyDetectionResponse || source.earlyDetectionResponse || null,
    earlyDetectionCategory: normalizeCategory(source.earlyDetectionCategory, EARLY_DETECTION_CATEGORIES),
    preventionCategory: normalizePreventionCategory(source.preventionCategory),
    prevention: source.prevention ? String(source.prevention).trim() : null,
    analysisConfidence: source.confidence ? String(source.confidence) : 'AI'
  }
}

async function analyzeIssue(issue, comments, changelog, previous) {
  const fields = issue.fields || {}
  const commentsSignals = extractCommentSignals(comments)
  const base = {
    key: issue.key,
    link: `${JIRA_HOST}/browse/${encodeURIComponent(issue.key)}`,
    summary: fields.summary || '',
    components: names(fields.components, 'name'),
    fixVersions: names(fields.fixVersions, 'name'),
    releaseBlocker: blockerLabel(fields.customfield_10847),
    labels: names(fields.labels),
    proposedDate: getMostRecentProposedDate(changelog)
  }
  base.hasPrereleaseCveLabel = base.labels.includes('prerelease-cve-remediation')
  base.analysisFingerprint = fingerprint(base, commentsSignals)

  const prior = previous && previous.key === base.key && previous.analysisFingerprint === base.analysisFingerprint
    ? previous
    : null
  const ai = prior || normalizedAiIssue(await aiChat([
    {
      role: 'system',
      content: 'You classify release blocker comments. Return JSON only. Never infer Yes or No when the evidence is absent; use Unknown. Use exactly the requested enum values.'
    },
    {
      role: 'user',
      content: JSON.stringify({
        task: 'Analyze one historical release blocker for continuous improvement.',
        issue: { key: base.key, summary: base.summary, components: base.components, fixVersions: base.fixVersions, releaseBlocker: base.releaseBlocker },
        regressionEvidence: commentsSignals.regressionEvidence,
        earlyDetectionQuestionResponse: commentsSignals.earlyDetectionResponse,
        relevantCommentExcerpts: commentsSignals.relevantExcerpts,
        output: {
          regression: 'Yes|No|Unknown',
          regressionEvidence: 'short evidence excerpt or empty string',
          couldIdentifyEarlier: 'Yes|No|Unknown',
          earlyDetectionCategory: EARLY_DETECTION_CATEGORIES.join('|'),
          preventionCategory: 'stable action category',
          prevention: 'one concise prevention recommendation or empty string',
          confidence: 'High|Medium|Low|Unknown'
        }
      })
    }
  ]), commentsSignals)

  return { ...base, ...ai }
}

async function loadPreviousSnapshot() {
  if (!ORG_PULSE_URL || !ORG_PULSE_TOKEN) return null
  try {
    return await requestJson(`${ORG_PULSE_URL}${ANALYSIS_ENDPOINT}`, {
      headers: { Authorization: `Bearer ${ORG_PULSE_TOKEN}`, Accept: 'application/json' }
    })
  } catch (error) {
    if (/\b404\b/.test(error.message)) return null
    console.warn(`Could not load previous analysis snapshot: ${error.message}`)
    return null
  }
}

async function buildInsights(aggregates, previous) {
  const prior = Array.isArray(previous && previous.insights) ? previous.insights : []
  try {
    const result = await aiChat([
      {
        role: 'system',
        content: 'You write concise, evidence-backed continuous-improvement insights. Return JSON only with an insights array of at most five objects containing text, evidenceCount, and issueKeys.'
      },
      {
        role: 'user',
        content: JSON.stringify({
          task: 'Identify actionable patterns in historical Approved and Rejected release blockers.',
          aggregates,
          output: { insights: [{ text: 'short insight', evidenceCount: 0, issueKeys: [] }] }
        })
      }
    ])
    return Array.isArray(result.insights) ? result.insights.slice(0, 5).map(insight => ({
      text: String(insight.text || '').trim(),
      evidenceCount: Number(insight.evidenceCount || 0),
      issueKeys: Array.isArray(insight.issueKeys) ? insight.issueKeys.map(String).slice(0, 20) : []
    })).filter(insight => insight.text) : prior
  } catch (error) {
    console.warn(`Could not generate aggregate insights: ${error.message}`)
    return prior
  }
}

async function upload(snapshot) {
  const response = await requestJson(`${ORG_PULSE_URL}${ANALYSIS_ENDPOINT}/bulk`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ORG_PULSE_TOKEN}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify(snapshot)
  })
  console.log(`Uploaded ${response.issueCount} analyzed release blockers (${response.partial ? 'partial' : 'complete'})`)
}

async function main() {
  requireEnv('JIRA_EMAIL', JIRA_EMAIL)
  requireEnv('JIRA_TOKEN', JIRA_TOKEN)
  requireEnv('ORG_PULSE_URL', ORG_PULSE_URL)
  requireEnv('ORG_PULSE_TOKEN', ORG_PULSE_TOKEN)
  requireEnv('AI_API_KEY', AI_API_KEY)

  const previous = await loadPreviousSnapshot()
  const previousIssues = new Map((previous && Array.isArray(previous.issues) ? previous.issues : []).map(issue => [issue.key, issue]))
  const jiraIssues = await fetchIssues()
  const issues = []
  const errors = []

  for (const issue of jiraIssues) {
    try {
      const [comments, changelog] = await Promise.all([
        fetchPagedIssueData(issue.key, 'comment', 'comments'),
        fetchPagedIssueData(issue.key, 'changelog', 'values')
      ])
      issues.push(await analyzeIssue(issue, comments, changelog, previousIssues.get(issue.key)))
    } catch (error) {
      errors.push({ key: issue.key, error: error.message })
      const fields = issue.fields || {}
      const labels = names(fields.labels)
      issues.push({
        key: issue.key,
        link: `${JIRA_HOST}/browse/${encodeURIComponent(issue.key)}`,
        summary: fields.summary || '',
        components: names(fields.components, 'name'),
        fixVersions: names(fields.fixVersions, 'name'),
        releaseBlocker: blockerLabel(fields.customfield_10847),
        labels,
        hasPrereleaseCveLabel: labels.includes('prerelease-cve-remediation'),
        proposedDate: null,
        regression: 'Unknown',
        regressionEvidence: null,
        couldIdentifyEarlier: 'Unknown',
        earlyDetectionResponse: null,
        earlyDetectionCategory: 'Unknown',
        preventionCategory: 'Unknown',
        prevention: null,
        analysisConfidence: 'Unknown'
      })
    }
  }

  const aggregates = buildBlockerAnalysisAggregates(issues)
  const insights = await buildInsights(aggregates, previous)
  await upload({
    generatedAt: new Date().toISOString(),
    fetchedAt: new Date().toISOString(),
    model: AI_MODEL,
    promptVersion: PROMPT_VERSION,
    source: { jql: JQL, issueCount: jiraIssues.length },
    partial: errors.length > 0,
    errors,
    issues,
    insights
  })
}

main().catch(error => {
  console.error(`[release-blocker-analysis] ${error.stack || error.message}`)
  process.exitCode = 1
})
