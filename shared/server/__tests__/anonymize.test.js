import { describe, it, expect } from 'vitest'

const { buildMapping, hashString, ISSUE_SUMMARIES } = require('../anonymize')

const FIXTURE_ROSTER = {
  vp: {
    name: 'Demo VP',
    uid: 'demovp',
    title: 'VP of Engineering'
  },
  orgs: {
    org1: {
      leader: {
        name: 'Alice Chen',
        uid: 'achen',
        email: 'achen@example.com',
        githubUsername: 'alicechen',
        gitlabUsername: 'alicechen'
      },
      members: [
        {
          name: 'Bob Smith',
          uid: 'bsmith',
          email: 'bsmith@example.com',
          githubUsername: 'bobsmith',
          gitlabUsername: 'bobsmith'
        }
      ]
    },
    org2: {
      leader: {
        name: 'Frank Johnson',
        uid: 'fjohnson',
        email: 'fjohnson@example.com',
        githubUsername: 'frankj',
        gitlabUsername: 'frankj'
      },
      members: []
    }
  }
}

describe('buildMapping', () => {
  it('creates consistent mappings for all person fields', () => {
    const mapping = buildMapping(FIXTURE_ROSTER)

    // VP is mapped
    expect(mapping.nameToFake['Demo VP']).toBeDefined()
    expect(mapping.uidToFake['demovp']).toBeDefined()

    // Leaders and members are mapped
    expect(mapping.nameToFake['Alice Chen']).toBeDefined()
    expect(mapping.nameToFake['Bob Smith']).toBeDefined()
    expect(mapping.nameToFake['Frank Johnson']).toBeDefined()

    // UIDs mapped
    expect(mapping.uidToFake['achen']).toBeDefined()
    expect(mapping.uidToFake['bsmith']).toBeDefined()

    // Emails mapped
    expect(mapping.emailToFake['achen@example.com']).toBeDefined()
    expect(mapping.emailToFake['bsmith@example.com']).toBeDefined()

    // GitHub usernames mapped
    expect(mapping.githubToFake['alicechen']).toBeDefined()
    expect(mapping.githubToFake['bobsmith']).toBeDefined()

    // GitLab usernames mapped
    expect(mapping.gitlabToFake['alicechen']).toBeDefined()
    expect(mapping.gitlabToFake['bobsmith']).toBeDefined()
  })

  it('produces deterministic output across calls', () => {
    const mapping1 = buildMapping(FIXTURE_ROSTER)
    const mapping2 = buildMapping(FIXTURE_ROSTER)

    expect(mapping1.nameToFake).toEqual(mapping2.nameToFake)
    expect(mapping1.uidToFake).toEqual(mapping2.uidToFake)
    expect(mapping1.githubToFake).toEqual(mapping2.githubToFake)
  })

  it('anonymizes fake names with Person N pattern', () => {
    const mapping = buildMapping(FIXTURE_ROSTER)
    const fakeNames = Object.values(mapping.nameToFake)
    expect(fakeNames.every(n => n.startsWith('Person '))).toBe(true)
  })

  it('maps UIDs to personN pattern', () => {
    const mapping = buildMapping(FIXTURE_ROSTER)
    const fakeUids = Object.values(mapping.uidToFake)
    expect(fakeUids.every(u => u.startsWith('person'))).toBe(true)
  })

  it('maps emails to uid@example.com pattern', () => {
    const mapping = buildMapping(FIXTURE_ROSTER)
    const fakeEmails = Object.values(mapping.emailToFake)
    expect(fakeEmails.every(e => e.endsWith('@example.com'))).toBe(true)
  })

  it('maps GitHub usernames to ghuser-N pattern', () => {
    const mapping = buildMapping(FIXTURE_ROSTER)
    const fakeGh = Object.values(mapping.githubToFake)
    expect(fakeGh.every(g => g.startsWith('ghuser-'))).toBe(true)
  })

  it('maps GitLab usernames to gluser-N pattern', () => {
    const mapping = buildMapping(FIXTURE_ROSTER)
    const fakeGl = Object.values(mapping.gitlabToFake)
    expect(fakeGl.every(g => g.startsWith('gluser-'))).toBe(true)
  })

  it('handles null/undefined roster gracefully', () => {
    const mapping = buildMapping(null)
    expect(mapping.nameToFake).toEqual({})
    expect(mapping.uidToFake).toEqual({})
  })
})

describe('unmapped fallback', () => {
  it('creates Former Member mapping for unknown names', () => {
    const mapping = buildMapping(FIXTURE_ROSTER)
    const result = mapping.getOrCreateNameMapping('Unknown Person')
    expect(result).toBe('Former Member 1')

    // Same name returns same mapping
    expect(mapping.getOrCreateNameMapping('Unknown Person')).toBe('Former Member 1')
  })

  it('creates unmapped GitHub username mapping', () => {
    const mapping = buildMapping(FIXTURE_ROSTER)
    const result = mapping.getOrCreateGithubMapping('unknowngh')
    expect(result).toMatch(/^ghuser-unmapped-/)
  })

  it('creates unmapped GitLab username mapping', () => {
    const mapping = buildMapping(FIXTURE_ROSTER)
    const result = mapping.getOrCreateGitlabMapping('unknowngl')
    expect(result).toMatch(/^gluser-unmapped-/)
  })
})

describe('anonymizeJiraKey', () => {
  it('anonymizes standard Jira keys', () => {
    const mapping = buildMapping(FIXTURE_ROSTER)
    const result = mapping.anonymizeJiraKey('DEMO-123')
    expect(result).toMatch(/^TEST\d+-123$/)
  })

  it('returns same prefix for same project', () => {
    const mapping = buildMapping(FIXTURE_ROSTER)
    const key1 = mapping.anonymizeJiraKey('DEMO-100')
    const key2 = mapping.anonymizeJiraKey('DEMO-200')
    const prefix1 = key1.split('-')[0]
    const prefix2 = key2.split('-')[0]
    expect(prefix1).toBe(prefix2)
  })

  it('uses different prefix for different projects', () => {
    const mapping = buildMapping(FIXTURE_ROSTER)
    const key1 = mapping.anonymizeJiraKey('PROJ1-100')
    const key2 = mapping.anonymizeJiraKey('PROJ2-100')
    const prefix1 = key1.split('-')[0]
    const prefix2 = key2.split('-')[0]
    expect(prefix1).not.toBe(prefix2)
  })

  it('preserves issue number', () => {
    const mapping = buildMapping(FIXTURE_ROSTER)
    expect(mapping.anonymizeJiraKey('DEMO-456')).toMatch(/-456$/)
  })

  it('returns non-matching strings unchanged', () => {
    const mapping = buildMapping(FIXTURE_ROSTER)
    expect(mapping.anonymizeJiraKey('not-a-key')).toBe('not-a-key')
    expect(mapping.anonymizeJiraKey(null)).toBe(null)
  })
})

describe('anonymizeIssueSummary', () => {
  it('returns a summary from the pool', () => {
    const mapping = buildMapping(FIXTURE_ROSTER)
    const result = mapping.anonymizeIssueSummary('DEMO-123')
    expect(ISSUE_SUMMARIES).toContain(result)
  })

  it('is deterministic for same key', () => {
    const mapping = buildMapping(FIXTURE_ROSTER)
    const r1 = mapping.anonymizeIssueSummary('DEMO-123')
    const r2 = mapping.anonymizeIssueSummary('DEMO-123')
    expect(r1).toBe(r2)
  })

  it('handles null key', () => {
    const mapping = buildMapping(FIXTURE_ROSTER)
    expect(mapping.anonymizeIssueSummary(null)).toBe('Generic task description')
  })
})

describe('anonymizeBoardUrl', () => {
  it('returns a placeholder URL', () => {
    const mapping = buildMapping(FIXTURE_ROSTER)
    const result = mapping.anonymizeBoardUrl('https://real.url/boards/123', 1)
    expect(result).toBe('https://jira.example.com/jira/software/c/projects/TEST/boards/1')
  })
})

describe('anonymizeValue', () => {
  it('looks up known names', () => {
    const mapping = buildMapping(FIXTURE_ROSTER)
    expect(mapping.anonymizeValue('Alice Chen')).toBe(mapping.nameToFake['Alice Chen'])
  })

  it('looks up known UIDs', () => {
    const mapping = buildMapping(FIXTURE_ROSTER)
    expect(mapping.anonymizeValue('achen')).toBe(mapping.uidToFake['achen'])
  })

  it('returns original for unknown values', () => {
    const mapping = buildMapping(FIXTURE_ROSTER)
    expect(mapping.anonymizeValue('unknown-value')).toBe('unknown-value')
  })

  it('handles null/undefined', () => {
    const mapping = buildMapping(FIXTURE_ROSTER)
    expect(mapping.anonymizeValue(null)).toBe(null)
    expect(mapping.anonymizeValue(undefined)).toBe(undefined)
  })
})

describe('hashString', () => {
  it('is deterministic', () => {
    expect(hashString('test')).toBe(hashString('test'))
  })

  it('returns different values for different strings', () => {
    expect(hashString('abc')).not.toBe(hashString('def'))
  })
})
