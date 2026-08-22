import { describe, it, expect } from 'vitest'
import { buildKeysJqlUrl } from '../../../client/composables/jiraKeysJql'

describe('buildKeysJqlUrl', function () {
  it('returns empty string for empty input', function () {
    expect(buildKeysJqlUrl(null)).toBe('')
    expect(buildKeysJqlUrl([])).toBe('')
  })

  it('builds a key-in JQL URL and dedupes keys', function () {
    var url = buildKeysJqlUrl([
      { key: 'RHAISTRAT-1' },
      { key: 'RHAISTRAT-2' },
      { key: 'RHAISTRAT-1' },
    ])
    expect(url).toContain('https://redhat.atlassian.net/issues/?jql=')
    var jql = decodeURIComponent(url.split('jql=')[1])
    expect(jql).toBe('key in (RHAISTRAT-1, RHAISTRAT-2)')
  })

  it('falls back to /browse/ KEY from url when key is missing', function () {
    var url = buildKeysJqlUrl([
      { url: 'https://redhat.atlassian.net/browse/RHAISTRAT-2196' },
    ])
    expect(decodeURIComponent(url.split('jql=')[1])).toBe('key in (RHAISTRAT-2196)')
  })
})
