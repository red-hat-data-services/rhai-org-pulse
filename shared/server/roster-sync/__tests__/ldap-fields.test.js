import { describe, it, expect } from 'vitest'

const { entryToPerson, discoverAttributes, LDAP_ATTRS } = require('../ipa-client')
const { mergePerson } = require('../lifecycle')

describe('entryToPerson with extraAttrs', () => {
  const baseEntry = {
    uid: 'rgibson',
    cn: 'Ryan Gibson',
    mail: 'rgibson@redhat.com',
    title: 'Manager, Software Engineering',
    l: 'Indianapolis',
    co: 'USA',
    rhatGeo: 'NA',
    rhatLocation: 'Remote US IN',
    rhatOfficeLocation: 'Remote US IN',
    rhatCostCenter: '656',
    rhatRnDComponent: 'Enablement',
    rhatSubproduct: 'Red Hat OpenShift AI',
    rhatJobRole: 'Content Services',
    rhatPersonType: 'Employee',
    rhatHireDate: '20190429040000Z',
    rhatTeamLead: 'False'
  }

  it('returns no ldapExtra when extraAttrs is undefined', () => {
    var person = entryToPerson(baseEntry)
    expect(person.ldapExtra).toBeUndefined()
    expect(person.uid).toBe('rgibson')
    expect(person.name).toBe('Ryan Gibson')
  })

  it('returns no ldapExtra when extraAttrs is empty array', () => {
    var person = entryToPerson(baseEntry, [])
    expect(person.ldapExtra).toBeUndefined()
  })

  it('extracts specified extra attributes into ldapExtra', () => {
    var person = entryToPerson(baseEntry, ['rhatRnDComponent', 'rhatSubproduct', 'rhatJobRole'])
    expect(person.ldapExtra).toEqual({
      rhatRnDComponent: 'Enablement',
      rhatSubproduct: 'Red Hat OpenShift AI',
      rhatJobRole: 'Content Services'
    })
  })

  it('omits extra attributes that are not present on the entry', () => {
    var person = entryToPerson(baseEntry, ['rhatRnDComponent', 'rhatProject'])
    expect(person.ldapExtra).toEqual({
      rhatRnDComponent: 'Enablement'
    })
    expect(person.ldapExtra.rhatProject).toBeUndefined()
  })

  it('returns no ldapExtra when none of the requested attrs are present', () => {
    var person = entryToPerson(baseEntry, ['nonExistentAttr'])
    expect(person.ldapExtra).toBeUndefined()
  })

  it('handles multi-value LDAP attributes (arrays)', () => {
    var entry = { ...baseEntry, rhatSocialUrl: ['Github->https://github.com/test', 'Linkedin->https://linkedin.com/in/test'] }
    var person = entryToPerson(entry, ['rhatSocialUrl'])
    expect(Array.isArray(person.ldapExtra.rhatSocialUrl)).toBe(true)
    expect(person.ldapExtra.rhatSocialUrl).toHaveLength(2)
  })

  it('does not interfere with base field mapping', () => {
    var person = entryToPerson(baseEntry, ['rhatRnDComponent'])
    expect(person.geo).toBe('NA')
    expect(person.location).toBe('Remote US IN')
    expect(person.costCenter).toBe('656')
    expect(person.title).toBe('Manager, Software Engineering')
  })
})

describe('mergePerson with ldapExtra', () => {
  const now = '2026-06-18T00:00:00.000Z'

  function makeFresh(ldapExtra) {
    return {
      uid: 'jdoe', name: 'Jane Doe', email: 'jdoe@test.com',
      title: 'SRE', city: '', country: '', geo: '', location: '',
      officeLocation: '', costCenter: '', managerUid: null,
      githubUsername: null, gitlabUsername: null,
      ldapExtra: ldapExtra
    }
  }

  it('copies ldapExtra onto new person', () => {
    var fresh = makeFresh({ rhatRnDComponent: 'AI', rhatJobRole: 'Engineering' })
    var result = mergePerson(null, fresh, 'orgRoot1', now)
    expect(result.isNew).toBe(true)
    expect(result.person.ldapExtra).toEqual({
      rhatRnDComponent: 'AI',
      rhatJobRole: 'Engineering'
    })
  })

  it('does not set ldapExtra on new person when absent', () => {
    var fresh = makeFresh(undefined)
    var result = mergePerson(null, fresh, 'orgRoot1', now)
    expect(result.isNew).toBe(true)
    expect(result.person.ldapExtra).toBeUndefined()
  })

  it('updates ldapExtra on existing person and tracks changes', () => {
    var existing = {
      uid: 'jdoe', name: 'Jane Doe', email: 'jdoe@test.com',
      title: 'SRE', city: '', country: '', geo: '', location: '',
      officeLocation: '', costCenter: '', managerUid: null,
      orgRoot: 'orgRoot1', github: null, gitlab: null,
      status: 'active', firstSeenAt: now, lastSeenAt: now,
      inactiveSince: null,
      ldapExtra: { rhatRnDComponent: 'Enablement' }
    }
    var fresh = makeFresh({ rhatRnDComponent: 'AI' })
    var result = mergePerson(existing, fresh, 'orgRoot1', now)
    expect(result.person.ldapExtra.rhatRnDComponent).toBe('AI')
    var change = result.changes.find(c => c.field === 'ldapExtra.rhatRnDComponent')
    expect(change).toBeDefined()
    expect(change.from).toBe('Enablement')
    expect(change.to).toBe('AI')
  })

  it('produces no changes when ldapExtra values are unchanged', () => {
    var existing = {
      uid: 'jdoe', name: 'Jane Doe', email: 'jdoe@test.com',
      title: 'SRE', city: '', country: '', geo: '', location: '',
      officeLocation: '', costCenter: '', managerUid: null,
      orgRoot: 'orgRoot1', github: null, gitlab: null,
      status: 'active', firstSeenAt: now, lastSeenAt: now,
      inactiveSince: null,
      ldapExtra: { rhatRnDComponent: 'AI' }
    }
    var fresh = makeFresh({ rhatRnDComponent: 'AI' })
    var result = mergePerson(existing, fresh, 'orgRoot1', now)
    var ldapChanges = result.changes.filter(c => c.field.startsWith('ldapExtra.'))
    expect(ldapChanges).toHaveLength(0)
  })

  it('overwrites ldapExtra entirely with fresh values', () => {
    var existing = {
      uid: 'jdoe', name: 'Jane Doe', email: 'jdoe@test.com',
      title: 'SRE', city: '', country: '', geo: '', location: '',
      officeLocation: '', costCenter: '', managerUid: null,
      orgRoot: 'orgRoot1', github: null, gitlab: null,
      status: 'active', firstSeenAt: now, lastSeenAt: now,
      inactiveSince: null,
      ldapExtra: { rhatRnDComponent: 'Enablement', rhatJobRole: 'Engineering' }
    }
    var fresh = makeFresh({ rhatSubproduct: 'OpenShift' })
    var result = mergePerson(existing, fresh, 'orgRoot1', now)
    expect(result.person.ldapExtra).toEqual({ rhatSubproduct: 'OpenShift' })
    expect(result.person.ldapExtra.rhatRnDComponent).toBeUndefined()
  })
})

describe('LDAP_ATTRS export', () => {
  it('exports the hardcoded base attributes list', () => {
    expect(Array.isArray(LDAP_ATTRS)).toBe(true)
    expect(LDAP_ATTRS).toContain('cn')
    expect(LDAP_ATTRS).toContain('uid')
    expect(LDAP_ATTRS).toContain('rhatGeo')
    expect(LDAP_ATTRS).toContain('memberOf')
  })
})

describe('discoverAttributes', () => {
  it('is exported as a function', () => {
    expect(typeof discoverAttributes).toBe('function')
  })
})

describe('mergePerson ldapExtra cleanup', () => {
  const now = '2026-06-18T00:00:00.000Z'

  it('clears ldapExtra when fresh has no ldapExtra (admin disabled all fields)', () => {
    var existing = {
      uid: 'jdoe', name: 'Jane Doe', email: 'jdoe@test.com',
      title: 'SRE', city: '', country: '', geo: '', location: '',
      officeLocation: '', costCenter: '', managerUid: null,
      orgRoot: 'orgRoot1', github: null, gitlab: null,
      status: 'active', firstSeenAt: now, lastSeenAt: now,
      inactiveSince: null,
      ldapExtra: { rhatRnDComponent: 'AI', rhatJobRole: 'Engineering' }
    }
    var fresh = {
      uid: 'jdoe', name: 'Jane Doe', email: 'jdoe@test.com',
      title: 'SRE', city: '', country: '', geo: '', location: '',
      officeLocation: '', costCenter: '', managerUid: null,
      githubUsername: null, gitlabUsername: null
    }
    var result = mergePerson(existing, fresh, 'orgRoot1', now)
    expect(result.person.ldapExtra).toBeUndefined()
  })

  it('tracks removal of ldapExtra keys in changelog', () => {
    var existing = {
      uid: 'jdoe', name: 'Jane Doe', email: 'jdoe@test.com',
      title: 'SRE', city: '', country: '', geo: '', location: '',
      officeLocation: '', costCenter: '', managerUid: null,
      orgRoot: 'orgRoot1', github: null, gitlab: null,
      status: 'active', firstSeenAt: now, lastSeenAt: now,
      inactiveSince: null,
      ldapExtra: { rhatRnDComponent: 'AI', rhatJobRole: 'Engineering' }
    }
    var fresh = {
      uid: 'jdoe', name: 'Jane Doe', email: 'jdoe@test.com',
      title: 'SRE', city: '', country: '', geo: '', location: '',
      officeLocation: '', costCenter: '', managerUid: null,
      githubUsername: null, gitlabUsername: null
    }
    var result = mergePerson(existing, fresh, 'orgRoot1', now)
    var removals = result.changes.filter(c => c.field.startsWith('ldapExtra.'))
    expect(removals.length).toBe(2)
    expect(removals.find(c => c.field === 'ldapExtra.rhatRnDComponent')).toBeDefined()
    expect(removals.find(c => c.field === 'ldapExtra.rhatJobRole')).toBeDefined()
  })

  it('preserves empty string and false values (no falsy coercion)', () => {
    var existing = {
      uid: 'jdoe', name: 'Jane Doe', email: 'jdoe@test.com',
      title: 'SRE', city: '', country: '', geo: '', location: '',
      officeLocation: '', costCenter: '', managerUid: null,
      orgRoot: 'orgRoot1', github: null, gitlab: null,
      status: 'active', firstSeenAt: now, lastSeenAt: now,
      inactiveSince: null
    }
    var fresh = {
      uid: 'jdoe', name: 'Jane Doe', email: 'jdoe@test.com',
      title: 'SRE', city: '', country: '', geo: '', location: '',
      officeLocation: '', costCenter: '', managerUid: null,
      githubUsername: null, gitlabUsername: null,
      ldapExtra: { rhatTeamLead: 'False', emptyField: '' }
    }
    var result = mergePerson(existing, fresh, 'orgRoot1', now)
    expect(result.person.ldapExtra.rhatTeamLead).toBe('False')
    expect(result.person.ldapExtra.emptyField).toBe('')
  })
})

describe('entryToPerson extraAttrs edge cases', () => {
  it('handles null values in LDAP entry without crashing', () => {
    var entry = { uid: 'test', cn: 'Test', rhatRnDComponent: null }
    var person = entryToPerson(entry, ['rhatRnDComponent'])
    expect(person.ldapExtra).toBeUndefined()
  })

  it('handles entry with only some requested attrs present', () => {
    var entry = { uid: 'test', cn: 'Test', rhatRnDComponent: 'AI' }
    var person = entryToPerson(entry, ['rhatRnDComponent', 'rhatSubproduct', 'rhatJobRole'])
    expect(person.ldapExtra).toEqual({ rhatRnDComponent: 'AI' })
  })
})

describe('LDAP_ATTRS filtering', () => {
  it('base attrs should not be accepted as extra attrs', () => {
    for (const attr of LDAP_ATTRS) {
      expect(LDAP_ATTRS).toContain(attr)
    }
  })

  it('LDAP_ATTRS does not include the new configurable fields', () => {
    expect(LDAP_ATTRS).not.toContain('rhatRnDComponent')
    expect(LDAP_ATTRS).not.toContain('rhatSubproduct')
    expect(LDAP_ATTRS).not.toContain('rhatJobRole')
    expect(LDAP_ATTRS).not.toContain('rhatProject')
  })
})
