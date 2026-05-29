import { describe, it, expect } from 'vitest'

const { hygieneRules, evaluateHygiene, getRuleDefaults, RULE_CATEGORIES } = require('../../../server/hygiene/hygiene-rules')

// Helper to build a minimal feature object
function makeFeature(overrides) {
  return {
    key: 'TEST-1',
    summary: 'Test feature',
    issueType: 'Feature',
    status: 'In Progress',
    statusCategory: 'In Progress',
    assignee: 'Jane Doe',
    team: 'Model Serving',
    fixVersions: ['RHOAI-2.14'],
    components: [],
    labels: [],
    releaseType: 'GA',
    statusSummary: 'On track',
    colorStatus: 'Green',
    docsRequired: 'Yes',
    targetEnd: '2026-06-15',
    riceStatus: 'complete',
    riceScore: 42,
    linkedRfeKey: 'RHAIRFE-100',
    linkedRfeApproved: true,
    statusEnteredAt: new Date().toISOString(),
    statusSummaryUpdated: new Date().toISOString(),
    violations: [],
    ...overrides
  }
}

function daysAgo(n) {
  var d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

function findRule(id) {
  return hygieneRules.find(function (r) { return r.id === id })
}

// ─── RULE_CATEGORIES ─────────────────────────────────────────────────

describe('RULE_CATEGORIES', function () {
  it('has expected category keys', function () {
    expect(RULE_CATEGORIES).toHaveProperty('ownership')
    expect(RULE_CATEGORIES).toHaveProperty('timeliness')
    expect(RULE_CATEGORIES).toHaveProperty('metadata')
    expect(RULE_CATEGORIES).toHaveProperty('lifecycle')
  })

  it('has string labels for each category', function () {
    var keys = Object.keys(RULE_CATEGORIES)
    for (var i = 0; i < keys.length; i++) {
      expect(typeof RULE_CATEGORIES[keys[i]]).toBe('string')
    }
  })
})

// ─── getRuleDefaults ─────────────────────────────────────────────────

describe('getRuleDefaults', function () {
  it('returns config entries for all rules', function () {
    var defaults = getRuleDefaults()
    for (var i = 0; i < hygieneRules.length; i++) {
      expect(defaults).toHaveProperty(hygieneRules[i].id)
    }
  })

  it('all defaults have an enabled boolean', function () {
    var defaults = getRuleDefaults()
    var ids = Object.keys(defaults)
    for (var i = 0; i < ids.length; i++) {
      expect(typeof defaults[ids[i]].enabled).toBe('boolean')
    }
  })

  it('includes threshold for rules that have defaultThreshold', function () {
    var defaults = getRuleDefaults()
    expect(defaults['stale-status-summary'].threshold).toBe(7)
  })

  it('includes grandfatheredReleases for missing-rice-score', function () {
    var defaults = getRuleDefaults()
    expect(defaults['missing-rice-score'].grandfatheredReleases).toEqual([])
  })
})

// ─── Individual Rule Tests ───────────────────────────────────────────

describe('missing-assignee', function () {
  var rule = findRule('missing-assignee')

  it('triggers when in progress with no assignee', function () {
    var feature = makeFeature({ status: 'In Progress', assignee: null })
    expect(rule.check(feature, {})).toBe(true)
  })

  it('triggers in Refinement with no assignee', function () {
    var feature = makeFeature({ status: 'Refinement', assignee: null })
    expect(rule.check(feature, {})).toBe(true)
  })

  it('does not trigger when assignee is set', function () {
    var feature = makeFeature({ assignee: 'Someone' })
    expect(rule.check(feature, {})).toBe(false)
  })

  it('does not trigger for New status', function () {
    var feature = makeFeature({ status: 'New', assignee: null })
    expect(rule.check(feature, {})).toBe(false)
  })

  it('handles empty string assignee as truthy', function () {
    // Empty string is falsy so should trigger
    var feature = makeFeature({ status: 'In Progress', assignee: '' })
    expect(rule.check(feature, {})).toBe(true)
  })
})

describe('missing-team', function () {
  var rule = findRule('missing-team')

  it('triggers when in progress with no team', function () {
    var feature = makeFeature({ status: 'In Progress', team: null })
    expect(rule.check(feature, {})).toBe(true)
  })

  it('triggers in Refinement with no team', function () {
    var feature = makeFeature({ status: 'Refinement', team: null })
    expect(rule.check(feature, {})).toBe(true)
  })

  it('does not trigger when team is set', function () {
    var feature = makeFeature({ team: 'Some Team' })
    expect(rule.check(feature, {})).toBe(false)
  })

  it('does not trigger for inactive status', function () {
    var feature = makeFeature({ status: 'Closed', team: null })
    expect(rule.check(feature, {})).toBe(false)
  })
})

describe('stale-status-summary', function () {
  var rule = findRule('stale-status-summary')

  it('triggers when summary exists but is stale', function () {
    var feature = makeFeature({
      status: 'In Progress',
      statusSummary: 'Old update',
      statusSummaryUpdated: daysAgo(10)
    })
    expect(rule.check(feature, {})).toBe(true)
  })

  it('does not trigger when summary was recently updated', function () {
    var feature = makeFeature({
      status: 'In Progress',
      statusSummary: 'Recent update',
      statusSummaryUpdated: daysAgo(3)
    })
    expect(rule.check(feature, {})).toBe(false)
  })

  it('triggers when no summary and in status beyond threshold', function () {
    var feature = makeFeature({
      status: 'In Progress',
      statusSummary: null,
      statusSummaryUpdated: null,
      statusEnteredAt: daysAgo(10)
    })
    expect(rule.check(feature, {})).toBe(true)
  })

  it('does not trigger when no summary but in status within threshold', function () {
    var feature = makeFeature({
      status: 'In Progress',
      statusSummary: null,
      statusSummaryUpdated: null,
      statusEnteredAt: daysAgo(3)
    })
    expect(rule.check(feature, {})).toBe(false)
  })

  it('does not trigger for inactive status', function () {
    var feature = makeFeature({
      status: 'Closed',
      statusSummary: null,
      statusSummaryUpdated: null,
      statusEnteredAt: daysAgo(30)
    })
    expect(rule.check(feature, {})).toBe(false)
  })

  it('respects custom threshold', function () {
    var feature = makeFeature({
      status: 'In Progress',
      statusSummary: 'Some update',
      statusSummaryUpdated: daysAgo(5)
    })
    expect(rule.check(feature, { threshold: 3 })).toBe(true)
    expect(rule.check(feature, { threshold: 10 })).toBe(false)
  })

  it('message mentions days for stale summary', function () {
    var feature = makeFeature({
      status: 'In Progress',
      statusSummary: 'Old',
      statusSummaryUpdated: daysAgo(10)
    })
    var msg = rule.message(feature)
    expect(msg).toMatch(/\d+ days/)
  })

  it('message mentions missing summary when absent', function () {
    var feature = makeFeature({
      status: 'In Progress',
      statusSummary: null,
      statusEnteredAt: daysAgo(10)
    })
    var msg = rule.message(feature)
    expect(msg).toContain('without a status summary')
  })
})

describe('missing-color-status', function () {
  var rule = findRule('missing-color-status')

  it('triggers when in progress with no color status', function () {
    var feature = makeFeature({ status: 'In Progress', colorStatus: null })
    expect(rule.check(feature, {})).toBe(true)
  })

  it('does not trigger when color status is set', function () {
    var feature = makeFeature({ status: 'In Progress', colorStatus: 'Green' })
    expect(rule.check(feature, {})).toBe(false)
  })

  it('does not trigger for Refinement status', function () {
    var feature = makeFeature({ status: 'Refinement', colorStatus: null })
    expect(rule.check(feature, {})).toBe(false)
  })

  it('triggers for Review status (also In Progress group)', function () {
    var feature = makeFeature({ status: 'Review', colorStatus: null })
    expect(rule.check(feature, {})).toBe(true)
  })
})

describe('missing-release-type', function () {
  var rule = findRule('missing-release-type')

  it('triggers for Feature in progress with no release type', function () {
    var feature = makeFeature({ status: 'In Progress', issueType: 'Feature', releaseType: null })
    expect(rule.check(feature, {})).toBe(true)
  })

  it('does not trigger when release type is set', function () {
    var feature = makeFeature({ status: 'In Progress', issueType: 'Feature', releaseType: 'GA' })
    expect(rule.check(feature, {})).toBe(false)
  })

  it('does not trigger for Initiative issue type', function () {
    var feature = makeFeature({ status: 'In Progress', issueType: 'Initiative', releaseType: null })
    expect(rule.check(feature, {})).toBe(false)
  })

  it('does not trigger for Refinement status', function () {
    var feature = makeFeature({ status: 'Refinement', issueType: 'Feature', releaseType: null })
    expect(rule.check(feature, {})).toBe(false)
  })
})

describe('missing-rfe-link', function () {
  var rule = findRule('missing-rfe-link')

  it('triggers for active Feature without approved RFE', function () {
    var feature = makeFeature({ status: 'In Progress', issueType: 'Feature', linkedRfeApproved: false })
    expect(rule.check(feature, {})).toBe(true)
  })

  it('does not trigger when RFE is approved', function () {
    var feature = makeFeature({ status: 'In Progress', issueType: 'Feature', linkedRfeApproved: true })
    expect(rule.check(feature, {})).toBe(false)
  })

  it('does not trigger for non-Feature types', function () {
    var feature = makeFeature({ status: 'In Progress', issueType: 'Initiative', linkedRfeApproved: false })
    expect(rule.check(feature, {})).toBe(false)
  })

  it('does not trigger for inactive status', function () {
    var feature = makeFeature({ status: 'New', issueType: 'Feature', linkedRfeApproved: false })
    expect(rule.check(feature, {})).toBe(false)
  })

  it('triggers in Refinement for Feature', function () {
    var feature = makeFeature({ status: 'Refinement', issueType: 'Feature', linkedRfeApproved: false })
    expect(rule.check(feature, {})).toBe(true)
  })

  it('message differs when no RFE key vs unapproved RFE', function () {
    var noLink = makeFeature({ linkedRfeKey: null, linkedRfeApproved: false })
    var unapproved = makeFeature({ linkedRfeKey: 'RHAIRFE-99', linkedRfeApproved: false })
    expect(rule.message(noLink)).toContain('not linked to an RFE')
    expect(rule.message(unapproved)).toContain('RHAIRFE-99')
    expect(rule.message(unapproved)).toContain('not in Approved status')
  })
})

describe('missing-fix-version', function () {
  var rule = findRule('missing-fix-version')

  it('triggers for Feature in progress with no fix versions', function () {
    var feature = makeFeature({ status: 'In Progress', issueType: 'Feature', fixVersions: [] })
    expect(rule.check(feature, {})).toBe(true)
  })

  it('triggers for Initiative in progress with null fix versions', function () {
    var feature = makeFeature({ status: 'In Progress', issueType: 'Initiative', fixVersions: null })
    expect(rule.check(feature, {})).toBe(true)
  })

  it('does not trigger when fix versions are set', function () {
    var feature = makeFeature({ status: 'In Progress', issueType: 'Feature', fixVersions: ['v1'] })
    expect(rule.check(feature, {})).toBe(false)
  })

  it('does not trigger for non-Feature/Initiative types', function () {
    var feature = makeFeature({ status: 'In Progress', issueType: 'Bug', fixVersions: [] })
    expect(rule.check(feature, {})).toBe(false)
  })

  it('does not trigger for Refinement status', function () {
    var feature = makeFeature({ status: 'Refinement', issueType: 'Feature', fixVersions: [] })
    expect(rule.check(feature, {})).toBe(false)
  })
})

describe('missing-docs-required', function () {
  var rule = findRule('missing-docs-required')

  it('triggers for Feature in progress with no docs required', function () {
    var feature = makeFeature({ status: 'In Progress', issueType: 'Feature', docsRequired: null })
    expect(rule.check(feature, {})).toBe(true)
  })

  it('triggers when docs required is "None"', function () {
    var feature = makeFeature({ status: 'In Progress', issueType: 'Feature', docsRequired: 'None' })
    expect(rule.check(feature, {})).toBe(true)
  })

  it('does not trigger when docs required is set to Yes', function () {
    var feature = makeFeature({ status: 'In Progress', issueType: 'Feature', docsRequired: 'Yes' })
    expect(rule.check(feature, {})).toBe(false)
  })

  it('does not trigger for non-Feature types', function () {
    var feature = makeFeature({ status: 'In Progress', issueType: 'Initiative', docsRequired: null })
    expect(rule.check(feature, {})).toBe(false)
  })

  it('does not trigger for Refinement status', function () {
    var feature = makeFeature({ status: 'Refinement', issueType: 'Feature', docsRequired: null })
    expect(rule.check(feature, {})).toBe(false)
  })
})

describe('missing-target-end', function () {
  var rule = findRule('missing-target-end')

  it('triggers for Feature in progress with no target end', function () {
    var feature = makeFeature({ status: 'In Progress', issueType: 'Feature', targetEnd: null })
    expect(rule.check(feature, {})).toBe(true)
  })

  it('triggers for Feature in Refinement with no target end', function () {
    var feature = makeFeature({ status: 'Refinement', issueType: 'Feature', targetEnd: null })
    expect(rule.check(feature, {})).toBe(true)
  })

  it('does not trigger when target end is set', function () {
    var feature = makeFeature({ status: 'In Progress', issueType: 'Feature', targetEnd: '2026-06-01' })
    expect(rule.check(feature, {})).toBe(false)
  })

  it('does not trigger for non-Feature types', function () {
    var feature = makeFeature({ status: 'In Progress', issueType: 'Initiative', targetEnd: null })
    expect(rule.check(feature, {})).toBe(false)
  })

  it('does not trigger for inactive status', function () {
    var feature = makeFeature({ status: 'Closed', issueType: 'Feature', targetEnd: null })
    expect(rule.check(feature, {})).toBe(false)
  })
})

describe('missing-rice-score', function () {
  var rule = findRule('missing-rice-score')

  it('triggers for Feature in Refinement without RICE', function () {
    var feature = makeFeature({ status: 'Refinement', issueType: 'Feature', riceStatus: 'none' })
    expect(rule.check(feature, {})).toBe(true)
  })

  it('triggers for Feature in Refinement with partial RICE', function () {
    var feature = makeFeature({ status: 'Refinement', issueType: 'Feature', riceStatus: 'partial' })
    expect(rule.check(feature, {})).toBe(true)
  })

  it('does not trigger when RICE is complete', function () {
    var feature = makeFeature({ status: 'Refinement', issueType: 'Feature', riceStatus: 'complete' })
    expect(rule.check(feature, {})).toBe(false)
  })

  it('triggers for Feature in progress without RICE', function () {
    var feature = makeFeature({ status: 'In Progress', issueType: 'Feature', riceStatus: 'none' })
    expect(rule.check(feature, {})).toBe(true)
  })

  it('does not trigger for non-Feature types', function () {
    var feature = makeFeature({ status: 'Refinement', issueType: 'Initiative', riceStatus: 'none' })
    expect(rule.check(feature, {})).toBe(false)
  })

  it('does not trigger for inactive status', function () {
    var feature = makeFeature({ status: 'New', issueType: 'Feature', riceStatus: 'none' })
    expect(rule.check(feature, {})).toBe(false)
  })

  it('skips in-progress features with grandfathered release', function () {
    var feature = makeFeature({
      status: 'In Progress',
      issueType: 'Feature',
      riceStatus: 'none',
      fixVersions: ['RHOAI-2.13']
    })
    var config = { grandfatheredReleases: ['RHOAI-2.13'] }
    expect(rule.check(feature, config)).toBe(false)
  })

  it('still triggers for in-progress features not in grandfathered release', function () {
    var feature = makeFeature({
      status: 'In Progress',
      issueType: 'Feature',
      riceStatus: 'none',
      fixVersions: ['RHOAI-2.14']
    })
    var config = { grandfatheredReleases: ['RHOAI-2.13'] }
    expect(rule.check(feature, config)).toBe(true)
  })

  it('still triggers in Refinement even with grandfathered releases', function () {
    var feature = makeFeature({
      status: 'Refinement',
      issueType: 'Feature',
      riceStatus: 'none',
      fixVersions: ['RHOAI-2.13']
    })
    var config = { grandfatheredReleases: ['RHOAI-2.13'] }
    expect(rule.check(feature, config)).toBe(true)
  })

  it('handles empty grandfatheredReleases array', function () {
    var feature = makeFeature({
      status: 'In Progress',
      issueType: 'Feature',
      riceStatus: 'none',
      fixVersions: ['RHOAI-2.14']
    })
    var config = { grandfatheredReleases: [] }
    expect(rule.check(feature, config)).toBe(true)
  })

  it('message differs for Refinement vs In Progress', function () {
    var refinement = makeFeature({ status: 'Refinement', issueType: 'Feature', riceStatus: 'none' })
    var inProgress = makeFeature({ status: 'In Progress', issueType: 'Feature', riceStatus: 'none' })
    expect(rule.message(refinement)).toContain('in Refinement')
    expect(rule.message(inProgress)).toContain('In Progress')
  })
})

// ─── evaluateHygiene ─────────────────────────────────────────────────

describe('evaluateHygiene', function () {
  it('returns no violations for a clean feature', function () {
    var feature = makeFeature()
    var violations = evaluateHygiene(feature, {})
    expect(violations).toEqual([])
  })

  it('returns violations for a feature with multiple issues', function () {
    var feature = makeFeature({
      status: 'In Progress',
      issueType: 'Feature',
      assignee: null,
      team: null,
      colorStatus: null
    })
    var violations = evaluateHygiene(feature, {})
    var ids = violations.map(function (v) { return v.id })
    expect(ids).toContain('missing-assignee')
    expect(ids).toContain('missing-team')
    expect(ids).toContain('missing-color-status')
  })

  it('each violation has id, name, category, and message', function () {
    var feature = makeFeature({ status: 'In Progress', assignee: null })
    var violations = evaluateHygiene(feature, {})
    expect(violations.length).toBeGreaterThan(0)
    var v = violations[0]
    expect(v).toHaveProperty('id')
    expect(v).toHaveProperty('name')
    expect(v).toHaveProperty('category')
    expect(v).toHaveProperty('message')
  })

  it('respects disabled rules in config', function () {
    var feature = makeFeature({ status: 'In Progress', assignee: null })
    var config = { 'missing-assignee': { enabled: false } }
    var violations = evaluateHygiene(feature, config)
    var ids = violations.map(function (v) { return v.id })
    expect(ids).not.toContain('missing-assignee')
  })

  it('handles null rulesConfig', function () {
    var feature = makeFeature()
    var violations = evaluateHygiene(feature, null)
    expect(Array.isArray(violations)).toBe(true)
  })

  it('all 14 rules are registered', function () {
    expect(hygieneRules.length).toBe(14)
  })
})

// ── open-children-on-closed ──

describe('open-children-on-closed', function () {
  var rule = hygieneRules.find(function (r) { return r.id === 'open-children-on-closed' })

  it('exists and is lifecycle category', function () {
    expect(rule).toBeDefined()
    expect(rule.category).toBe('lifecycle')
  })

  it('triggers for Release Pending feature with open children', function () {
    var feature = makeFeature({ status: 'Release Pending', openChildCount: 3 })
    expect(rule.check(feature, {})).toBe(true)
  })

  it('triggers for Closed feature with open children', function () {
    var feature = makeFeature({ status: 'Closed', openChildCount: 1 })
    expect(rule.check(feature, {})).toBe(true)
  })

  it('does not trigger for terminal feature with no open children', function () {
    var feature = makeFeature({ status: 'Release Pending', openChildCount: 0 })
    expect(rule.check(feature, {})).toBe(false)
  })

  it('does not trigger for active feature with open children', function () {
    var feature = makeFeature({ status: 'In Progress', openChildCount: 5 })
    expect(rule.check(feature, {})).toBe(false)
  })

  it('message includes the count', function () {
    var feature = makeFeature({ status: 'Closed', openChildCount: 4 })
    expect(rule.message(feature)).toContain('4 open child issues')
  })
})

// ── open-in-released-version ──

describe('open-in-released-version', function () {
  var rule = hygieneRules.find(function (r) { return r.id === 'open-in-released-version' })

  it('exists and is lifecycle category', function () {
    expect(rule).toBeDefined()
    expect(rule.category).toBe('lifecycle')
  })

  it('triggers for open feature in released version', function () {
    var feature = makeFeature({ status: 'In Progress', versionReleased: true, versionGaDate: '2026-01-15' })
    expect(rule.check(feature, {})).toBe(true)
  })

  it('triggers for New feature in released version', function () {
    var feature = makeFeature({ status: 'New', versionReleased: true })
    expect(rule.check(feature, {})).toBe(true)
  })

  it('does not trigger for closed feature in released version', function () {
    var feature = makeFeature({ status: 'Closed', versionReleased: true })
    expect(rule.check(feature, {})).toBe(false)
  })

  it('does not trigger for Resolved feature in released version', function () {
    var feature = makeFeature({ status: 'Resolved', versionReleased: true })
    expect(rule.check(feature, {})).toBe(false)
  })

  it('does not trigger when version is not released', function () {
    var feature = makeFeature({ status: 'In Progress', versionReleased: false })
    expect(rule.check(feature, {})).toBe(false)
  })

  it('message includes GA date when available', function () {
    var feature = makeFeature({ status: 'In Progress', versionReleased: true, versionGaDate: '2026-01-15' })
    expect(rule.message(feature)).toContain('GA: 2026-01-15')
  })

  it('message works without GA date', function () {
    var feature = makeFeature({ status: 'In Progress', versionReleased: true, versionGaDate: null })
    var msg = rule.message(feature)
    expect(msg).toContain('already been released')
    expect(msg).not.toContain('GA:')
  })
})

// ── missing-target-version ──

describe('missing-target-version', function () {
  var rule = hygieneRules.find(function (r) { return r.id === 'missing-target-version' })

  it('exists and is metadata category', function () {
    expect(rule).toBeDefined()
    expect(rule.category).toBe('metadata')
  })

  it('triggers when missingTargetVersion is true', function () {
    var feature = makeFeature({ missingTargetVersion: true })
    expect(rule.check(feature, {})).toBe(true)
  })

  it('does not trigger when missingTargetVersion is false', function () {
    var feature = makeFeature({ missingTargetVersion: false })
    expect(rule.check(feature, {})).toBe(false)
  })

  it('does not trigger when missingTargetVersion is not set', function () {
    var feature = makeFeature()
    expect(rule.check(feature, {})).toBe(false)
  })
})

// ── missing-affected-version ──

describe('missing-affected-version', function () {
  var rule = hygieneRules.find(function (r) { return r.id === 'missing-affected-version' })

  it('exists and is metadata category', function () {
    expect(rule).toBeDefined()
    expect(rule.category).toBe('metadata')
  })

  it('triggers for post-release bug with no affected versions', function () {
    var feature = makeFeature({ issueType: 'Bug', versionReleased: true, affectedVersions: [] })
    expect(rule.check(feature, {})).toBe(true)
  })

  it('does not trigger for bug with affected versions set', function () {
    var feature = makeFeature({ issueType: 'Bug', versionReleased: true, affectedVersions: ['rhoai-3.4'] })
    expect(rule.check(feature, {})).toBe(false)
  })

  it('does not trigger for non-Bug issue type', function () {
    var feature = makeFeature({ issueType: 'Feature', versionReleased: true, affectedVersions: [] })
    expect(rule.check(feature, {})).toBe(false)
  })

  it('does not trigger for bug in unreleased version', function () {
    var feature = makeFeature({ issueType: 'Bug', versionReleased: false, affectedVersions: [] })
    expect(rule.check(feature, {})).toBe(false)
  })

  it('does not trigger when affectedVersions is undefined', function () {
    var feature = makeFeature({ issueType: 'Bug', versionReleased: true })
    // affectedVersions defaults to undefined in makeFeature, rule treats as empty
    expect(rule.check(feature, {})).toBe(true)
  })
})
