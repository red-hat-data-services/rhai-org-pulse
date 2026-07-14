import { describe, it, expect } from 'vitest'

var { parseDescriptionSignals } = require('../../planning/health/description-scanner')

describe('parseDescriptionSignals', function() {
  it('returns empty signals for null input', function() {
    var result = parseDescriptionSignals(null)
    expect(result.hasContent).toBe(false)
    expect(result.signalCount).toBe(0)
  })

  it('returns empty signals for empty string', function() {
    var result = parseDescriptionSignals('')
    expect(result.hasContent).toBe(false)
    expect(result.signalCount).toBe(0)
  })

  it('returns empty signals for whitespace-only string', function() {
    var result = parseDescriptionSignals('   \n  ')
    expect(result.hasContent).toBe(false)
    expect(result.signalCount).toBe(0)
  })

  it('returns empty signals for non-ADF object', function() {
    var result = parseDescriptionSignals({ type: 'other' })
    expect(result.hasContent).toBe(false)
    expect(result.signalCount).toBe(0)
  })

  it('detects acceptance criteria with given/when/then', function() {
    var result = parseDescriptionSignals('Given a user is logged in when they click logout then they see the login page')
    expect(result.hasContent).toBe(true)
    expect(result.hasAcceptanceCriteria).toBe(true)
    expect(result.signalCount).toBeGreaterThanOrEqual(1)
  })

  it('detects acceptance criteria with AC: prefix', function() {
    var result = parseDescriptionSignals('AC: The feature must support dark mode')
    expect(result.hasAcceptanceCriteria).toBe(true)
  })

  it('detects acceptance criteria keyword', function() {
    var result = parseDescriptionSignals('The acceptance criteria for this feature are as follows')
    expect(result.hasAcceptanceCriteria).toBe(true)
  })

  it('detects success criteria keyword', function() {
    var result = parseDescriptionSignals('Success Criteria\n- Users can log in with SSO')
    expect(result.hasAcceptanceCriteria).toBe(true)
  })

  it('detects use case signals', function() {
    var result = parseDescriptionSignals('Use case: A developer wants to deploy their app')
    expect(result.hasUseCases).toBe(true)
  })

  it('detects user story pattern', function() {
    var result = parseDescriptionSignals('As a platform admin so that I can manage users')
    expect(result.hasUseCases).toBe(true)
  })

  it('detects scope definition', function() {
    var result = parseDescriptionSignals('In scope: API endpoints. Out of scope: UI changes')
    expect(result.hasScopeDefinition).toBe(true)
  })

  it('detects scope with colon', function() {
    var result = parseDescriptionSignals('Scope: This feature covers the backend only')
    expect(result.hasScopeDefinition).toBe(true)
  })

  it('detects requirements signals (HLR)', function() {
    var result = parseDescriptionSignals('HLR-001: The system shall support OAuth2')
    expect(result.hasRequirements).toBe(true)
  })

  it('detects requirements signals (NFR)', function() {
    var result = parseDescriptionSignals('NFR: Response time must be under 200ms')
    expect(result.hasRequirements).toBe(true)
  })

  it('detects non-functional requirements', function() {
    var result = parseDescriptionSignals('Non-functional requirement: 99.9% uptime')
    expect(result.hasRequirements).toBe(true)
  })

  it('detects risk signals', function() {
    var result = parseDescriptionSignals('Risk: dependency on external API availability')
    expect(result.hasRisks).toBe(true)
  })

  it('detects assumption signals', function() {
    var result = parseDescriptionSignals('Assumption: Users have modern browsers')
    expect(result.hasRisks).toBe(true)
  })

  it('detects constraint signals', function() {
    var result = parseDescriptionSignals('Constraint: Must work on RHEL 9')
    expect(result.hasRisks).toBe(true)
  })

  it('detects risks and assumptions heading without colon', function() {
    var result = parseDescriptionSignals('Risks and Assumptions\n- API may change\n- Team capacity limited')
    expect(result.hasRisks).toBe(true)
  })

  it('detects dependencies heading without colon', function() {
    var result = parseDescriptionSignals('Dependencies\n- Requires auth service v2\n- Needs DB migration')
    expect(result.hasRisks).toBe(true)
  })

  it('detects blockers heading without colon', function() {
    var result = parseDescriptionSignals('Blockers\n- Waiting on legal review')
    expect(result.hasRisks).toBe(true)
  })

  it('detects constraints heading without colon', function() {
    var result = parseDescriptionSignals('Constraints\n- Must run on RHEL 9\n- Budget limit $50k')
    expect(result.hasRisks).toBe(true)
  })

  it('detects architecture signal with technical approach heading', function() {
    var result = parseDescriptionSignals('Technical Approach\nWe will use a microservices architecture with event-driven communication')
    expect(result.hasArchitectureSignal).toBe(true)
  })

  it('detects architecture heading as review artifact', function() {
    var result = parseDescriptionSignals('## Architecture\nService mesh topology and API boundaries')
    expect(result.hasArchitectureSignal).toBe(true)
  })

  it('detects ADR and design doc as architecture signals', function() {
    expect(parseDescriptionSignals('See ADR-12 for the chosen approach').hasArchitectureSignal).toBe(true)
    expect(parseDescriptionSignals('Design doc: https://example.com/doc').hasArchitectureSignal).toBe(true)
  })

  it('does not treat bare narrative architecture as a review signal', function() {
    var result = parseDescriptionSignals('The agent architecture matters for latency in production workloads')
    expect(result.hasArchitectureSignal).toBe(false)
  })

  it('detects cross-functional dependency language', function() {
    var result = parseDescriptionSignals('This feature depends on Serving API v2 and is cross-team with Model Mesh')
    expect(result.hasCrossFunctionalDependency).toBe(true)
  })

  it('counts multiple signals correctly', function() {
    var text = 'AC: Feature supports dark mode\nUse case: Developer deploys app\nScope: Backend only\nRisk: API dependency'
    var result = parseDescriptionSignals(text)
    expect(result.hasContent).toBe(true)
    expect(result.hasAcceptanceCriteria).toBe(true)
    expect(result.hasUseCases).toBe(true)
    expect(result.hasScopeDefinition).toBe(true)
    expect(result.hasRisks).toBe(true)
    expect(result.signalCount).toBe(4)
  })

  it('returns hasContent=true for plain description without signals', function() {
    var result = parseDescriptionSignals('This feature adds a new button to the toolbar')
    expect(result.hasContent).toBe(true)
    expect(result.signalCount).toBe(0)
    expect(result.hasAcceptanceCriteria).toBe(false)
    expect(result.hasUseCases).toBe(false)
    expect(result.hasScopeDefinition).toBe(false)
    expect(result.hasRequirements).toBe(false)
    expect(result.hasRisks).toBe(false)
  })

  it('handles ADF input format', function() {
    var adf = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'AC: The feature must work. ' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Use case: Admin manages users' }] }
      ]
    }
    var result = parseDescriptionSignals(adf)
    expect(result.hasContent).toBe(true)
    expect(result.hasAcceptanceCriteria).toBe(true)
    expect(result.hasUseCases).toBe(true)
    expect(result.signalCount).toBe(2)
  })

  it('handles ADF with empty content', function() {
    var adf = { type: 'doc', content: [] }
    var result = parseDescriptionSignals(adf)
    expect(result.hasContent).toBe(false)
    expect(result.signalCount).toBe(0)
  })
})
