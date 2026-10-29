#!/usr/bin/env node

import { pathToFileURL } from 'node:url'
import trendHelpers from '../modules/releases/server/tech-debt/trends.js'

const { PROJECTS, buildTrendSnapshot, sixMonthWindow } = trendHelpers
const FIELDS = [
  'created',
  'resolutiondate',
  'components',
  'issuetype',
  'labels',
  'reporter',
  'customfield_10847'
].join(',')

function requireValue(name, value) {
  if (!value) throw new Error(`${name} must be set`)
  return value
}

export function historicalJql(now = new Date()) {
  const window = sixMonthWindow(now)
  return [
    `project in (${PROJECTS.join(', ')})`,
    'issuetype in (Bug, Vulnerability)',
    `((created >= "${window.startDate}" AND created < "${window.endExclusive}") OR ` +
      `(resolutiondate >= "${window.startDate}" AND resolutiondate < "${window.endExclusive}"))`
  ].join(' AND ')
}

function authorization(email, token) {
  return `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`
}

export async function requestJson(url, options = {}, fetchImpl = fetch) {
  const response = await fetchImpl(url, options)
  const text = await response.text()
  let body
  try { body = text ? JSON.parse(text) : null } catch { body = text }
  if (!response.ok) {
    const detail = typeof body === 'string' ? body : JSON.stringify(body)
    throw new Error(`${response.status} ${response.statusText}: ${detail}`)
  }
  return body
}

export async function fetchJiraPages(config, jql, fields = FIELDS, fetchImpl = fetch) {
  const rows = []
  let nextPageToken = null
  while (true) {
    const params = new URLSearchParams({ jql, fields, maxResults: '100' })
    if (nextPageToken) params.set('nextPageToken', nextPageToken)
    const page = await requestJson(
      `${config.jiraHost}/rest/api/3/search/jql?${params}`,
      {
        headers: {
          Authorization: authorization(config.jiraEmail, config.jiraToken),
          Accept: 'application/json'
        }
      },
      fetchImpl
    )
    const issues = Array.isArray(page && page.issues) ? page.issues : []
    rows.push(...issues)
    if (page && page.isLast === false && page.nextPageToken && issues.length) {
      nextPageToken = page.nextPageToken
    } else {
      break
    }
  }
  return rows
}

export async function collectSnapshot(config, now = new Date(), fetchImpl = fetch) {
  const baseJql = historicalJql(now)
  const [issues, sfdcIssues] = await Promise.all([
    fetchJiraPages(config, baseJql, FIELDS, fetchImpl),
    fetchJiraPages(config, `${baseJql} AND issuetype = Bug AND SFDC_Cases_Counter > 0`, 'key', fetchImpl)
  ])
  const sfdcKeys = new Set(sfdcIssues.map(function (issue) { return String(issue && issue.key || '').trim() }).filter(Boolean))
  return buildTrendSnapshot(issues, sfdcKeys, now)
}

export async function uploadSnapshot(config, snapshot, fetchImpl = fetch) {
  return requestJson(
    `${config.orgPulseUrl}/api/modules/releases/tech-debt/trends/bulk`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.orgPulseToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(snapshot)
    },
    fetchImpl
  )
}

export async function main(env = process.env, fetchImpl = fetch) {
  const config = {
    jiraHost: String(env.JIRA_HOST || 'https://redhat.atlassian.net').replace(/\/$/, ''),
    jiraEmail: requireValue('JIRA_EMAIL', env.JIRA_EMAIL),
    jiraToken: requireValue('JIRA_TOKEN', env.JIRA_TOKEN),
    orgPulseUrl: requireValue('ORG_PULSE_URL', env.ORG_PULSE_URL).replace(/\/$/, ''),
    orgPulseToken: requireValue('ORG_PULSE_TOKEN', env.ORG_PULSE_TOKEN)
  }
  const snapshot = await collectSnapshot(config, new Date(), fetchImpl)
  const result = await uploadSnapshot(config, snapshot, fetchImpl)
  console.log(`[tech-debt-trends] uploaded ${snapshot.issueCount} issues generated at ${snapshot.generatedAt}`)
  return result
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  main().catch(function (error) {
    console.error(`[tech-debt-trends] ${error.stack || error.message}`)
    process.exitCode = 1
  })
}
