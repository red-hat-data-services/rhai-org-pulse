import { describe, expect, it } from 'vitest'
import {
  JENKINS_BASE_URL,
  jenkinsLabel,
  rewriteJenkinsUrl,
  testReportUrl
} from './jenkinsUrl.js'

const LEGACY =
  'https://jenkins-csb-rhods-opendatascience.dno.corp.redhat.com/job/rhoai/job/3.6/job/rhoai-smoke/10/'
const CURRENT = `${JENKINS_BASE_URL}/job/rhoai/job/3.6/job/rhoai-smoke/10/`

describe('jenkinsUrl', () => {
  it('rewrites legacy CSB host to jenkins.rh-ods.com', () => {
    expect(rewriteJenkinsUrl(LEGACY)).toBe(CURRENT)
    expect(rewriteJenkinsUrl(CURRENT)).toBe(CURRENT)
    expect(rewriteJenkinsUrl(null)).toBeNull()
  })

  it('builds host-agnostic labels', () => {
    expect(jenkinsLabel(LEGACY)).toBe('rhoai/3.6/rhoai-smoke/10')
    expect(jenkinsLabel(CURRENT)).toBe('rhoai/3.6/rhoai-smoke/10')
  })

  it('builds testReport links on the new host', () => {
    expect(testReportUrl(LEGACY)).toBe(`${CURRENT}testReport/`)
    expect(testReportUrl(LEGACY, 'Ai Evaluations')).toBe(
      `${CURRENT}testReport/${encodeURIComponent('Ai Evaluations')}/`
    )
    expect(testReportUrl(CURRENT)).toBe(`${CURRENT}testReport/`)
  })
})
