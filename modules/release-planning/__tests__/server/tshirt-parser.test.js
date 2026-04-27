import { describe, it, expect } from 'vitest'

const { parseTshirtSize, adfToText, VALID_SIZES } = require('../../server/health/tshirt-parser')

describe('VALID_SIZES', function() {
  it('contains all expected sizes', function() {
    expect(VALID_SIZES).toEqual(['XS', 'S', 'M', 'L', 'XL'])
  })
})

describe('adfToText', function() {
  it('returns empty string for null', function() {
    expect(adfToText(null)).toBe('')
  })

  it('returns empty string for undefined', function() {
    expect(adfToText(undefined)).toBe('')
  })

  it('returns the string itself for string input', function() {
    expect(adfToText('hello')).toBe('hello')
  })

  it('extracts text from a text node', function() {
    expect(adfToText({ type: 'text', text: 'some text' })).toBe('some text')
  })

  it('returns empty string for text node without text', function() {
    expect(adfToText({ type: 'text' })).toBe('')
  })

  it('extracts text from nested content', function() {
    var node = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Hello ' },
            { type: 'text', text: 'World' }
          ]
        }
      ]
    }
    expect(adfToText(node)).toBe('Hello World')
  })

  it('returns empty string for node without content array', function() {
    expect(adfToText({ type: 'doc' })).toBe('')
  })
})

describe('parseTshirtSize', function() {
  // Null/empty/invalid inputs
  it('returns null for null description', function() {
    expect(parseTshirtSize(null)).toBeNull()
  })

  it('returns null for undefined description', function() {
    expect(parseTshirtSize(undefined)).toBeNull()
  })

  it('returns null for empty string', function() {
    expect(parseTshirtSize('')).toBeNull()
  })

  it('returns null for description with no size', function() {
    expect(parseTshirtSize('This is a feature description without any size info.')).toBeNull()
  })

  it('returns null for non-ADF non-string object', function() {
    expect(parseTshirtSize({ type: 'something-else' })).toBeNull()
  })

  // Pattern 1: Size label
  it('parses "T-Shirt Size: M"', function() {
    expect(parseTshirtSize('T-Shirt Size: M')).toBe('M')
  })

  it('parses "T-shirt Size: XL"', function() {
    expect(parseTshirtSize('T-shirt Size: XL')).toBe('XL')
  })

  it('parses "Tshirt Size: S"', function() {
    expect(parseTshirtSize('Tshirt Size: S')).toBe('S')
  })

  it('parses "Size: L"', function() {
    expect(parseTshirtSize('Size: L')).toBe('L')
  })

  it('parses "Size: XS"', function() {
    expect(parseTshirtSize('Size: XS')).toBe('XS')
  })

  it('parses "Size= M"', function() {
    expect(parseTshirtSize('Size= M')).toBe('M')
  })

  it('parses "Size:M" without space after colon', function() {
    expect(parseTshirtSize('Size:M')).toBe('M')
  })

  // Case insensitivity
  it('handles lowercase "size: m"', function() {
    expect(parseTshirtSize('size: m')).toBe('M')
  })

  it('handles uppercase "SIZE: XL"', function() {
    expect(parseTshirtSize('SIZE: XL')).toBe('XL')
  })

  it('handles mixed case "Size: xs"', function() {
    expect(parseTshirtSize('Size: xs')).toBe('XS')
  })

  // Pattern 2: Complexity/Effort
  it('parses "Complexity: S"', function() {
    expect(parseTshirtSize('Complexity: S')).toBe('S')
  })

  it('parses "Effort: L"', function() {
    expect(parseTshirtSize('Effort: L')).toBe('L')
  })

  it('parses "Complexity= XL"', function() {
    expect(parseTshirtSize('Complexity= XL')).toBe('XL')
  })

  // Size in context (followed by delimiters)
  it('parses size followed by comma', function() {
    expect(parseTshirtSize('Size: M, other info')).toBe('M')
  })

  it('parses size followed by semicolon', function() {
    expect(parseTshirtSize('Size: L; notes')).toBe('L')
  })

  it('parses size followed by period', function() {
    expect(parseTshirtSize('Size: S. More text.')).toBe('S')
  })

  it('parses size followed by dash', function() {
    expect(parseTshirtSize('Size: M - estimated')).toBe('M')
  })

  it('parses size followed by closing paren', function() {
    expect(parseTshirtSize('(Size: M)')).toBe('M')
  })

  it('parses size followed by closing bracket', function() {
    expect(parseTshirtSize('[Size: XL]')).toBe('XL')
  })

  it('parses size followed by pipe', function() {
    expect(parseTshirtSize('Size: S| other')).toBe('S')
  })

  // FALSE POSITIVE tests -- critical for C4 resolution
  it('does NOT match "Size: Small"', function() {
    expect(parseTshirtSize('Size: Small')).toBeNull()
  })

  it('does NOT match "Size: Special"', function() {
    expect(parseTshirtSize('Size: Special')).toBeNull()
  })

  it('does NOT match "Size: Medium"', function() {
    expect(parseTshirtSize('Size: Medium')).toBeNull()
  })

  it('does NOT match "Size: Large"', function() {
    expect(parseTshirtSize('Size: Large')).toBeNull()
  })

  it('does NOT match "Size: XLarge"', function() {
    expect(parseTshirtSize('Size: XLarge')).toBeNull()
  })

  // ADF input
  it('parses size from ADF document', function() {
    var adf = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Feature description.\nT-Shirt Size: M\nOther info.' }
          ]
        }
      ]
    }
    expect(parseTshirtSize(adf)).toBe('M')
  })

  it('parses size from nested ADF structure', function() {
    var adf = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Some text' }
          ]
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Complexity: XL' }
          ]
        }
      ]
    }
    expect(parseTshirtSize(adf)).toBe('XL')
  })

  it('returns null for ADF document with no size', function() {
    var adf = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Just a regular description.' }
          ]
        }
      ]
    }
    expect(parseTshirtSize(adf)).toBeNull()
  })

  // Embedded in larger text
  it('finds size embedded in multi-line text', function() {
    var text = 'Feature: Implement widget\nPriority: High\nT-Shirt Size: L\nOwner: Alice'
    expect(parseTshirtSize(text)).toBe('L')
  })

  // XS and XL should match before S and L
  it('correctly matches XS (not just S)', function() {
    expect(parseTshirtSize('Size: XS')).toBe('XS')
  })

  it('correctly matches XL (not just L)', function() {
    expect(parseTshirtSize('Size: XL')).toBe('XL')
  })
})
