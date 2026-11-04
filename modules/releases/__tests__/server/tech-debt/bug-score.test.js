import { describe, expect, it } from 'vitest'

const { classifyBug, jiraSeverity, scoreBug } = require('../../../server/tech-debt/bug-score')

const NOW = new Date('2026-10-26T18:00:00.000Z')

function bug(overrides = {}) {
  return {
    jiraPriority: 'Medium',
    labels: [],
    reporter: null,
    releaseBlockerStatus: null,
    hasSfdcCases: false,
    dueDate: null,
    createdAt: '2026-10-26T00:00:00.000Z',
    ...overrides
  }
}

describe('Bug priority scoring', function () {
  it('scores every customer-impact rule without stacking overlapping signals', function () {
    expect(scoreBug(bug({ hasSfdcCases: true }), NOW).scoreBreakdown.customerImpact.points).toBe(30)
    expect(scoreBug(bug({ labels: ['AIBU_Feedback'] }), NOW).scoreBreakdown.customerImpact.points).toBe(15)
    expect(scoreBug(bug({ labels: ['AISSA_Feedback'] }), NOW).scoreBreakdown.customerImpact.points).toBe(15)
    expect(scoreBug(bug({ labels: ['BU_EarlyAccess_Feedback'] }), NOW).scoreBreakdown.customerImpact.points).toBe(15)
    expect(scoreBug(bug({ hasSfdcCases: true, labels: ['AIBU_Feedback'] }), NOW).scoreBreakdown.customerImpact.points).toBe(30)
    expect(scoreBug(bug(), NOW).scoreBreakdown.customerImpact.points).toBe(0)
  })

  it('scores delivery and security rules using only the highest match', function () {
    const prerelease = scoreBug(bug({
      labels: ['PRERELEASE-CVE-REMEDIATION', 'security'],
      reporter: { name: 'DevTestOps Jira Bot' }
    }), NOW)
    expect(prerelease.scoreBreakdown.deliverySecurity).toMatchObject({ points: 25, code: 'prerelease-cve' })

    expect(scoreBug(bug({ releaseBlockerStatus: 'Approved' }), NOW).scoreBreakdown.deliverySecurity.points).toBe(22)
    expect(scoreBug(bug({ labels: ['snyk', 'dependency'], reporter: { name: 'RHOAIENG AutomationBot' } }), NOW).scoreBreakdown.deliverySecurity.points).toBe(20)
    expect(scoreBug(bug({ labels: ['snyk', 'code-analysis'], reporter: { name: 'rhoaieng automationbot' } }), NOW).scoreBreakdown.deliverySecurity.points).toBe(16)
    expect(scoreBug(bug({ labels: ['snyk'], reporter: { name: 'rhoaieng automationbot' } }), NOW).scoreBreakdown.deliverySecurity.points).toBe(14)
    expect(scoreBug(bug({ labels: ['conforma-violation'] }), NOW).scoreBreakdown.deliverySecurity.points).toBe(12)
    expect(scoreBug(bug(), NOW).scoreBreakdown.deliverySecurity.points).toBe(0)
  })

  it('gives Snyk SCA precedence when SCA and SAST labels conflict', function () {
    const result = scoreBug(bug({
      labels: ['snyk', 'dependency', 'code-analysis', 'cwe-79'],
      reporter: { name: 'rhoaieng automationbot' }
    }), NOW)

    expect(result.scoreBreakdown.deliverySecurity).toMatchObject({ points: 20, code: 'snyk-sca' })
    expect(result.classificationSignals.map(signal => signal.code)).toContain('snyk-sca')
    expect(result.classificationSignals.map(signal => signal.code)).not.toContain('snyk-sast')
  })

  it('scores every detection-source boundary and takes the highest match', function () {
    expect(scoreBug(bug({ labels: ['odh-operator-auto-e2e-blocker'], reporter: { name: 'RHOAIENG AutomationBot' } }), NOW).scoreBreakdown.detectionSource.points).toBe(5)
    expect(scoreBug(bug({ labels: ['test-failed'], reporter: { name: 'DevTestOps Jira Bot' } }), NOW).scoreBreakdown.detectionSource.points).toBe(4)
    expect(scoreBug(bug({ reporter: { name: 'Workflow Validation' } }), NOW).scoreBreakdown.detectionSource.points).toBe(3)
    expect(scoreBug(bug({ labels: ['found_in_nightly'] }), NOW).scoreBreakdown.detectionSource.points).toBe(2)
    expect(scoreBug(bug({ labels: ['gate:release'] }), NOW).scoreBreakdown.detectionSource.points).toBe(2)
    expect(scoreBug(bug(), NOW).scoreBreakdown.detectionSource.points).toBe(0)
  })

  it.each([
    ['Blocker', 20],
    ['Highest', 20],
    ['Critical', 16],
    ['High', 16],
    ['Major', 12],
    ['Medium', 8],
    ['Normal', 8],
    ['Low', 4],
    ['Minor', 4],
    ['Lowest', 2],
    [null, 0],
    ['Undefined', 0]
  ])('scores Jira severity %s as %s', function (priority, points) {
    expect(jiraSeverity(priority).points).toBe(points)
  })

  it.each([
    ['2026-10-25', 15, 'Past due'],
    ['2026-10-26', 13, 'Due within 7 days'],
    ['2026-11-02', 13, 'Due within 7 days'],
    ['2026-11-03', 9, 'Due in 8–30 days'],
    ['2026-11-25', 9, 'Due in 8–30 days'],
    ['2026-11-26', 5, 'Due in 31–90 days'],
    ['2027-01-24', 5, 'Due in 31–90 days'],
    ['2027-01-25', 2, 'Due after 90 days'],
    [null, 0, 'Missing or invalid']
  ])('scores due date %s as %s', function (dueDate, points, state) {
    expect(scoreBug(bug({ dueDate }), NOW).scoreBreakdown.dueDate).toMatchObject({ points, state })
  })

  it.each([
    ['2026-10-20', 0, '0–1 week'],
    ['2026-10-12', 2, '2–3 weeks'],
    ['2026-09-28', 3, '4–7 weeks'],
    ['2026-08-31', 4, '8–12 weeks'],
    ['2026-07-27', 5, '13+ weeks'],
    [null, 0, 'Unknown']
  ])('scores age from %s as %s', function (createdAt, points, state) {
    expect(scoreBug(bug({ createdAt }), NOW).scoreBreakdown.age).toMatchObject({ points, state })
  })

  it('uses the required primary-type precedence while retaining non-exclusive evidence', function () {
    const classification = classifyBug(bug({
      hasSfdcCases: true,
      releaseBlockerStatus: 'Approved',
      labels: ['AIBU_Feedback', 'prerelease-cve-remediation', 'test-failed'],
      reporter: { id: 'account-123', name: 'DEVTESTOPS JIRA BOT' }
    }))

    expect(classification.primaryBugType).toEqual({ code: 'customer-linked', label: 'Affecting customer' })
    expect(classification.signals.map(signal => signal.code)).toEqual(expect.arrayContaining([
      'customer-linked',
      'field-feedback',
      'prerelease-cve',
      'approved-release-blocker',
      'devtestops-test-failure'
    ]))
    expect(classification.signals.find(signal => signal.code === 'prerelease-cve').evidenceData).toEqual({
      reporter: { id: 'account-123', name: 'DEVTESTOPS JIRA BOT' }
    })
  })

  it.each([
    [{ hasSfdcCases: true }, 'customer-linked'],
    [{ labels: ['prerelease-cve-remediation'], reporter: { name: 'devtestops jira bot' } }, 'prerelease-cve'],
    [{ releaseBlockerStatus: 'approved' }, 'approved-release-blocker'],
    [{ labels: ['AIBU_Feedback'] }, 'field-feedback'],
    [{ labels: ['test-failed'], reporter: { name: 'devtestops jira bot' } }, 'devtestops-e2e'],
    [{ reporter: { name: 'workflow validation' } }, 'workflow-validation'],
    [{ labels: ['product-bug'] }, 'component-team']
  ])('classifies primary Bug type %#', function (overrides, expected) {
    expect(classifyBug(bug(overrides)).primaryBugType.code).toBe(expected)
  })

  it('sums the highest matching dimension values without uncertainty bonuses', function () {
    const result = scoreBug(bug({
      hasSfdcCases: true,
      labels: ['prerelease-cve-remediation', 'odh-operator-auto-e2e-blocker'],
      reporter: { name: 'devtestops jira bot' },
      jiraPriority: 'Blocker',
      dueDate: '2026-10-25',
      createdAt: '2026-07-01'
    }), NOW)

    expect(result.rawScore).toBe(95)
    expect(result.priorityBand.level).toBe('P0')
    expect(result.scoreStatus).toBe('scored')
    expect(result.scoreModel).toBe('bug-v1')
  })

  it.each([
    [{}, 'P4'],
    [{ labels: ['AIBU_Feedback'], dueDate: '2026-11-02' }, 'P3'],
    [{ hasSfdcCases: true, dueDate: '2026-11-02' }, 'P2'],
    [{ hasSfdcCases: true, labels: ['security'], dueDate: '2026-10-25', createdAt: '2026-07-01' }, 'P1']
  ])('maps a Bug score to the shared priority band %#', function (overrides, expectedBand) {
    expect(scoreBug(bug(overrides), NOW).priorityBand.level).toBe(expectedBand)
  })

  it('applies the Approved Release Blocker P1 guardrail after raw scoring', function () {
    const result = scoreBug(bug({ releaseBlockerStatus: 'Approved', jiraPriority: 'Lowest' }), NOW)

    expect(result.rawScore).toBe(24)
    expect(result.priorityScore).toBe(70)
    expect(result.priorityBand.level).toBe('P1')
    expect(result.guardrail.applied).toBe(true)
  })

  it('applies the customer-linked high-severity P1 guardrail', function () {
    const result = scoreBug(bug({ hasSfdcCases: true, jiraPriority: 'Critical' }), NOW)

    expect(result.rawScore).toBe(46)
    expect(result.priorityScore).toBe(70)
    expect(result.guardrail.reasons[0]).toContain('Affecting-customer')
  })

  it('uses UTC calendar dates and completed seven-day periods', function () {
    const result = scoreBug(bug({
      dueDate: '2026-11-02T23:59:59-10:00',
      createdAt: '2026-10-12T23:59:59-10:00'
    }), new Date('2026-10-26T23:59:59-10:00'))

    expect(result.asOfDate).toBe('2026-10-27')
    expect(result.scoreBreakdown.dueDate.daysUntil).toBe(6)
    expect(result.scoreBreakdown.age.weeks).toBe(2)
  })
})
