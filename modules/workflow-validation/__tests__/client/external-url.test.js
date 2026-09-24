import { describe, expect, it } from 'vitest'
import { safeExternalUrl } from '../../client/utils/external-url'

describe('safeExternalUrl', () => {
  it('allows credential-free HTTPS links', () => {
    expect(safeExternalUrl('https://issues.example/RHOAIENG-123'))
      .toBe('https://issues.example/RHOAIENG-123')
  })

  it.each([
    'javascript:alert(1)',
    'data:text/html,unsafe',
    'http://issues.example/RHOAIENG-123',
    'https://user:secret@issues.example/RHOAIENG-123',
    'not a URL'
  ])('rejects unsafe telemetry URL %s', (value) => {
    expect(safeExternalUrl(value)).toBe('')
  })
})
