import { describe, it, expect } from 'vitest'

const { mergePerson, computeCoverage, processLifecycle } = require('../lifecycle')

describe('mergePerson', () => {
  const now = '2026-04-16T00:00:00.000Z'

  it('creates a new person when existing is null', () => {
    const fresh = { uid: 'jdoe', name: 'Jane Doe', email: 'jdoe@test.com', title: 'SRE', city: '', country: '', geo: '', location: '', officeLocation: '', costCenter: '', managerUid: null, githubUsername: 'jdoe', gitlabUsername: null }
    const result = mergePerson(null, fresh, 'orgRoot1', now)
    expect(result.isNew).toBe(true)
    expect(result.person.uid).toBe('jdoe')
    expect(result.person.status).toBe('active')
    expect(result.person.github).toEqual({ username: 'jdoe', source: 'ldap' })
    expect(result.person.gitlab).toBeNull()
    expect(result.person.firstSeenAt).toBe(now)
  })

  it('preserves manual GitHub override', () => {
    const existing = { uid: 'jdoe', name: 'Jane Doe', email: 'jdoe@test.com', title: 'SRE', city: '', country: '', geo: '', location: '', officeLocation: '', costCenter: '', managerUid: null, orgRoot: 'orgRoot1', github: { username: 'manual-name', source: 'manual' }, gitlab: null, status: 'active', firstSeenAt: now, lastSeenAt: now, inactiveSince: null }
    const fresh = { uid: 'jdoe', name: 'Jane Doe', email: 'jdoe@test.com', title: 'SRE', city: '', country: '', geo: '', location: '', officeLocation: '', costCenter: '', managerUid: null, githubUsername: 'ldap-name', gitlabUsername: null }
    const result = mergePerson(existing, fresh, 'orgRoot1', now)
    expect(result.person.github.username).toBe('manual-name')
    expect(result.person.github.source).toBe('manual')
  })

  it('reactivates inactive person', () => {
    const existing = { uid: 'jdoe', name: 'Jane', email: '', title: '', city: '', country: '', geo: '', location: '', officeLocation: '', costCenter: '', managerUid: null, orgRoot: 'org1', github: null, gitlab: null, status: 'inactive', firstSeenAt: now, lastSeenAt: now, inactiveSince: now }
    const fresh = { uid: 'jdoe', name: 'Jane', email: '', title: '', city: '', country: '', geo: '', location: '', officeLocation: '', costCenter: '', managerUid: null, githubUsername: null, gitlabUsername: null }
    const result = mergePerson(existing, fresh, 'org1', now)
    expect(result.person.status).toBe('active')
    expect(result.person.inactiveSince).toBeNull()
  })

  it('tracks field changes', () => {
    const existing = { uid: 'jdoe', name: 'Jane', email: 'old@test.com', title: 'SRE', city: '', country: '', geo: '', location: '', officeLocation: '', costCenter: '', managerUid: null, orgRoot: 'org1', github: null, gitlab: null, status: 'active', firstSeenAt: now, lastSeenAt: now, inactiveSince: null }
    const fresh = { uid: 'jdoe', name: 'Jane', email: 'new@test.com', title: 'SRE', city: '', country: '', geo: '', location: '', officeLocation: '', costCenter: '', managerUid: null, githubUsername: null, gitlabUsername: null }
    const result = mergePerson(existing, fresh, 'org1', now)
    expect(result.changes.length).toBe(1)
    expect(result.changes[0].field).toBe('email')
    expect(result.changes[0].from).toBe('old@test.com')
    expect(result.changes[0].to).toBe('new@test.com')
  })
})

describe('computeCoverage', () => {
  it('counts active people with GitHub/GitLab IDs', () => {
    const people = {
      u1: { status: 'active', github: { username: 'gh1', source: 'ldap' }, gitlab: null },
      u2: { status: 'active', github: null, gitlab: { username: 'gl1', source: 'manual' } },
      u3: { status: 'inactive', github: { username: 'gh2', source: 'ldap' }, gitlab: null }
    }
    const result = computeCoverage(people)
    expect(result.github.total).toBe(2)
    expect(result.github.hasId).toBe(1)
    expect(result.github.bySource.ldap).toBe(1)
    expect(result.gitlab.hasId).toBe(1)
    expect(result.gitlab.bySource.manual).toBe(1)
  })

  it('excludes auxiliary people from coverage stats', () => {
    const people = {
      u1: { status: 'active', orgType: 'engineering', github: { username: 'gh1', source: 'ldap' }, gitlab: null },
      aux1: { status: 'active', orgType: 'auxiliary', github: null, gitlab: null },
      aux2: { status: 'active', orgType: 'auxiliary', github: null, gitlab: null }
    }
    const result = computeCoverage(people)
    // Only u1 should be counted (total=1), aux1 and aux2 excluded
    expect(result.github.total).toBe(1)
    expect(result.github.hasId).toBe(1)
  })

  it('treats missing orgType as engineering', () => {
    const people = {
      u1: { status: 'active', github: null, gitlab: null }
      // no orgType field -- should be treated as engineering
    }
    const result = computeCoverage(people)
    expect(result.github.total).toBe(1)
  })
})

describe('processLifecycle', () => {
  const now = '2026-04-16T00:00:00.000Z'

  it('marks missing people as inactive', () => {
    const existing = { u1: { uid: 'u1', status: 'active', inactiveSince: null } }
    const fresh = {}
    const merged = {}
    const changelog = { joined: [], left: [], reactivated: [], changed: [] }
    processLifecycle(existing, fresh, merged, changelog, 30, now)
    expect(merged.u1.status).toBe('inactive')
    expect(changelog.left).toContain('u1')
  })

  it('purges people past grace period', () => {
    const longAgo = '2020-01-01T00:00:00.000Z'
    const existing = { u1: { uid: 'u1', status: 'inactive', inactiveSince: longAgo } }
    const fresh = {}
    const merged = {}
    const changelog = { joined: [], left: [], reactivated: [], changed: [] }
    processLifecycle(existing, fresh, merged, changelog, 30, now)
    expect(merged.u1).toBeUndefined()
  })

  it('skips auxiliary entries -- not marked inactive', () => {
    const existing = {
      aux1: { uid: 'aux1', status: 'active', orgType: 'auxiliary', inactiveSince: null }
    }
    const fresh = {} // aux1 not in fresh (not from org-root traversal)
    const merged = {}
    const changelog = { joined: [], left: [], reactivated: [], changed: [] }
    processLifecycle(existing, fresh, merged, changelog, 30, now)
    expect(merged.aux1).toBeDefined()
    expect(merged.aux1.status).toBe('active')
    expect(changelog.left).not.toContain('aux1')
  })

  it('preserves auxiliary entries in merged output', () => {
    const existing = {
      aux1: { uid: 'aux1', status: 'active', orgType: 'auxiliary', inactiveSince: null, name: 'Aux Person' }
    }
    const fresh = {}
    const merged = {}
    const changelog = { joined: [], left: [], reactivated: [], changed: [] }
    processLifecycle(existing, fresh, merged, changelog, 30, now)
    expect(merged.aux1.name).toBe('Aux Person')
    expect(merged.aux1.orgType).toBe('auxiliary')
  })

  it('does not purge auxiliary entries even past grace period', () => {
    const longAgo = '2020-01-01T00:00:00.000Z'
    const existing = {
      aux1: { uid: 'aux1', status: 'active', orgType: 'auxiliary', inactiveSince: longAgo }
    }
    const fresh = {}
    const merged = {}
    const changelog = { joined: [], left: [], reactivated: [], changed: [] }
    processLifecycle(existing, fresh, merged, changelog, 30, now)
    expect(merged.aux1).toBeDefined()
  })
})

describe('mergePerson orgType', () => {
  const now = '2026-04-16T00:00:00.000Z'

  it('includes orgType in new person fixed fields', () => {
    const fresh = { uid: 'newp', name: 'New Person', email: 'new@test.com', title: 'SRE', city: '', country: '', geo: '', location: '', officeLocation: '', costCenter: '', managerUid: null, githubUsername: null, gitlabUsername: null }
    const result = mergePerson(null, fresh, 'orgRoot1', now)
    expect(result.person.orgType).toBe('engineering')
  })

  it('preserves existing orgType on merge', () => {
    const existing = { uid: 'aux1', name: 'Aux', email: '', title: '', city: '', country: '', geo: '', location: '', officeLocation: '', costCenter: '', managerUid: null, orgRoot: '_auxiliary', orgType: 'auxiliary', github: null, gitlab: null, status: 'active', firstSeenAt: now, lastSeenAt: now, inactiveSince: null }
    const fresh = { uid: 'aux1', name: 'Aux', email: '', title: '', city: '', country: '', geo: '', location: '', officeLocation: '', costCenter: '', managerUid: null, githubUsername: null, gitlabUsername: null }
    const result = mergePerson(existing, fresh, '_auxiliary', now)
    // orgType is not in TRACKED_FIELDS, so existing value should persist
    expect(result.person.orgType).toBe('auxiliary')
  })
})
