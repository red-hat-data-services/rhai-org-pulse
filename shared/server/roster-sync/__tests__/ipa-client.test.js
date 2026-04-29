import { describe, it, expect, vi } from 'vitest'

const { escapeLdapFilter, searchPeople } = require('../ipa-client')

describe('escapeLdapFilter', () => {
  it('returns empty string for falsy input', () => {
    expect(escapeLdapFilter(null)).toBe('')
    expect(escapeLdapFilter(undefined)).toBe('')
    expect(escapeLdapFilter('')).toBe('')
  })

  it('passes through safe strings unchanged', () => {
    expect(escapeLdapFilter('jdoe')).toBe('jdoe')
    expect(escapeLdapFilter('jane.doe')).toBe('jane.doe')
    expect(escapeLdapFilter('user123')).toBe('user123')
  })

  it('escapes backslash', () => {
    expect(escapeLdapFilter('a\\b')).toBe('a\\5cb')
  })

  it('escapes asterisk', () => {
    expect(escapeLdapFilter('a*b')).toBe('a\\2ab')
  })

  it('escapes parentheses', () => {
    expect(escapeLdapFilter('a(b)c')).toBe('a\\28b\\29c')
  })

  it('escapes NUL byte', () => {
    expect(escapeLdapFilter('a\x00b')).toBe('a\\00b')
  })

  it('escapes multiple special chars', () => {
    expect(escapeLdapFilter('*()\\\x00')).toBe('\\2a\\28\\29\\5c\\00')
  })

  it('converts non-string input to string', () => {
    expect(escapeLdapFilter(42)).toBe('42')
  })
})

describe('searchPeople', () => {
  function makeMockClient(entries) {
    return {
      search: vi.fn(function(_baseDn, opts, cb) {
        var events = {}
        cb(null, {
          on: function(event, handler) {
            events[event] = handler
            if (event === 'end') {
              // Emit entries then end
              setTimeout(function() {
                var limited = entries
                if (opts.sizeLimit) limited = entries.slice(0, opts.sizeLimit)
                for (var i = 0; i < limited.length; i++) {
                  events.searchEntry({
                    attributes: Object.keys(limited[i]).map(function(k) {
                      return { type: k, values: [limited[i][k]] }
                    })
                  })
                }
                events.end()
              }, 0)
            }
          }
        })
      })
    }
  }

  it('returns empty array for empty query', async () => {
    var client = makeMockClient([])
    var results = await searchPeople(client, 'dc=test', '', 10)
    expect(results).toEqual([])
    expect(client.search).not.toHaveBeenCalled()
  })

  it('returns empty array for null query', async () => {
    var results = await searchPeople(makeMockClient([]), 'dc=test', null, 10)
    expect(results).toEqual([])
  })

  it('builds multi-field filter with cn, uid, and mail', async () => {
    var client = makeMockClient([])
    await searchPeople(client, 'dc=test', 'john', 10)
    var searchCall = client.search.mock.calls[0]
    var filter = searchCall[1].filter
    expect(filter).toContain('(cn=*john*)')
    expect(filter).toContain('(uid=*john*)')
    expect(filter).toContain('(mail=*john*)')
    expect(filter).toMatch(/^\(\|/)
  })

  it('passes sizeLimit to search options', async () => {
    var client = makeMockClient([])
    await searchPeople(client, 'dc=test', 'jane', 5)
    var searchCall = client.search.mock.calls[0]
    expect(searchCall[1].sizeLimit).toBe(5)
  })

  it('defaults sizeLimit to 10', async () => {
    var client = makeMockClient([])
    await searchPeople(client, 'dc=test', 'jane')
    var searchCall = client.search.mock.calls[0]
    expect(searchCall[1].sizeLimit).toBe(10)
  })

  it('returns entryToPerson results', async () => {
    var entries = [
      { uid: 'jdoe', cn: 'John Doe', mail: 'jdoe@test.com', title: 'Engineer' }
    ]
    var client = makeMockClient(entries)
    var results = await searchPeople(client, 'dc=test', 'john', 10)
    expect(results).toHaveLength(1)
    expect(results[0].uid).toBe('jdoe')
    expect(results[0].name).toBe('John Doe')
    expect(results[0].email).toBe('jdoe@test.com')
  })

  it('escapes special characters in query', async () => {
    var client = makeMockClient([])
    await searchPeople(client, 'dc=test', 'a*b(c)', 10)
    var filter = client.search.mock.calls[0][1].filter
    expect(filter).toContain('a\\2ab\\28c\\29')
    expect(filter).not.toContain('a*b(c)')
  })
})
