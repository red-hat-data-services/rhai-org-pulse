import { describe, it, expect } from 'vitest'
import { RISK_SEVERITY, isWorse } from '../../client/utils/risk-levels'

describe('RISK_SEVERITY', function() {
  it('ranks red as most severe (0)', function() {
    expect(RISK_SEVERITY.red).toBe(0)
  })

  it('ranks yellow as medium severity (1)', function() {
    expect(RISK_SEVERITY.yellow).toBe(1)
  })

  it('ranks green as least severe (2)', function() {
    expect(RISK_SEVERITY.green).toBe(2)
  })

  it('has exactly three levels', function() {
    expect(Object.keys(RISK_SEVERITY)).toEqual(['red', 'yellow', 'green'])
  })
})

describe('isWorse', function() {
  it('returns true when red vs green', function() {
    expect(isWorse('red', 'green')).toBe(true)
  })

  it('returns true when red vs yellow', function() {
    expect(isWorse('red', 'yellow')).toBe(true)
  })

  it('returns true when yellow vs green', function() {
    expect(isWorse('yellow', 'green')).toBe(true)
  })

  it('returns false when green vs red', function() {
    expect(isWorse('green', 'red')).toBe(false)
  })

  it('returns false when green vs yellow', function() {
    expect(isWorse('green', 'yellow')).toBe(false)
  })

  it('returns false when yellow vs red', function() {
    expect(isWorse('yellow', 'red')).toBe(false)
  })

  it('returns false when same level', function() {
    expect(isWorse('red', 'red')).toBe(false)
    expect(isWorse('yellow', 'yellow')).toBe(false)
    expect(isWorse('green', 'green')).toBe(false)
  })

  it('treats unknown levels as green (severity 2)', function() {
    expect(isWorse('red', 'unknown')).toBe(true)
    expect(isWorse('unknown', 'red')).toBe(false)
    expect(isWorse('unknown', 'green')).toBe(false)
    expect(isWorse('green', 'unknown')).toBe(false)
  })
})
